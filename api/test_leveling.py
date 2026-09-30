from sqlmodel import Session, select
from models import engine, User
from services.leveling import process_challenge_completion

with Session(engine) as session:
    user = session.exec(select(User)).first()

    print(f"[시작] level={user.current_level}, xp={user.total_xp}, points={user.current_points}")

    result = process_challenge_completion(session, user, xp_reward=10)
    print("케이스1 (소량 XP, 레벨업 없어야 함):", result)

    result = process_challenge_completion(session, user, xp_reward=100)
    print("케이스2 (레벨업 발생해야 함):", result)

    print(f"[종료] level={user.current_level}, xp={user.total_xp}, points={user.current_points}")