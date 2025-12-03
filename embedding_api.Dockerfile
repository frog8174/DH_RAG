# --- Stage 1: Builder：只負責把模型下載好放進 HF cache ---
FROM python:3.11-slim AS builder

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HOME=/root/.cache/huggingface

WORKDIR /app

# 安裝執行 download_model.py 需要的套件
COPY api.requirements.txt .
RUN pip install --no-cache-dir -r api.requirements.txt

# 下載模型到 HF cache
COPY download_model.py .
RUN python download_model.py


# --- Stage 2: Final Image：正式跑 API 的環境 ---
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HOME=/root/.cache/huggingface

WORKDIR /app

# 在「最終 image」裡再安裝一次所有依賴（包含 fastapi / uvicorn）
COPY api.requirements.txt .
RUN pip install --no-cache-dir -r api.requirements.txt

# 從 builder 拿已下載好的 HF 模型 cache
COPY --from=builder /root/.cache/huggingface /root/.cache/huggingface

# 複製 API 程式
COPY embedding_api.py .

EXPOSE 8000

# 用 uvicorn 啟動 FastAPI app
CMD ["uvicorn", "embedding_api:app", "--host", "0.0.0.0", "--port", "6666"]
