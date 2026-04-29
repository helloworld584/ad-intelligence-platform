import base64
import hashlib
import json
import os
import pickle
import re
import traceback
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta, date
import feedparser
import numpy as np
import pandas as pd
import anthropic
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Header, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from sklearn.decomposition import PCA
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import google.genai as genai

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
_gemini_key = os.getenv("GEMINI_API_KEY")
_gemini_client = genai.Client(api_key=_gemini_key) if _gemini_key else None

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

# ── /collect-news 상수 ───────────────────────────────────────
RSS_SOURCES = [
    ("https://searchengineland.com/feed",                    "searchengineland.com"),
    ("https://www.socialmediaexaminer.com/feed/",            "socialmediaexaminer.com"),
    ("https://feeds.feedburner.com/socialmediaexaminer",     "socialmediaexaminer.com"),
]

TAG_KEYWORDS: dict[str, list[str]] = {
    "알고리즘변경": ["algorithm", "update", "change", "ranking", "core update", "알고리즘"],
    "새기능":       ["feature", "launch", "new", "introduces", "announce", "release", "기능"],
    "규제":         ["privacy", "regulation", "policy", "ban", "law", "gdpr", "ftc", "규제"],
    "시장동향":     ["market", "trend", "report", "growth", "revenue", "spend", "share", "시장"],
}

# ── /analyze-competitor 상수 ─────────────────────────────────
CTA_PATTERNS: dict[str, str] = {
    "Learn More": r"더\s*알아보|알아보기|자세히|learn more",
    "Sign Up":    r"가입|회원가입|sign up|등록",
    "Buy Now":    r"구매|구입|지금\s*사|buy now|주문",
    "Get Started":r"시작|get started|시작하기",
    "Try Free":   r"무료\s*체험|무료로|try free|체험",
    "Shop Now":   r"쇼핑|shop now|바로\s*구매",
    "Download":   r"다운로드|download",
    "Subscribe":  r"구독|subscribe",
}

_URGENCY_RE  = re.compile(r"지금|오늘|한정|마감|긴급|only|today|limited|now", re.I)
_NUMBER_RE   = re.compile(r"\d")
_KO_CHAR_RE  = re.compile(r"[가-힯ᄀ-ᇿ㄰-㆏]")
_SPLIT_RE    = re.compile(r"[\s\.,!?;:'\"()\[\]{}<>/\\|@#$%^&*+=~`]+")

_KO_STOPWORDS = {
    "이", "그", "저", "것", "을", "를", "가", "은", "는", "에", "의", "와",
    "과", "도", "만", "로", "으로", "에서", "부터", "까지", "하다", "있다",
    "되다", "없다", "이다", "합니다", "입니다", "있습니다", "없습니다", "됩니다",
    "하여", "해서", "하면", "하고", "위해", "통해", "대한", "및", "또는",
    "그리고", "하지만", "그러나", "더욱", "매우", "아주", "정말", "너무",
    "모든", "이런", "그런", "어떤", "같은", "다른", "여러", "많은", "있는",
    "하는", "되는", "없는", "위한", "통한", "대해",
}

_EN_STOPWORDS = {
    "this", "that", "with", "from", "your", "have", "more", "will", "been",
    "they", "them", "their", "what", "when", "which", "about", "into", "than",
    "also", "just", "like", "some", "very", "know", "make", "time", "year",
    "good", "most", "over", "such", "even", "here", "well", "only", "then",
    "come", "these", "those", "would", "could", "should", "there", "where",
    "other", "after", "before", "through", "during",
}

# ── 앱 상태 / 캐시 ───────────────────────────────────────────
state: dict = {}
diagnose_cache: dict = {}
_impact_cache: dict = {}

# ── Rate Limiting (메모리 기반 일일 카운터) ──────────────────
_DAILY_AI_LIMIT = 5
# { (user_id, date): count }
_daily_counts: dict = defaultdict(int)

def _get_user_id(request: Request) -> str | None:
    """Authorization 헤더에서 Supabase JWT를 파싱해 user_id 반환. 실패 시 None."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[len("Bearer "):]
    supabase = state.get("supabase")
    if supabase is None:
        return None
    try:
        result = supabase.auth.get_user(token)
        return result.user.id if result and result.user else None
    except Exception:
        return None

def _make_hash(data: dict) -> str:
    serialized = json.dumps(data, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(serialized.encode()).hexdigest()

def _check_rate_limit(user_id: str) -> bool:
    """일일 한도 확인 후 카운터 증가. 한도 초과 시 False 반환."""
    key = (user_id, date.today())
    if _daily_counts[key] >= _DAILY_AI_LIMIT:
        return False
    _daily_counts[key] += 1
    return True

@asynccontextmanager
async def lifespan(app: FastAPI):
    with open(MODEL_PATH, "rb") as f:
        state["model"] = pickle.load(f)
    with open(LE_PATH, "rb") as f:
        state["label_encoders"] = pickle.load(f)

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
    if supabase_url and supabase_key:
        state["supabase"] = create_client(supabase_url, supabase_key)
    else:
        state["supabase"] = None

    if supabase_url and SUPABASE_SERVICE_KEY:
        state["supabase_admin"] = create_client(supabase_url, SUPABASE_SERVICE_KEY)
    else:
        state["supabase_admin"] = state["supabase"]

    print(f"ANTHROPIC_API_KEY 설정 여부: {'설정됨' if os.environ.get('ANTHROPIC_API_KEY') else '없음'}")
    print(f"SUPABASE_SERVICE_KEY 설정 여부: {'설정됨' if SUPABASE_SERVICE_KEY else '없음'}")
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

# ── /campaigns 스키마 ────────────────────────────────────────
class CampaignCreate(BaseModel):
    campaign_name: str | None = None
    industry: str
    platform: str
    budget: float | None = None
    impressions: int | None = None
    clicks: int | None = None
    conversions: int | None = None
    revenue: float | None = None
    ctr: float | None = None
    cpc: float | None = None
    cvr: float | None = None
    cpa: float | None = None
    roas: float | None = None
    ai_diagnosis: dict | None = None
    notes: str | None = None

# ── /analyze-anomaly 스키마 ──────────────────────────────────
class AnomalyMetrics(BaseModel):
    ctr: float | None = None
    cpc: float | None = None
    cvr: float | None = None
    cpa: float | None = None
    roas: float | None = None

class AnomalyRequest(BaseModel):
    industry: str
    platform: str
    metrics: AnomalyMetrics

class ContributingMetric(BaseModel):
    metric: str
    z_score: float
    direction: str  # "above" | "below"
    interpretation: str

class AnomalyResponse(BaseModel):
    mahalanobis_distance: float
    status: str
    status_en: str
    contributing_metrics: list[ContributingMetric]
    pattern_insight: str
    available_metrics: list[str]

# ── /analyze-semantic-gap 스키마 ─────────────────────────────
class SemanticGapRequest(BaseModel):
    my_copies: list[str]
    competitor_copies: list[str]

class SimilarCopy(BaseModel):
    copy: str
    similarity: float

class GapCopy(BaseModel):
    copy: str
    similarity: float

class SemanticGapResponse(BaseModel):
    avg_similarity: float
    my_diversity: float
    competitor_diversity: float
    most_similar_competitors: list[SimilarCopy]
    gap_copies: list[GapCopy]
    insight: str
    positioning_map: list[dict] | None = None

# ── /analyze-image 스키마 ─────────────────────────────────────
class ImageScoreItem(BaseModel):
    score: int
    comment: str

class ImageVisualComplexity(BaseModel):
    level: str
    comment: str

class ImageAnalysisResponse(BaseModel):
    text_readability: ImageScoreItem
    cta_visibility: ImageScoreItem
    visual_complexity: ImageVisualComplexity
    color_contrast: ImageScoreItem
    overall_score: int
    top_recommendations: list[str]

# ── /collect-news 스키마 ─────────────────────────────────────
class CollectNewsResponse(BaseModel):
    collected: int
    inserted: int
    skipped: int
    updated_existing: int = 0
    sources: list[str]

# ── /generate-impact 스키마 ──────────────────────────────────
class ImpactRequest(BaseModel):
    title: str
    summary: str
    tags: list[str]

class ImpactResponse(BaseModel):
    impact_comment: str

# ── /analyze-creative 스키마 ─────────────────────────────────
class AnalyzeCreativeRequest(BaseModel):
    copy_text: str
    platform: str
    industry: str
    has_image: bool

class ItemScore(BaseModel):
    name: str
    score: int
    description: str

class AnalyzeCreativeResponse(BaseModel):
    overall_score: int
    item_scores: list[ItemScore]
    strengths: list[str]
    improvements: list[str]

# ── /analyze-competitor 스키마 ────────────────────────────────
class CompetitorRequest(BaseModel):
    texts: list[str]
    brand_name: str | None = None

class KeywordItem(BaseModel):
    word: str
    count: int

class LinguisticFeaturesResponse(BaseModel):
    has_question_ratio: float
    has_number_ratio: float
    has_urgency_ratio: float
    has_emoji_ratio: float
    avg_length: float
    length_distribution: dict[str, int]

class CompetitorResponse(BaseModel):
    total_count: int
    cta_distribution: dict[str, int]
    linguistic_features: LinguisticFeaturesResponse
    top_keywords: list[KeywordItem]
    interpretation: str

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
def diagnose(req: DiagnoseRequest, request: Request):
    try:
        user_id = _get_user_id(request)
        if user_id is None:
            raise HTTPException(status_code=401, detail="AI 기능은 로그인이 필요합니다.")
        if not _check_rate_limit(user_id):
            raise HTTPException(status_code=429, detail="일일 AI 분석 한도(5회)를 초과했습니다. 내일 다시 시도해주세요.")

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

# ── /analyze-competitor 헬퍼 ─────────────────────────────────
def _has_emoji(text: str) -> bool:
    for ch in text:
        cp = ord(ch)
        if (0x1F300 <= cp <= 0x1FAFF or 0x2600 <= cp <= 0x27BF):
            return True
    return False

def _classify_cta(text: str) -> list[str]:
    found = []
    for label, pattern in CTA_PATTERNS.items():
        if re.search(pattern, text, re.I):
            found.append(label)
    return found

def _analyze_linguistics(texts: list[str]) -> LinguisticFeaturesResponse:
    n = len(texts)
    q = num = urg = emo = 0
    lengths = []
    for t in texts:
        if "?" in t:
            q += 1
        if _NUMBER_RE.search(t):
            num += 1
        if _URGENCY_RE.search(t):
            urg += 1
        if _has_emoji(t):
            emo += 1
        lengths.append(len(t))

    short = sum(1 for l in lengths if l <= 30)
    medium = sum(1 for l in lengths if 30 < l <= 80)
    long_ = sum(1 for l in lengths if l > 80)

    return LinguisticFeaturesResponse(
        has_question_ratio=round(q / n, 4),
        has_number_ratio=round(num / n, 4),
        has_urgency_ratio=round(urg / n, 4),
        has_emoji_ratio=round(emo / n, 4),
        avg_length=round(sum(lengths) / n, 2),
        length_distribution={"short": short, "medium": medium, "long": long_},
    )

def _extract_keywords(texts: list[str]) -> list[KeywordItem]:
    counter: Counter = Counter()
    for text in texts:
        tokens = _SPLIT_RE.split(text)
        for token in tokens:
            token = token.strip()
            if not token:
                continue
            if _KO_CHAR_RE.search(token):
                if len(token) >= 2 and token not in _KO_STOPWORDS:
                    counter[token] += 1
            else:
                word = token.lower()
                if len(word) >= 4 and word.isalpha() and word not in _EN_STOPWORDS:
                    counter[word] += 1
    return [KeywordItem(word=w, count=c) for w, c in counter.most_common(20)]

@app.post("/analyze-competitor", response_model=CompetitorResponse)
def analyze_competitor(req: CompetitorRequest, request: Request):
    try:
        if not req.texts:
            raise HTTPException(status_code=422, detail="texts는 비어 있을 수 없습니다.")

        user_id = _get_user_id(request)
        if user_id is None:
            raise HTTPException(status_code=401, detail="AI 기능은 로그인이 필요합니다.")
        if not _check_rate_limit(user_id):
            raise HTTPException(status_code=429, detail="일일 AI 분석 한도(5회)를 초과했습니다. 내일 다시 시도해주세요.")

        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY가 설정되지 않았습니다.")

        texts = req.texts
        n = len(texts)

        # CTA 분포
        cta_dist: Counter = Counter()
        for t in texts:
            for label in _classify_cta(t):
                cta_dist[label] += 1

        # 언어 특성
        ling = _analyze_linguistics(texts)

        # 키워드 빈도
        keywords = _extract_keywords(texts)

        # Claude 인사이트 생성
        stats_payload = {
            "brand_name": req.brand_name,
            "total_count": n,
            "cta_distribution": dict(cta_dist),
            "linguistic_features": ling.model_dump(),
            "top_keywords": [k.model_dump() for k in keywords[:10]],
        }

        client = anthropic.Anthropic(api_key=api_key)
        resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            system=(
                "당신은 디지털 광고 카피라이팅 전문가입니다. "
                "제공된 광고 텍스트 분석 데이터를 바탕으로 "
                "해당 브랜드의 광고 전략 패턴을 한국어로 간결하게 해석하세요. "
                "구체적인 수치를 인용하며 2-3문장으로 작성하세요."
            ),
            messages=[{
                "role": "user",
                "content": (
                    f"다음 광고 분석 데이터를 해석해주세요:\n"
                    f"{json.dumps(stats_payload, ensure_ascii=False, indent=2)}"
                ),
            }],
        )
        interpretation = resp.content[0].text.strip()

        result = CompetitorResponse(
            total_count=n,
            cta_distribution=dict(cta_dist),
            linguistic_features=ling,
            top_keywords=keywords,
            interpretation=interpretation,
        )
        try:
            supabase_admin = state.get("supabase_admin")
            input_hash = _make_hash(req.model_dump())
            row = {
                "user_id": user_id,
                "input_hash": input_hash,
                "input_json": req.model_dump(),
                "result_json": result.model_dump(),
            }
            supabase_admin.schema("adplatform").table("competitor_analyses").insert(row).execute()
        except Exception:
            pass
        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] /analyze-competitor 실패: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# ── /collect-news 헬퍼 ───────────────────────────────────────
_HTML_TAG_RE = re.compile(r'<[^>]+>')

def _strip_html(text: str) -> str:
    return _HTML_TAG_RE.sub('', text).strip()

def _classify_news_tags(title: str, summary: str) -> list[str]:
    text = f"{title} {summary}".lower()
    return [tag for tag, kws in TAG_KEYWORDS.items() if any(kw in text for kw in kws)]

def _make_impact_comment(title: str, tags: list[str]) -> str:
    if "알고리즘변경" in tags:
        return f"광고주에게 미치는 영향: {title} — 광고 노출 및 성과 변동 가능성, 캠페인 설정 점검 권장"
    if "새기능" in tags:
        return f"광고주에게 미치는 영향: {title} — 새로운 광고 기능 활용 기회, 조기 도입 시 경쟁 우위 확보 가능"
    if "규제" in tags:
        return f"광고주에게 미치는 영향: {title} — 타겟팅 및 데이터 활용 방식 변경 필요, 컴플라이언스 검토 요망"
    if "시장동향" in tags:
        return f"광고주에게 미치는 영향: {title} — 시장 변화에 따른 예산 배분 및 전략 재검토 필요"
    return f"광고주에게 미치는 영향: {title} — 관련 동향 모니터링 및 광고 전략 검토 필요"

def _generate_impact_comment(title: str, summary: str, tags: list[str]) -> str:
    cache_key = hashlib.sha256(f"{title}{summary}".encode()).hexdigest()
    if cache_key in _impact_cache:
        return _impact_cache[cache_key]

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return _make_impact_comment(title, tags)

    try:
        client = anthropic.Anthropic(api_key=api_key)
        resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=300,
            system=(
                "당신은 디지털 광고 전문가입니다. "
                "주어진 업계 뉴스가 광고주에게 미치는 실질적 영향을 "
                "2~3문장으로 간결하게 설명하세요. "
                "수치나 구체적 예시를 포함하면 좋습니다. "
                "마크다운 없이 순수 텍스트만 반환하세요."
            ),
            messages=[{
                "role": "user",
                "content": (
                    f"제목: {title}\n"
                    f"요약: {summary}\n"
                    f"태그: {', '.join(tags)}\n\n"
                    "이 뉴스가 광고주(Google Ads/Meta Ads 운영자)에게 "
                    "미치는 실질적 영향을 2~3문장으로 설명하세요."
                ),
            }],
        )
        result = resp.content[0].text.strip()
        _impact_cache[cache_key] = result
        return result
    except Exception as e:
        print(f"[WARN] _generate_impact_comment Claude 호출 실패: {e}")
        return _make_impact_comment(title, tags)

# ── /generate-impact 엔드포인트 ──────────────────────────────
@app.post("/generate-impact", response_model=ImpactResponse)
def generate_impact(req: ImpactRequest):
    comment = _generate_impact_comment(req.title, req.summary, req.tags)
    return ImpactResponse(impact_comment=comment)

@app.post("/collect-news", response_model=CollectNewsResponse)
def collect_news(x_cron_secret: str | None = Header(default=None)):
    cron_secret = os.getenv("CRON_SECRET")
    if not cron_secret or x_cron_secret != cron_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")

    supabase_admin = state.get("supabase_admin")
    if supabase_admin is None:
        raise HTTPException(status_code=503, detail="Supabase가 연결되지 않았습니다.")

    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    all_rows: list[dict] = []
    active_sources: set[str] = set()

    for feed_url, source_name in RSS_SOURCES:
        try:
            feed = feedparser.parse(feed_url)
            for entry in feed.entries:
                url = entry.get("link", "")
                if not url:
                    continue

                if entry.get("published_parsed"):
                    pub_dt = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
                else:
                    pub_dt = datetime.now(timezone.utc)

                if pub_dt < cutoff:
                    continue

                title = entry.get("title", "")
                raw_summary = entry.get("summary", entry.get("description", ""))
                summary = _strip_html(raw_summary)[:200]

                tags = _classify_news_tags(title, summary)
                impact_comment = _make_impact_comment(title, tags)

                all_rows.append({
                    "title": title,
                    "url": url,
                    "published_at": pub_dt.isoformat(),
                    "source": source_name,
                    "summary": summary,
                    "tags": tags,
                    "impact_comment": impact_comment,
                })
                active_sources.add(source_name)
        except Exception as e:
            print(f"[WARN] RSS 수집 실패 ({feed_url}): {e}")
            continue

    if not all_rows:
        return CollectNewsResponse(collected=0, inserted=0, skipped=0, updated_existing=0, sources=[])

    # 기존 URL 조회 → 신규만 삽입
    url_list = [r["url"] for r in all_rows]
    existing_res = (
        supabase_admin.schema("adplatform")
        .table("industry_news")
        .select("url")
        .in_("url", url_list)
        .execute()
    )
    existing_urls = {r["url"] for r in existing_res.data} if existing_res.data else set()

    new_rows = [r for r in all_rows if r["url"] not in existing_urls]
    skipped = len(all_rows) - len(new_rows)

    # 신규 뉴스 최대 10건에 한해 Claude API로 impact_comment 생성 (나머지는 템플릿 유지)
    for i, row in enumerate(new_rows[:10]):
        try:
            print(f"[INFO] 신규 뉴스 {i+1}번째 impact 생성: {row['title'][:30]}")
            row["impact_comment"] = _generate_impact_comment(
                row["title"], row["summary"], row["tags"]
            )
        except Exception as e:
            print(f"[WARN] 신규 뉴스 impact_comment 생성 실패: {e}")

    if new_rows:
        supabase_admin.schema("adplatform").table("industry_news").insert(new_rows).execute()

    # 기존 뉴스 중 impact_comment가 null이거나 기존 템플릿인 행 최대 10건 업데이트
    updated_existing = 0
    try:
        null_res = (
            supabase_admin.schema("adplatform")
            .table("industry_news")
            .select("id, title, summary, tags")
            .is_("impact_comment", "null")
            .order("published_at", desc=True)
            .limit(10)
            .execute()
        )
        stale_rows = list(null_res.data or [])
        print(f"[INFO] impact_comment null 뉴스 {len(stale_rows)}건 발견")

        remaining = 10 - len(stale_rows)
        if remaining > 0:
            tmpl_res = (
                supabase_admin.schema("adplatform")
                .table("industry_news")
                .select("id, title, summary, tags")
                .like("impact_comment", "%관련 동향 모니터링%")
                .order("published_at", desc=True)
                .limit(remaining)
                .execute()
            )
            tmpl_rows = list(tmpl_res.data or [])
            print(f"[INFO] impact_comment 템플릿 뉴스 {len(tmpl_rows)}건 발견")
            stale_rows += tmpl_rows

        for i, row in enumerate(stale_rows):
            try:
                print(f"[INFO] {i+1}번째 뉴스 impact 생성: {row['title'][:30]}")
                comment = _generate_impact_comment(
                    row["title"],
                    row.get("summary") or "",
                    row.get("tags") or [],
                )
                (
                    supabase_admin.schema("adplatform")
                    .table("industry_news")
                    .update({"impact_comment": comment})
                    .eq("id", row["id"])
                    .execute()
                )
                updated_existing += 1
            except Exception as e:
                print(f"[WARN] impact_comment UPDATE 실패 (id={row['id']}): {e}")
    except Exception as e:
        print(f"[WARN] 기존 뉴스 impact_comment 업데이트 조회 실패: {e}")

    return CollectNewsResponse(
        collected=len(all_rows),
        inserted=len(new_rows),
        skipped=skipped,
        updated_existing=updated_existing,
        sources=sorted(active_sources),
    )

@app.post("/analyze-creative", response_model=AnalyzeCreativeResponse)
def analyze_creative(req: AnalyzeCreativeRequest, request: Request):
    try:
        user_id = _get_user_id(request)
        if user_id is None:
            raise HTTPException(status_code=401, detail="AI 기능은 로그인이 필요합니다.")
        if not _check_rate_limit(user_id):
            raise HTTPException(status_code=429, detail="일일 AI 분석 한도(5회)를 초과했습니다. 내일 다시 시도해주세요.")

        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY가 설정되지 않았습니다.")

        json_schema = """{
  "overall_score": 0-100,
  "item_scores": [
    {"name": "명확성", "score": 0-100, "description": "string"},
    {"name": "관련성", "score": 0-100, "description": "string"},
    {"name": "행동유도", "score": 0-100, "description": "string"},
    {"name": "긴급성", "score": 0-100, "description": "string"},
    {"name": "감성", "score": 0-100, "description": "string"}
  ],
  "strengths": ["string"],
  "improvements": ["string"]
}"""

        user_prompt = f"""
다음 광고 카피를 분석하여 품질 점수를 매겨주세요:

[광고 정보]
플랫폼: {req.platform}
업종: {req.industry}
이미지 포함: {'예' if req.has_image else '아니오'}

[광고 텍스트]
{req.copy_text}

분석 기준:
- 명확성: 메시지가 명확하고 이해하기 쉬운지
- 관련성: 타겟 고객과 플랫폼에 적합한지
- 행동유도: CTA가 명확하고 강력한지
- 긴급성: 긴급성 요소가 포함되어 있는지
- 감성: 감정적 호소가 효과적인지

위 JSON 스키마로만 응답하세요. 각 설명은 50자 이내로 간결하게 작성하세요.
"""

        client = anthropic.Anthropic(api_key=api_key)

        def call_claude(system_prompt: str) -> str:
            resp = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=2000,
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
            "당신은 디지털 광고 카피 품질 분석 전문가입니다. "
            "입력된 광고 카피를 분석하여 반드시 다음 JSON 스키마 형식으로만 응답하세요. "
            "추가 텍스트나 마크다운 없이 JSON만 반환하세요. "
            "모든 분석은 한국어로 작성하세요.\n\n"
            "반환 JSON 스키마 (필드명을 정확히 사용하세요):\n"
            '{"overall_score": <0-100 정수>, '
            '"item_scores": [{"name": "string", "score": <0-100 정수>, "description": "string"}, ...], '
            '"strengths": ["string", ...], '
            '"improvements": ["string", ...]}'
        )
        fallback_system = (
            "JSON만 반환하세요. 필드명: overall_score, item_scores(name/score/description), "
            "strengths, improvements. 각 텍스트 필드는 50자 이내."
        )

        raw = call_claude(main_system)
        print(f"[DEBUG] Claude 응답: {raw[:500]}")
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            print("[WARN] /analyze-creative JSON 파싱 실패, fallback 재시도")
            raw = call_claude(fallback_system)
            print(f"[DEBUG] Claude fallback 응답: {raw[:500]}")
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError as e:
                print(f"[ERROR] /analyze-creative fallback 후에도 JSON 파싱 실패: {e}")
                raise HTTPException(status_code=500, detail=f"JSON 파싱 실패 (재시도 후): {str(e)}")

        # Claude가 다른 필드명으로 응답한 경우 item_scores로 리매핑
        if "item_scores" not in parsed:
            for alt_key in ("dimension_scores", "criteria_scores", "scores", "items"):
                if alt_key in parsed:
                    print(f"[WARN] 필드명 리매핑: '{alt_key}' → 'item_scores'")
                    parsed["item_scores"] = parsed.pop(alt_key)
                    break

        result = AnalyzeCreativeResponse(**parsed)
        try:
            supabase_admin = state.get("supabase_admin")
            input_hash = _make_hash(req.model_dump())
            row = {
                "user_id": user_id,
                "input_hash": input_hash,
                "input_json": req.model_dump(),
                "result_json": result.model_dump(),
            }
            supabase_admin.schema("adplatform").table("creative_analyses").insert(row).execute()
        except Exception:
            pass
        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] /analyze-creative 실패: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# ── /campaigns 엔드포인트 ────────────────────────────────────
@app.post("/campaigns", status_code=201)
def create_campaign(req: CampaignCreate, request: Request):
    user_id = _get_user_id(request)
    if user_id is None:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")

    supabase_admin = state.get("supabase_admin")
    if supabase_admin is None:
        raise HTTPException(status_code=503, detail="Supabase가 연결되지 않았습니다.")

    try:
        row = {"user_id": user_id, **req.model_dump(exclude_none=True)}
        res = supabase_admin.schema("adplatform").table("campaigns").insert(row).execute()
        inserted = res.data[0]
        return {"id": inserted["id"], "recorded_at": inserted["recorded_at"]}
    except Exception as e:
        print(f"[ERROR] POST /campaigns 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/campaigns")
def list_campaigns(request: Request):
    user_id = _get_user_id(request)
    if user_id is None:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")

    supabase_admin = state.get("supabase_admin")
    if supabase_admin is None:
        raise HTTPException(status_code=503, detail="Supabase가 연결되지 않았습니다.")

    try:
        res = (
            supabase_admin.schema("adplatform")
            .table("campaigns")
            .select("*")
            .eq("user_id", user_id)
            .order("recorded_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception as e:
        print(f"[ERROR] GET /campaigns 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/campaigns/{campaign_id}")
def delete_campaign(campaign_id: str, request: Request):
    user_id = _get_user_id(request)
    if user_id is None:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")

    supabase_admin = state.get("supabase_admin")
    if supabase_admin is None:
        raise HTTPException(status_code=503, detail="Supabase가 연결되지 않았습니다.")

    try:
        res = (
            supabase_admin.schema("adplatform")
            .table("campaigns")
            .delete()
            .eq("id", campaign_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="캠페인을 찾을 수 없거나 권한이 없습니다.")
        return {"deleted": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] DELETE /campaigns/{campaign_id} 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ── /analyze-anomaly 헬퍼 ────────────────────────────────────
_LOWER_IS_BETTER = {"cpc", "cpa"}

_METRIC_LABELS = {"ctr": "CTR", "cpc": "CPC", "cvr": "CVR", "cpa": "CPA", "roas": "ROAS"}

_METRIC_INTERPRETATIONS: dict[tuple[str, str], str] = {
    ("ctr", "above"): "CTR이 업종 평균 대비 높은 수준으로 광고 소재 효율이 우수함",
    ("ctr", "below"): "CTR이 업종 평균 대비 통계적으로 낮은 수준",
    ("cpc", "above"): "CPC가 업종 평균보다 낮아 클릭 비용 효율이 좋음",
    ("cpc", "below"): "CPC가 업종 평균보다 높아 클릭당 비용 부담이 큼",
    ("cvr", "above"): "CVR이 업종 평균 대비 높아 랜딩 페이지 효율이 우수함",
    ("cvr", "below"): "CVR이 업종 평균 대비 낮아 전환 경로 점검이 필요함",
    ("cpa", "above"): "CPA가 업종 평균보다 낮아 전환 비용이 효율적임",
    ("cpa", "below"): "CPA가 업종 평균보다 높아 전환당 비용이 과다함",
    ("roas", "above"): "ROAS가 업종 평균 대비 높아 광고 수익성이 우수함",
    ("roas", "below"): "ROAS가 업종 평균 대비 낮아 광고 수익성 개선이 필요함",
}

def _get_pattern_insight(contributing: list[ContributingMetric]) -> str:
    if not contributing:
        return "모든 지표가 업종 정상 범위 내에 있습니다."

    below = {c.metric for c in contributing if c.direction == "below"}
    above = {c.metric for c in contributing if c.direction == "above"}

    if "ctr" in below and "cvr" in below:
        return "클릭과 전환 모두 저조 → 광고 소재와 랜딩 페이지 동시 점검 필요"
    if "ctr" in below and "cvr" in above:
        return "클릭은 적지만 전환율 높음 → 타겟이 정교하나 도달 범위가 좁음"
    if "ctr" in above and "cvr" in below:
        return "클릭은 많지만 전환 저조 → 랜딩 페이지 또는 오퍼 문제"
    if "cpc" in below and "roas" in below:
        return "클릭 비용은 낮지만 수익 저조 → 전환 품질 문제"
    if "cpc" in above and "roas" in below:
        return "비용 대비 수익 악화 → 입찰가 또는 예산 배분 재검토"
    if "cpa" in below:
        return "전환 비용이 높음 → 타겟팅 또는 랜딩 페이지 최적화 필요"

    worst = max(contributing, key=lambda c: abs(c.z_score))
    label = _METRIC_LABELS.get(worst.metric, worst.metric)
    return f"{label}가 업종 평균 대비 가장 크게 벗어나 있습니다."

# ── /analyze-anomaly 엔드포인트 ──────────────────────────────
@app.post("/analyze-anomaly", response_model=AnomalyResponse)
def analyze_anomaly(req: AnomalyRequest):
    supabase = state.get("supabase")
    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase가 연결되지 않았습니다.")

    # 1. 벤치마크 조회
    try:
        res = (
            supabase.schema("adplatform")
            .table("benchmarks")
            .select("metric_name, metric_value, percentile_25, percentile_75")
            .eq("industry", req.industry)
            .eq("platform", req.platform)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"벤치마크 조회 실패: {str(e)}")

    if not res.data:
        raise HTTPException(
            status_code=404,
            detail=f"'{req.industry}' / '{req.platform}' 벤치마크 데이터가 없습니다.",
        )

    # 2. 정상 범위 추정 (μ, σ)
    user_vals = req.metrics.model_dump()
    mu: dict[str, float] = {}
    sigma: dict[str, float] = {}

    for row in res.data:
        name = (row.get("metric_name") or "").lower()
        if name not in user_vals or user_vals[name] is None:
            continue
        avg = row.get("metric_value")
        p25 = row.get("percentile_25")
        p75 = row.get("percentile_75")
        if avg is None or p25 is None or p75 is None:
            continue
        std = (float(p75) - float(p25)) / 1.35
        if std <= 0:
            continue
        mu[name] = float(avg)
        sigma[name] = std

    available = sorted(mu.keys())
    if not available:
        raise HTTPException(status_code=422, detail="유효한 벤치마크 지표가 부족합니다.")

    # 3. Mahalanobis Distance (대각 공분산)
    x_vec     = np.array([user_vals[m] for m in available], dtype=float)
    mu_vec    = np.array([mu[m]        for m in available], dtype=float)
    sigma_vec = np.array([sigma[m]     for m in available], dtype=float)

    mahal_dist = float(np.sqrt(np.sum(((x_vec - mu_vec) / sigma_vec) ** 2)))

    # 4. Z-score (CPC·CPA 부호 반전)
    z_scores: dict[str, float] = {}
    for m in available:
        raw_z = (user_vals[m] - mu[m]) / sigma[m]
        z_scores[m] = round(-raw_z if m in _LOWER_IS_BETTER else raw_z, 4)

    # 5. 이상 여부 판별
    if mahal_dist < 2.0:
        status, status_en = "정상", "normal"
    elif mahal_dist < 3.0:
        status, status_en = "주의", "warning"
    else:
        status, status_en = "이상", "anomaly"

    # 6. 이상 기여 지표 식별 (|z| > 1.5)
    contributing: list[ContributingMetric] = []
    for m in available:
        z = z_scores[m]
        if abs(z) > 1.5:
            direction = "above" if z > 0 else "below"
            contributing.append(ContributingMetric(
                metric=m,
                z_score=z,
                direction=direction,
                interpretation=_METRIC_INTERPRETATIONS.get(
                    (m, direction), f"{_METRIC_LABELS.get(m, m)} 이상 감지"
                ),
            ))

    return AnomalyResponse(
        mahalanobis_distance=round(mahal_dist, 4),
        status=status,
        status_en=status_en,
        contributing_metrics=contributing,
        pattern_insight=_get_pattern_insight(contributing),
        available_metrics=available,
    )

# ── /analyze-semantic-gap 엔드포인트 ─────────────────────────
@app.post("/analyze-semantic-gap", response_model=SemanticGapResponse)
def analyze_semantic_gap(req: SemanticGapRequest):
    if not req.my_copies:
        raise HTTPException(status_code=422, detail="my_copies는 비어 있을 수 없습니다.")
    if not req.competitor_copies:
        raise HTTPException(status_code=422, detail="competitor_copies는 비어 있을 수 없습니다.")

    all_copies = req.my_copies + req.competitor_copies
    n = len(req.my_copies)

    # Gemini text-embedding-004 (TF-IDF fallback)
    try:
        if _gemini_client is None:
            raise ValueError("GEMINI_API_KEY not set")
        result = _gemini_client.models.embed_content(
            model="text-embedding-004",
            contents=all_copies,
        )
        embeddings = np.array([e.values for e in result.embeddings])
    except Exception:
        vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), max_features=5000)
        embeddings = vectorizer.fit_transform(all_copies).toarray()

    my_mat   = embeddings[:n]
    comp_mat = embeddings[n:]

    # A. 내 광고 vs 경쟁사 평균 유사도
    sim          = cosine_similarity(my_mat, comp_mat)
    avg_sim      = float(sim.mean())

    # B. 내 광고 다양성 (카피가 1개면 다양성 1.0)
    if n > 1:
        ms = cosine_similarity(my_mat, my_mat)
        np.fill_diagonal(ms, 0)
        my_div = float(1 - ms.mean())
    else:
        my_div = 1.0

    # C. 경쟁사 다양성
    nc = len(req.competitor_copies)
    if nc > 1:
        cs = cosine_similarity(comp_mat, comp_mat)
        np.fill_diagonal(cs, 0)
        comp_div = float(1 - cs.mean())
    else:
        comp_div = 1.0

    # D & E. 경쟁사 카피별 평균 유사도로 top/bottom 추출
    avg_per_comp = sim.mean(axis=0)
    top3_idx     = avg_per_comp.argsort()[-3:][::-1]
    gap3_idx     = avg_per_comp.argsort()[:3]

    most_similar = [
        SimilarCopy(copy=req.competitor_copies[i], similarity=round(float(avg_per_comp[i]), 4))
        for i in top3_idx
    ]
    gap_copies = [
        GapCopy(copy=req.competitor_copies[i], similarity=round(float(avg_per_comp[i]), 4))
        for i in gap3_idx
    ]

    # 인사이트
    if avg_sim >= 0.7:
        insight = "내 광고가 경쟁사와 매우 유사 → 차별화 전략 필요"
    elif avg_sim >= 0.4:
        insight = "경쟁사와 유사한 메시지 → 일부 차별화 요소 추가 권장"
    else:
        insight = "경쟁사와 차별화된 메시지 → 독자적 포지셔닝 유지"

    if my_div < 0.3:
        insight += ". 내 광고들이 매우 유사 → 다양한 소재 테스트 권장"

    # PCA 포지셔닝 맵 (5건 이상일 때만)
    positioning_map = None
    if len(all_copies) >= 5:
        try:
            reducer = PCA(n_components=2, random_state=42)
            coords_2d = reducer.fit_transform(embeddings)
            positioning_map = [
                {
                    "text": copy_text,
                    "x": float(coords_2d[i][0]),
                    "y": float(coords_2d[i][1]),
                    "is_mine": i < n,
                }
                for i, copy_text in enumerate(all_copies)
            ]
        except Exception:
            positioning_map = None

    return SemanticGapResponse(
        avg_similarity=round(avg_sim, 4),
        my_diversity=round(my_div, 4),
        competitor_diversity=round(comp_div, 4),
        most_similar_competitors=most_similar,
        gap_copies=gap_copies,
        insight=insight,
        positioning_map=positioning_map,
    )

# ── /analyze-image 엔드포인트 ────────────────────────────────
_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
_MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5MB

@app.post("/analyze-image", response_model=ImageAnalysisResponse)
async def analyze_image(
    request: Request,
    image: UploadFile = File(...),
    industry: str = Form(default="general"),
    platform: str = Form(default="general"),
):
    try:
        user_id = _get_user_id(request)
        if user_id is None:
            raise HTTPException(status_code=401, detail="AI 기능은 로그인이 필요합니다.")
        if not _check_rate_limit(user_id):
            raise HTTPException(status_code=429, detail="일일 AI 분석 한도(5회)를 초과했습니다. 내일 다시 시도해주세요.")

        content_type = image.content_type or ""
        if content_type not in _ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="이미지 파일만 허용됩니다. (jpeg, png, gif, webp)")

        image_bytes = await image.read()
        if len(image_bytes) > _MAX_IMAGE_BYTES:
            raise HTTPException(status_code=400, detail="파일 크기는 5MB 이하여야 합니다.")

        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY가 설정되지 않았습니다.")

        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        client = anthropic.Anthropic(api_key=api_key)
        resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            system="You are an expert advertising creative analyst. Analyze the provided ad image and return a JSON object only, no other text.",
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": content_type,
                            "data": image_b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            'Analyze this advertising image and return ONLY a JSON object with this exact structure:\n'
                            '{\n'
                            '  "text_readability": { "score": 1-5, "comment": "one sentence" },\n'
                            '  "cta_visibility": { "score": 1-5, "comment": "one sentence" },\n'
                            '  "visual_complexity": { "level": "low|medium|high", "comment": "one sentence" },\n'
                            '  "color_contrast": { "score": 1-5, "comment": "one sentence" },\n'
                            '  "overall_score": 1-5,\n'
                            '  "top_recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]\n'
                            '}\n'
                            f'Industry context: {industry}, Platform: {platform}'
                        ),
                    },
                ],
            }],
        )

        raw = resp.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=500, detail=f"응답 JSON 파싱 실패: {str(e)}")

        return ImageAnalysisResponse(**parsed)

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] /analyze-image 실패: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
