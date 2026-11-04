"""
거래처 → 카테고리 자동 분류 (규칙 기반).

추천 순서
1) USER_RULE : 이 유저가 같은 거래처에 직접 고르거나 고친 카테고리 (MerchantCategoryRule)
2) KEYWORD   : 아래 키워드 사전
3) NONE      : 못 찾음 → 사용자가 골라야 함

추천 카테고리는 항상 '이 유저가 가진 카테고리' 중 하나로 맞춘다.
예) 키워드는 '의류'인데 유저에게 '쇼핑'만 있으면 '쇼핑'. 맞출 곳이 없으면 NONE.
"""
import re
from typing import Dict, Iterable, List, Optional, Tuple

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from models import MerchantCategoryRule, UserCategorySetting
from services.time_utils import kst_now_naive

SOURCE_USER_RULE = "USER_RULE"
SOURCE_KEYWORD = "KEYWORD"
SOURCE_NONE = "NONE"

# ----------------------------------------
# 거래처명 정리
# ----------------------------------------
_PAREN_RE = re.compile(r"\s*[\(（][^\)）]*[\)）]\s*")          # (간편결제), (주) ...
_PG_SUFFIX_RE = re.compile(r"(_[0-9A-Za-z]+)+$")              # _2_KICC, _NICE ...
_SPACES_RE = re.compile(r"\s+")


def normalize_merchant(raw: Optional[str]) -> str:
    """'컴포즈커피(간편결제)_2_KICC' → '컴포즈커피'. 정리 후 비면 원문(공백 정리만)을 쓴다."""
    text = _SPACES_RE.sub(" ", (raw or "").strip())
    cleaned = _PG_SUFFIX_RE.sub("", _PAREN_RE.sub(" ", text)).strip()
    cleaned = _SPACES_RE.sub(" ", cleaned)
    return cleaned or text


def merchant_key(raw: Optional[str]) -> str:
    """규칙 저장/조회용 키: 정리한 이름의 소문자, 공백 제거."""
    return normalize_merchant(raw).replace(" ", "").lower()


# ----------------------------------------
# 키워드 사전 (앞에 있을수록 우선)
# ----------------------------------------
KEYWORD_RULES: List[Tuple[str, Tuple[str, ...]]] = [
    ("카페", ("스타벅스", "메가커피", "메가엠지씨", "mgc커피", "컴포즈", "빽다방", "이디야", "투썸", "할리스",
             "폴바셋", "블루보틀", "공차", "더벤티", "매머드", "커피빈", "탐앤탐스", "파스쿠찌", "커피", "카페")),
    ("교통", ("지하철", "버스", "티머니", "코레일", "korail", "srt", "카카오t", "택시", "따릉이", "철도", "고속버스", "캐시비")),
    ("식비", ("배달의민족", "배민", "요기요", "쿠팡이츠", "편의점", "gs25", "cu", "세븐일레븐", "이마트24", "미니스톱",
             "맥도날드", "버거킹", "롯데리아", "kfc", "맘스터치", "서브웨이", "김밥", "분식", "식당", "학생식당", "학식",
             "치킨", "피자", "국밥", "마라탕", "파리바게뜨", "뚜레쥬르", "베이커리", "도시락", "떡볶이", "돈까스", "샐러드")),
    ("의류", ("무신사", "지그재그", "에이블리", "29cm", "유니클로", "스파오", "탑텐", "자라", "h&m", "에잇세컨즈", "브랜디")),
    ("화장품", ("올리브영", "아리따움", "이니스프리", "롭스", "시코르")),
    ("생활", ("다이소", "이마트", "홈플러스", "롯데마트", "쿠팡", "11번가", "지마켓", "옥션")),
]

# 유저에게 해당 카테고리가 없을 때 대신 쓸 카테고리 (앞에 있을수록 우선)
CATEGORY_FALLBACKS: Dict[str, Tuple[str, ...]] = {
    "의류": ("쇼핑",),
    "화장품": ("쇼핑",),
    "생활": ("쇼핑",),
    "가전": ("쇼핑",),
    "카페": ("식비",),
}

# 결제 대행만 보이는 경우: 무엇을 샀는지 알 수 없으므로 키워드로 분류하지 않는다
PAYMENT_PROXIES = ("네이버페이", "카카오페이", "토스페이", "페이코", "삼성페이", "애플페이", "스마일페이", "kg이니시스")

_ASCII_TOKEN_RE = re.compile(r"^[0-9a-z&]+$")


def _contains_keyword(name_lower: str, keyword: str) -> bool:
    # 'cu' 같은 짧은 영문 키워드는 다른 단어 속에 묻힌 경우(cube, curry)를 피하기 위해 영문 경계로만 매칭
    if _ASCII_TOKEN_RE.match(keyword):
        return re.search(rf"(?<![a-z]){re.escape(keyword)}(?![a-z])", name_lower) is not None
    return keyword in name_lower


def keyword_category(raw_merchant: Optional[str]) -> Optional[str]:
    name = normalize_merchant(raw_merchant).lower()
    if not name or any(proxy in name for proxy in PAYMENT_PROXIES):
        return None
    for category, keywords in KEYWORD_RULES:
        if any(_contains_keyword(name, k) for k in keywords):
            return category
    return None


def resolve_to_user_category(category: Optional[str], user_categories: Iterable[str]) -> Optional[str]:
    if not category:
        return None
    owned = set(user_categories)
    if category in owned:
        return category
    for fallback in CATEGORY_FALLBACKS.get(category, ()):
        if fallback in owned:
            return fallback
    return None


# ----------------------------------------
# DB 조회/저장
# ----------------------------------------
def get_user_categories(session: Session, user_id: str) -> List[str]:
    return list(session.exec(
        select(UserCategorySetting.category_name).where(UserCategorySetting.user_id == user_id)
    ).all())


def get_user_rules(session: Session, user_id: str, keys: Iterable[str]) -> Dict[str, str]:
    keys = list({k for k in keys if k})
    if not keys:
        return {}
    rows = session.exec(
        select(MerchantCategoryRule)
        .where(MerchantCategoryRule.user_id == user_id)
        .where(MerchantCategoryRule.merchant_key.in_(keys))
    ).all()
    return {r.merchant_key: r.category_name for r in rows}


def classify_merchants(session: Session, user_id: str, merchants: Iterable[str]) -> Dict[str, Tuple[Optional[str], str]]:
    """반환: {원문 거래처명: (추천 카테고리 또는 None, source)}"""
    merchants = list(merchants)
    user_categories = get_user_categories(session, user_id)
    rules = get_user_rules(session, user_id, (merchant_key(m) for m in merchants))

    result = {}
    for raw in merchants:
        ruled = resolve_to_user_category(rules.get(merchant_key(raw)), user_categories)
        if ruled:
            result[raw] = (ruled, SOURCE_USER_RULE)
            continue
        keyword = resolve_to_user_category(keyword_category(raw), user_categories)
        result[raw] = (keyword, SOURCE_KEYWORD) if keyword else (None, SOURCE_NONE)
    return result


def remember_user_choice(session: Session, user_id: str, raw_merchant: str, category: str) -> None:
    """사용자가 고른/고친 카테고리를 기억한다. commit 은 호출한 쪽이 한다."""
    key = merchant_key(raw_merchant)
    if not key or not category:
        return
    rule = session.exec(
        select(MerchantCategoryRule)
        .where(MerchantCategoryRule.user_id == user_id)
        .where(MerchantCategoryRule.merchant_key == key)
    ).first()
    if rule:
        if rule.category_name != category:
            rule.category_name = category
            rule.updated_at = kst_now_naive()
            session.add(rule)
        return
    try:
        # 같은 거래처 규칙을 동시에 처음 만드는 경우를 대비해 savepoint 안에서 넣는다
        with session.begin_nested():
            session.add(MerchantCategoryRule(user_id=user_id, merchant_key=key,
                                             category_name=category, updated_at=kst_now_naive()))
    except IntegrityError:
        rule = session.exec(
            select(MerchantCategoryRule)
            .where(MerchantCategoryRule.user_id == user_id)
            .where(MerchantCategoryRule.merchant_key == key)
        ).first()
        if rule and rule.category_name != category:
            rule.category_name = category
            rule.updated_at = kst_now_naive()
            session.add(rule)


def validate_user_category(session: Session, user_id: str, category: str) -> None:
    from fastapi import HTTPException
    if category not in get_user_categories(session, user_id):
        raise HTTPException(status_code=400, detail=f"등록되지 않은 카테고리입니다: {category}")
