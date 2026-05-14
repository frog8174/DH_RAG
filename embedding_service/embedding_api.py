
import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from langchain_community.embeddings import HuggingFaceEmbeddings
import torch

# --- 配置 ---
MODEL_NAME = "BAAI/bge-m3"
MODEL_KWARGS = {"device": "cuda" if torch.cuda.is_available() else "cpu"}
ENCODE_KWARGS = {"normalize_embeddings": True}

# --- 初始化 ---
print("正在初始化 FastAPI 應用...")
app = FastAPI(
    title="Embedding API",
    description="一個用於生成 HuggingFace BGE-M3 模型嵌入向量的 API",
    version="1.0.0",
)

# 定義請求的資料結構
class EmbeddingRequest(BaseModel):
    texts: List[str]

# --- 載入模型（啟動時載入一次，常駐記憶體）---
print(f"正在從 {MODEL_NAME} 載入模型...")
print(f"使用的設備: {MODEL_KWARGS['device']}")

try:
    embeddings_model = HuggingFaceEmbeddings(
        model_name=MODEL_NAME,
        model_kwargs=MODEL_KWARGS,
        encode_kwargs=ENCODE_KWARGS,
    )
    print("模型載入成功！")
except Exception as e:
    print(f"模型載入失敗: {e}")
    embeddings_model = None

# --- API 端點 ---
@app.post("/embed", summary="生成嵌入向量")
def embed_texts(request: EmbeddingRequest):
    """
    接收一個包含多個字串的列表，並為每個字串生成其嵌入向量。

    - **texts**: 一個包含字串的列表。

    返回一個包含對應嵌入向量（浮點數列表）的列表。
    """
    if embeddings_model is None:
        return {"error": "模型未能成功載入，無法提供服務。"}
    
    try:
        print(f"收到 {len(request.texts)} 筆文字的嵌入請求。")
        vectors = embeddings_model.embed_documents(request.texts)
        print("成功生成嵌入向量。")
        return {"embeddings": vectors}
    except Exception as e:
        return {"error": f"生成嵌入向量時發生錯誤: {e}"}

@app.get("/", summary="API 狀態檢查")
def read_root():
    """
    根目錄端點，用於檢查 API 是否正常運行。
    """
    return {"status": "Embedding API 正在運行", "model_loaded": embeddings_model is not None}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=6666)
