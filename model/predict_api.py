import os
import pickle
import numpy as np
import pandas as pd
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# ── 모델 경로 ────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(__file__)
MODEL_PATH  = os.path.join(BASE_DIR, "lgbm_model.pkl")
LE_PATH     = os.path.join(BASE_DIR, "label_encoders.pkl")

# 학습 시 사용한 전체 피처 순서 (train_model.py 기준)
FEATURE_ORDER = [
    "C1", "banner_pos",
    "site_id", "site_domain", "site_category",
    "app_id", "app_domain", "app_category",
    "device_id", "device_ip", "device_model",
    "device_type", "device_conn_type",
    "C14", "C15", "C16", "C17", "C18", "C19", "C20", "C21",
    "hour_of_day", "day_of_week",
]

# 범주형 컬럼
CAT_COLS = [
    "site_id", "site_domain", "site_category",
    "app_id", "app_domain", "app_category",
    "device_id", "device_ip", "device_model",
]

# 기본값 (요청에 없는 피처는 아래 값으로 채움)
DEFAULTS = {
    "site_id": "unknown",
    "site_domain": "unknown",
    "app_id": "unknown",
    "app_domain": "unknown",
    "device_id": "unknown",
    "device_ip": "unknown",
    "device_model": "unknown",
    "C20": 0,
}

# ── 앱 상태 ──────────────────────────────────────────────────
state: dict = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    with open(MODEL_PATH, "rb") as f:
        state["model"] = pickle.load(f)
    with open(LE_PATH, "rb") as f:
        state["label_encoders"] = pickle.load(f)

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    if supabase_url and supabase_key:
        state["supabase"] = create_client(supabase_url, supabase_key)
    else:
        state["supabase"] = None

    print("모델 및 Supabase 클라이언트 로드 완료")
    yield
    state.clear()

app = FastAPI(
    title="CTR Prediction API",
    description="LightGBM 기반 광고 클릭률(CTR) 예측 API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 스키마 ───────────────────────────────────────────────────
class PredictRequest(BaseModel):
    site_category: str      = "50e219e0"
    app_category: str       = "07d7df22"
    banner_pos: int         = 0
    device_type: int        = 1
    device_conn_type: int   = 0
    hour_of_day: int        = 14
    day_of_week: int        = 1
    C1: int                 = 1005
    C14: int                = 21689
    C15: int                = 250
    C16: int                = 250
    C17: int                = 1722
    C18: int                = 0
    C19: int                = 35
    C21: int                = 221

class BenchmarkComparison(BaseModel):
    industry_avg_ctr: float
    performance: str

class PredictResponse(BaseModel):
    predicted_ctr: float
    click_probability: float
    confidence: str
    benchmark_comparison: BenchmarkComparison

# ── 헬퍼 ─────────────────────────────────────────────────────
def encode_categorical(row: dict, label_encoders: dict) -> dict:
    for col in CAT_COLS:
        le = label_encoders.get(col)
        val = str(row.get(col, "unknown"))
        if le is None:
            row[col] = -1
        elif val in le.classes_:
            row[col] = int(le.transform([val])[0])
        else:
            row[col] = -1
    return row

def get_confidence(prob: float) -> str:
    if prob < 0.1:
        return "low"
    elif prob < 0.3:
        return "medium"
    return "high"

def get_benchmark(supabase: Client | None) -> float:
    default_ctr = 0.045
    if supabase is None:
        return default_ctr
    try:
        res = (
            supabase.table("benchmarks")
            .select("avg_ctr")
            .eq("channel", "google_search")
            .limit(1)
            .execute()
        )
        if res.data:
            return float(res.data[0]["avg_ctr"])
    except Exception:
        pass
    return default_ctr

# ── 엔드포인트 ────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "ok"}

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": "model" in state,
        "supabase_connected": state.get("supabase") is not None,
    }

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    model          = state.get("model")
    label_encoders = state.get("label_encoders")
    if model is None:
        raise HTTPException(status_code=503, detail="모델이 로드되지 않았습니다.")

    # 요청 데이터를 피처 딕셔너리로 변환 (기본값 병합)
    row = {**DEFAULTS, **req.model_dump()}

    # 범주형 인코딩
    row = encode_categorical(row, label_encoders)

    # 피처 순서 맞춰 DataFrame 생성
    X = pd.DataFrame([{col: row.get(col, 0) for col in FEATURE_ORDER}])

    prob = float(model.predict_proba(X)[0][1])
    ctr  = round(prob, 6)

    # 벤치마크 비교
    industry_avg = get_benchmark(state.get("supabase"))
    if prob >= industry_avg * 1.1:
        performance = "above_average"
    elif prob >= industry_avg * 0.9:
        performance = "average"
    else:
        performance = "below_average"

    return PredictResponse(
        predicted_ctr=ctr,
        click_probability=ctr,
        confidence=get_confidence(prob),
        benchmark_comparison=BenchmarkComparison(
            industry_avg_ctr=round(industry_avg, 4),
            performance=performance,
        ),
    )
