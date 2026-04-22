import pandas as pd
import numpy as np
import os

output_lines = []

def log(msg=""):
    print(msg)
    output_lines.append(msg)

gz_path = r"C:\develop\train.gz"

log("=" * 60)
log("데이터 분석 리포트")
log("=" * 60)

# 파일 크기
file_size = os.path.getsize(gz_path)
log(f"\n[파일 정보]")
log(f"경로: {gz_path}")
log(f"파일 크기: {file_size:,} bytes ({file_size / 1024 / 1024:.2f} MB)")

log("\n데이터 로딩 중...")
df = pd.read_csv(gz_path, compression="gzip")

log(f"\n[기본 정보]")
log(f"행 수: {len(df):,}")
log(f"컬럼 수: {len(df.columns)}")
log(f"\n[컬럼 목록]")
for col in df.columns:
    log(f"  {col}")

log(f"\n[컬럼별 데이터 타입]")
for col, dtype in df.dtypes.items():
    log(f"  {col}: {dtype}")

log(f"\n[click 컬럼 분포]")
if "click" in df.columns:
    counts = df["click"].value_counts().sort_index()
    total = len(df)
    for val, cnt in counts.items():
        log(f"  {val}: {cnt:,} ({cnt / total * 100:.2f}%)")
else:
    log("  'click' 컬럼이 존재하지 않습니다.")

log(f"\n[Null 값 현황]")
null_counts = df.isnull().sum()
has_null = null_counts[null_counts > 0]
if len(has_null) == 0:
    log("  Null 값 없음")
else:
    for col, cnt in has_null.items():
        log(f"  {col}: {cnt:,} ({cnt / len(df) * 100:.2f}%)")

log(f"\n[수치형 컬럼 기초 통계]")
numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
if numeric_cols:
    stats = df[numeric_cols].describe().T
    log(stats.to_string())

log("\n" + "=" * 60)
log("분석 완료")
log("=" * 60)

report_path = r"C:\develop\ad-intelligence-platform\model\data_report.txt"
with open(report_path, "w", encoding="utf-8") as f:
    f.write("\n".join(output_lines))

print(f"\n리포트 저장 완료: {report_path}")
