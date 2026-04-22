import hashlib
import json
import os
import pickle
import traceback
import numpy as np
import pandas as pd
import anthropic
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

# ── 앱 상태 / 캐시 ───────────────────────────────────────────
state: dict = {}
diagnose_cache: dict = {}

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

    print(f"ANTHROPIC_API_KEY 설정 여부: {'설정됨' if os.environ.get('ANTHROPIC_API_KEY') else '없음'}")
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

# ── /diagnose 스키마 ─────────────────────────────────────────
class CampaignInfo(BaseModel):
    industry: str
    platform: str
    budget: float
    impressions: int
    clicks: int
    conversions: int
    revenue: float

class MetricsInfo(BaseModel):
    ctr: float
    cpc: float
    cvr: float
    cpa: float
    roas: float

class BenchmarkStats(BaseModel):
    avg: float
    p25: float
    p75: float

class BenchmarksInfo(BaseModel):
    ctr: BenchmarkStats
    cpc: BenchmarkStats
    cvr: BenchmarkStats
    cpa: BenchmarkStats
    roas: BenchmarkStats

class DiagnoseRequest(BaseModel):
    campaign: CampaignInfo
    metrics: MetricsInfo
    benchmarks: BenchmarksInfo

class MetricAnalysis(BaseModel):
    metric: str
    status: str
    cause_estimate: str
    cascade_effect: str

class MetricRelationship(BaseModel):
    pattern: str
    interpretation: str

class IndustryPlatformContext(BaseModel):
    key_metric: str
    insight: str

class ActionItem(BaseModel):
    action: str
    expected_impact: str

class ActionItems(BaseModel):
    immediate: list[ActionItem]
    next_cycle: list[ActionItem]
    long_term: list[ActionItem]

class BudgetEfficiency(BaseModel):
    verdict: str
    reasoning: str
    suggestion: str

class DiagnoseResponse(BaseModel):
    per_metric_analysis: list[MetricAnalysis]
    metric_relationships: list[MetricRelationship]
    industry_platform_context: IndustryPlatformContext
    action_items: ActionItems
    budget_efficiency: BudgetEfficiency

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

@app.post("/diagnose", response_model=DiagnoseResponse)
def diagnose(req: DiagnoseRequest):
    try:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY가 설정되지 않았습니다.")

        # SHA-256 캐시 키
        cache_key = hashlib.sha256(
            json.dumps(req.model_dump(), sort_keys=True, ensure_ascii=False).encode()
        ).hexdigest()
        if cache_key in diagnose_cache:
            return diagnose_cache[cache_key]

        c = req.campaign
        m = req.metrics
        b = req.benchmarks

        json_schema = """{
  "per_metric_analysis": [
    {"metric": "string", "status": "string", "cause_estimate": "string", "cascade_effect": "string"}
  ],
  "metric_relationships": [
    {"pattern": "string", "interpretation": "string"}
  ],
  "industry_platform_context": {"key_metric": "string", "insight": "string"},
  "action_items": {
    "immediate":  [{"action": "string", "expected_impact": "string"}],
    "next_cycle": [{"action": "string", "expected_impact": "string"}],
    "long_term":  [{"action": "string", "expected_impact": "string"}]
  },
  "budget_efficiency": {"verdict": "string", "reasoning": "string", "suggestion": "string"}
}"""

        user_prompt = f"""
[캠페인 정보]
업종: {c.industry} / 플랫폼: {c.platform} / 예산: ${c.budget}
노출: {c.impressions} / 클릭: {c.clicks} / 전환: {c.conversions} / 매출: ${c.revenue}

[내 지표]
CTR {m.ctr}% | CPC ${m.cpc} | CVR {m.cvr}% | CPA ${m.cpa} | ROAS {m.roas}

[업종 벤치마크 (평균 / p25 / p75)]
CTR:  {b.ctr.avg}% / {b.ctr.p25}% / {b.ctr.p75}%
CPC:  ${b.cpc.avg} / ${b.cpc.p25} / ${b.cpc.p75}
CVR:  {b.cvr.avg}% / {b.cvr.p25}% / {b.cvr.p75}%
CPA:  ${b.cpa.avg} / ${b.cpa.p25} / ${b.cpa.p75}
ROAS: {b.roas.avg} / {b.roas.p25} / {b.roas.p75}

위 데이터를 분석하여 아래 JSON 스키마로만 응답하세요:
{json_schema}

중요: 각 텍스트 필드는 150자 이내로 간결하게 작성하고,
반드시 완전한 JSON을 반환하세요. 응답이 잘리면 안 됩니다.
"""

        client = anthropic.Anthropic(api_key=api_key)

        def call_claude(system_prompt: str) -> str:
            resp = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=4000,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
            text = resp.content[0].text.strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            return text.strip()

        main_system = (
            "당신은 디지털 광고 성과 분석 전문가입니다. "
            "입력된 캠페인 데이터와 업종 벤치마크를 분석하여 "
            "반드시 지정된 JSON 스키마 형식으로만 응답하세요. "
            "추가 텍스트나 마크다운 없이 JSON만 반환하세요. "
            "모든 분석은 한국어로 작성하세요."
        )
        fallback_system = "JSON만 반환하세요. 각 텍스트 필드는 100자 이내로 간결하게 작성하세요."

        raw = call_claude(main_system)
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            print("[WARN] /diagnose JSON 파싱 실패, fallback 재시도")
            raw = call_claude(fallback_system)
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError as e:
                print(f"[ERROR] /diagnose fallback 후에도 JSON 파싱 실패: {e}")
                raise HTTPException(status_code=500, detail=f"JSON 파싱 실패 (재시도 후): {str(e)}")

        result = DiagnoseResponse(**parsed)
        diagnose_cache[cache_key] = result
        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] /diagnose 실패: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
