# 파이썬 콘솔 또는 임시 스크립트 (api/ 폴더에서 실행)
from sqlmodel import Session
from models import engine, ShopItem

with Session(engine) as session:
    session.add(ShopItem(
        name="첫 가구 세트",
        category="FURNITURE",
        price=None,
        is_purchasable=False,
        unlock_level=5,
    ))
    session.commit()
    print("✅ 마일스톤 테스트 아이템 추가 완료")