import hashlib
import json
import os
import pickle
import re
import traceback
from collections import Counter
from datetime import datetime, timezone, timedelta
import feedparser
import numpy as np
import pandas as pd
import anthropic
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header
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

# ── /collect-news 스키마 ─────────────────────────────────────
class CollectNewsResponse(BaseModel):
    collected: int
    inserted: int
    skipped: int
    sources: list[str]

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
def analyze_competitor(req: CompetitorRequest):
    try:
        if not req.texts:
            raise HTTPException(status_code=422, detail="texts는 비어 있을 수 없습니다.")

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

        return CompetitorResponse(
            total_count=n,
            cta_distribution=dict(cta_dist),
            linguistic_features=ling,
            top_keywords=keywords,
            interpretation=interpretation,
        )

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

@app.post("/collect-news", response_model=CollectNewsResponse)
def collect_news(x_cron_secret: str | None = Header(default=None)):
    cron_secret = os.getenv("CRON_SECRET")
    if not cron_secret or x_cron_secret != cron_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")

    supabase = state.get("supabase")
    if supabase is None:
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
        return CollectNewsResponse(collected=0, inserted=0, skipped=0, sources=[])

    # 기존 URL 조회 → 신규만 삽입
    url_list = [r["url"] for r in all_rows]
    existing_res = (
        supabase.schema("adplatform")
        .table("industry_news")
        .select("url")
        .in_("url", url_list)
        .execute()
    )
    existing_urls = {r["url"] for r in existing_res.data} if existing_res.data else set()

    new_rows = [r for r in all_rows if r["url"] not in existing_urls]
    skipped = len(all_rows) - len(new_rows)

    if new_rows:
        supabase.schema("adplatform").table("industry_news").insert(new_rows).execute()

    return CollectNewsResponse(
        collected=len(all_rows),
        inserted=len(new_rows),
        skipped=skipped,
        sources=sorted(active_sources),
    )

@app.post("/analyze-creative", response_model=AnalyzeCreativeResponse)
def analyze_creative(req: AnalyzeCreativeRequest):
    try:
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
            "입력된 광고 카피를 분석하여 반드시 지정된 JSON 스키마 형식으로만 응답하세요. "
            "추가 텍스트나 마크다운 없이 JSON만 반환하세요. "
            "모든 분석은 한국어로 작성하세요."
        )
        fallback_system = "JSON만 반환하세요. 각 텍스트 필드는 50자 이내로 간결하게 작성하세요."

        raw = call_claude(main_system)
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            print("[WARN] /analyze-creative JSON 파싱 실패, fallback 재시도")
            raw = call_claude(fallback_system)
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError as e:
                print(f"[ERROR] /analyze-creative fallback 후에도 JSON 파싱 실패: {e}")
                raise HTTPException(status_code=500, detail=f"JSON 파싱 실패 (재시도 후): {str(e)}")

        result = AnalyzeCreativeResponse(**parsed)
        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] /analyze-creative 실패: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
