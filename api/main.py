import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "ai"))

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models import create_db_and_tables

from routers import (
    auth_router,
    users_router,
    transactions_router,
    categories_router,
    reports_router,
    challenges_router,
    shop_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(title="Moni API 서버", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:19006",
        "http://127.0.0.1:19006",
        "https://spy-capstone-repo.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(users_router.router)
app.include_router(transactions_router.router)
app.include_router(categories_router.router)
app.include_router(reports_router.router)
app.include_router(challenges_router.router)
app.include_router(shop_router.router)


@app.get("/")
def read_root():
    return {"message": "Moni 백엔드 서버가 살아있습니다! 🚀"}
