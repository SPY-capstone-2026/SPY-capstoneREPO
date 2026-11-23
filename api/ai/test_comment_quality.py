"""
월간 총평 품질 측정 — 같은 입력을 여러 번 돌려 편차까지 본다.

재는 것
-------
  숫자 포함        구체적인가
  얼버무림         "몇 개", "절반쯤"처럼 숫자 자리를 뭉갰는가
  근거 없는 주장    "꾸준히", "점점"처럼 요약에 없는 분포를 지어냈는가
  문장 수 / 최장    한 문장에 사실을 몰아넣지 않았는가
  가드 발동         요약에 없는 수를 만들어냈는가
  잘 지킨 곳 언급    지적만 하지 않고 칭찬할 거리를 찾았는가

사용
----
  python test_comment_quality.py           # 기본 5회
  python test_comment_quality.py 10

api/ai 에 두고 실행한다 (moni_engine 폴더 안이 아니라 그 옆).
OPENAI_API_KEY 가 필요하다.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from moni_engine import report as R

N = int(sys.argv[1]) if len(sys.argv) > 1 else 5

# 숫자 자리를 뭉갠 표현. "조금 더 살펴보세요" 같은 권유 어조는 여기 넣지 않는다.
VAGUE = ["몇 개", "몇개", "절반", "중간 정도", "어느 정도",
         "여러 번", "한두", "적당히", "그럭저럭"]

# 요약에 없는 시간 분포를 주장하는 말 (튜닝 메모 우선순위 4)
#
# "갈수록", "점점"은 뺐다. 요약에 "소비 흐름: 후반에 늘어남"이 있으면
# 그 범위 안의 표현이라 근거가 있다. 분포를 지어낸 게 아니다.
# "꾸준히"는 남긴다 — 요약은 총 개수만 주지 날짜별 분포를 주지 않는다.
UNGROUNDED = ["꾸준히", "매일", "빠짐없이", "한결같이", "계속해서"]

# 금지 어미 (문체 이탈)
BAD_ENDING = re.compile(r"(습니다|였다|이다|한다|된다)[.!?]")

MONTHLY = {
    "monthly_summary": {
        "total_spend": 318000, "budget_limit": 270000, "xp_earned": 820,
    },
    "weekly_breakdown": [
        {"week_label": "1주차", "amount": 62000},
        {"week_label": "2주차", "amount": 71000},
        {"week_label": "3주차", "amount": 88000},
        {"week_label": "4주차", "amount": 97000},
    ],
    "category_overrun": [
        {"category_name": "교통", "overrun_date": "2026-10-26"},
        {"category_name": "식비", "overrun_date": "2026-10-29"},
    ],
    "evaluated_categories": [
        {"category_name": "식비", "budget_limit": 180000, "actual_spend": 195000},
        {"category_name": "교통", "budget_limit": 50000, "actual_spend": 62000},
        {"category_name": "카페", "budget_limit": 70000, "actual_spend": 66000},
        {"category_name": "편의점", "budget_limit": 50000, "actual_spend": 21000},
        {"category_name": "문화", "budget_limit": 40000, "actual_spend": 35000},
    ],
}
STATS = {"categories": [
    {"category_name": "식비", "total_count": 31, "completed_count": 18, "xp_earned": 520},
    {"category_name": "교통", "total_count": 20, "completed_count": 11, "xp_earned": 300},
]}
HISTORY = [{"category_name": "식비", "old_limit": 150000,
            "new_limit": 180000, "changed_at": "2026-10-14"}]


def sentences(text: str):
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s.strip()]


def main():
    if os.getenv("MONI_SKIP_LLM"):
        print("MONI_SKIP_LLM 이 켜져 있습니다. 끄고 다시 실행하세요.\n")

    facts = R.extract_monthly_facts(MONTHLY, STATS, HISTORY)
    summary = R._lines_to_text(R._monthly_fact_lines(facts))
    kept = (facts.get("best_kept_category") or {}).get("category")

    print("=" * 74)
    print("  LLM에 넘어가는 요약")
    print("=" * 74)
    print(summary)
    print()

    tally = dict(vague=0, ungrounded=0, guard=0, nums=0, kept=0, ending=0)
    lens = []

    print("=" * 74)
    print(f"  총평 {N}회")
    print("=" * 74)
    for i in range(1, N + 1):
        raw = R.call_llm(R._build_monthly_prompt(summary),
                         max_tokens=R.MONTHLY_MAX_TOKENS)
        if not raw:
            print(f"  {i}. (LLM 호출 실패)")
            continue

        ss = sentences(raw)
        longest = max((len(s) for s in ss), default=0)
        lens.append((len(ss), longest))

        hits = []
        if v := [w for w in VAGUE if w in raw]:
            tally["vague"] += 1
            hits.append(f"얼버무림({', '.join(v)})")
        if u := [w for w in UNGROUNDED if w in raw]:
            tally["ungrounded"] += 1
            hits.append(f"근거없음({', '.join(u)})")
        if BAD_ENDING.search(raw):
            tally["ending"] += 1
            hits.append("문체이탈")
        if R._numbers_in(raw):
            tally["nums"] += 1
        if not R._numbers_are_grounded(raw, summary):
            tally["guard"] += 1
            hits.append("★ 가드 발동")
        if kept and kept in raw:
            tally["kept"] += 1

        print(f"  {i}. {raw}")
        print(f"      {len(ss)}문장 · 최장 {longest}자"
              + (f" · {' / '.join(hits)}" if hits else ""))
    print()

    avg_s = sum(s for s, _ in lens) / len(lens) if lens else 0
    avg_l = sum(l for _, l in lens) / len(lens) if lens else 0

    print("=" * 74)
    print("  결과")
    print("=" * 74)
    rows = [
        ("숫자 포함",        tally["nums"],       "많을수록 좋음"),
        ("얼버무림",         tally["vague"],      "0이어야 함"),
        ("근거 없는 주장",    tally["ungrounded"], "0이어야 함"),
        ("문체 이탈",        tally["ending"],     "낮을수록 좋음"),
        ("가드 발동",        tally["guard"],      "0이어야 함"),
        (f"'{kept}' 언급",   tally["kept"],       "잘 지킨 곳을 짚었는가"),
    ]
    for name, v, note in rows:
        print(f"  {name:<16}{v:>3}/{N}   {note}")
    print()
    print(f"  평균 {avg_s:.1f}문장 · 평균 최장 문장 {avg_l:.0f}자 "
          f"(목표: 4문장 이하, 50자 안팎)")


if __name__ == "__main__":
    main()
