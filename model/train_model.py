import pandas as pd
import numpy as np
import pickle
import warnings
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    roc_auc_score, log_loss, confusion_matrix, classification_report
)
import lightgbm as lgb

warnings.filterwarnings("ignore")

output_lines = []

def log(msg=""):
    print(msg, flush=True)
    output_lines.append(str(msg))

log("=" * 60)
log("LightGBM CTR 예측 모델 학습")
log("=" * 60)

# ── 1. 데이터 로드 및 샘플링 ──────────────────────────────────
log("\n[1] 데이터 로드 및 샘플링")
log("  train.gz 로딩 중...")
df = pd.read_csv(r"C:\develop\train.gz", compression="gzip")
log(f"  전체 행 수: {len(df):,}")

df = df.sample(n=5_000_000, random_state=42).reset_index(drop=True)
log(f"  샘플링 후 행 수: {len(df):,}")

# ── 2. 전처리 ────────────────────────────────────────────────
log("\n[2] 전처리")

# hour 파싱 (YYMMDDHH)
df["hour"] = df["hour"].astype(str)
df["hour_of_day"] = df["hour"].str[-2:].astype(int)
df["day_of_week"] = pd.to_datetime(
    "20" + df["hour"].str[:6], format="%Y%m%d"
).dt.dayofweek
df.drop(columns=["hour"], inplace=True)
log("  hour → hour_of_day, day_of_week 변환 완료")

# C20: -1 → 0
df["C20"] = df["C20"].replace(-1, 0)
log("  C20 결측치(-1) → 0 대체 완료")

# id 삭제
df.drop(columns=["id"], inplace=True)
log("  id 컬럼 삭제 완료")

# Label Encoding
cat_cols = [
    "site_id", "site_domain", "site_category",
    "app_id", "app_domain", "app_category",
    "device_id", "device_ip", "device_model"
]
label_encoders = {}
for col in cat_cols:
    le = LabelEncoder()
    df[col] = le.fit_transform(df[col].astype(str))
    label_encoders[col] = le
log(f"  Label Encoding 완료: {cat_cols}")

# ── 3. 학습/검증 분리 ─────────────────────────────────────────
log("\n[3] 학습/검증 분리 (80/20)")
X = df.drop(columns=["click"])
y = df["click"]

X_train, X_val, y_train, y_val = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
log(f"  학습: {len(X_train):,}  검증: {len(X_val):,}")
log(f"  scale_pos_weight = 4.89  (불균형 보정)")

# ── 4. 모델 학습 ──────────────────────────────────────────────
log("\n[4] LightGBM 모델 학습 중...")

params = {
    "objective": "binary",
    "metric": "auc",
    "scale_pos_weight": 4.89,
    "learning_rate": 0.05,
    "num_leaves": 63,
    "n_estimators": 300,
    "random_state": 42,
    "verbose": -1,
}

model = lgb.LGBMClassifier(**params)
model.fit(
    X_train, y_train,
    eval_set=[(X_val, y_val)],
    callbacks=[
        lgb.early_stopping(stopping_rounds=30, verbose=False),
        lgb.log_evaluation(period=50),
    ],
)
log(f"  최적 트리 수: {model.best_iteration_}")

# ── 5. 평가 ───────────────────────────────────────────────────
log("\n[5] 모델 평가")

y_prob = model.predict_proba(X_val)[:, 1]
y_pred = model.predict(X_val)

auc   = roc_auc_score(y_val, y_prob)
logloss = log_loss(y_val, y_prob)
cm    = confusion_matrix(y_val, y_pred)
cr    = classification_report(y_val, y_pred, digits=4)

log(f"\n  AUC-ROC  : {auc:.6f}")
log(f"  Log Loss : {logloss:.6f}")
log(f"\n  Confusion Matrix:")
log(f"    {cm[0]}  (실제 0)")
log(f"    {cm[1]}  (실제 1)")
log(f"\n  Classification Report:")
for line in cr.split("\n"):
    log(f"    {line}")

# Feature Importance Top 15
log("\n  Feature Importance (Top 15):")
fi = pd.Series(model.feature_importances_, index=X.columns)
fi = fi.sort_values(ascending=False).head(15)
for feat, imp in fi.items():
    log(f"    {feat:<20s}: {imp:>6d}")

# ── 6. 모델 저장 ──────────────────────────────────────────────
log("\n[6] 모델 저장")
model_path = r"C:\develop\ad-intelligence-platform\model\lgbm_model.pkl"
le_path    = r"C:\develop\ad-intelligence-platform\model\label_encoders.pkl"

with open(model_path, "wb") as f:
    pickle.dump(model, f)
with open(le_path, "wb") as f:
    pickle.dump(label_encoders, f)

log(f"  모델 저장: {model_path}")
log(f"  LabelEncoder 저장: {le_path}")

# ── 7. 결과 저장 ──────────────────────────────────────────────
report_path = r"C:\develop\ad-intelligence-platform\model\model_report.txt"
with open(report_path, "w", encoding="utf-8") as f:
    f.write("\n".join(output_lines))

log(f"\n리포트 저장 완료: {report_path}")
log("\n" + "=" * 60)
log("학습 완료")
log("=" * 60)
