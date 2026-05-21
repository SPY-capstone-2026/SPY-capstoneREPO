from fastapi import FastAPI
from contextlib import asynccontextmanager
from sqlmodel import Session, select
from models import create_db_and_tables, engine, DailyChallenge

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 서버 켜질 때 DB 테이블 자동 생성
    create_db_and_tables()
    yield

app = FastAPI(title="Moni API 서버", lifespan=lifespan)

@app.get("/")
def read_root():
    return {"message": "Moni 백엔드 서버가 살아있습니다! 🚀"}


# ----------------------------------------
# [API 1] 챌린지 생성하기 (POST /challenges)
# ----------------------------------------
# AI 엔진이 결과물을 뱉거나, 프론트에서 챌린지를 저장할 때 호출하는 API입니다.
@app.post("/challenges", summary="새로운 데일리 챌린지 저장")
def create_challenge(challenge: DailyChallenge):
    # Session은 DB와 대화하기 위한 전화기 같은 존재입니다.
    with Session(engine) as session:
        session.add(challenge)     # 수납장에 챌린지 넣기
        session.commit()          # 도장 쾅! 저장 확정
        session.refresh(challenge) # DB가 자동으로 만들어준 id(Auto Increment) 반영하기
        return {"status": "success", "data": challenge}


# ----------------------------------------
# [API 2] 모든 챌린지 조회하기 (GET /challenges)
# ----------------------------------------
# 저장된 챌린지 히스토리를 프론트엔드 화면에 뿌려줄 때 호출하는 API입니다.
@app.get("/challenges", summary="저장된 모든 챌린지 목록 조회")
def get_all_challenges():
    with Session(engine) as session:
        # DB에서 DailyChallenge 테이블의 모든 데이터를 선택(select)합니다.
        statement = select(DailyChallenge)
        results = session.exec(statement).all()
        return {"status": "success", "count": len(results), "data": results}