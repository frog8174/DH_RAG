import yaml
from dotenv import load_dotenv
import json
import os
from langchain_core.documents import Document
from langchain_community.embeddings import HuggingFaceBgeEmbeddings
from langchain_milvus import Milvus, BM25BuiltInFunction


total_chunks = []

# 設定本地 embedding model (needs GPU)
emb = HuggingFaceBgeEmbeddings(
    model_name="BAAI/bge-m3",
    model_kwargs={'device': 'cuda:1'},
    encode_kwargs={'normalize_embeddings': True}
)

# 要讀的 jsonl 檔名（目錄不變，仍然在 data_jsonl 底下）
jsonl_list = [
    'Metadata_textbook_teacher.jsonl',
    'Metadata_textbook.jsonl',
    'Taiwan_merged.jsonl',
    'China_merged.jsonl',
    '學測歷史.jsonl'
]

base_dir = "data_jsonl"

# 讀取多個 jsonl，累積成 total_chunks
for jsonl_name in jsonl_list:
    path = os.path.join(base_dir, jsonl_name)
    print(f"讀取 {path} ...")

    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            json_obj = json.loads(line)

            # 直接從 jsonl 讀取已分塊的內容和元數據
            page_content = json_obj.pop("content")  # 取出 content 作為 page_content
            metadata = json_obj                     # 剩下的欄位作為 metadata

            # 補齊缺失的 metadata 欄位
            for field in ["keywords", "subject", "topic", "chapter", "title", "reference"]:
                if field not in metadata:
                    metadata[field] = ""

            # 創建 Document 物件
            document = Document(page_content=page_content, metadata=metadata)
            total_chunks.append(document)

print(f"總共有 {len(total_chunks)} 個已分塊的 chunks")
for i, chunk in enumerate(total_chunks[:5]):
    print(f"\n第 {i} 個chunk：\n{chunk}\n")

# ===== 下面維持原本的 Milvus 建庫流程 =====

load_dotenv()  # 讀取 .env

with open("config.yaml", "r", encoding="utf-8") as f:
    config = yaml.safe_load(f)

milvus_conf = config["milvus"]
mode = milvus_conf.get("mode", "hybrid")

if mode == "semantic":
    print("使用語意檢索模式 (Semantic Retrieval)")
    vectorstore = Milvus.from_documents(
        documents=total_chunks,
        embedding=emb,
        text_field=milvus_conf["semantic"]["text_field"],
        vector_field=milvus_conf["semantic"]["vector_field"],
        connection_args=milvus_conf["connection_args"],
        collection_name=milvus_conf["collection_name"],
        index_params=milvus_conf["semantic"]["index_params"],
        drop_old=True,
    )
elif mode == "bm25":
    print("使用全文檢索模式 (BM25 Retrieval)")
    builtin_conf = milvus_conf["bm25"]["builtin_function"]
    vectorstore = Milvus.from_documents(
        documents=total_chunks,
        embedding=None,
        builtin_function=BM25BuiltInFunction(**builtin_conf),
        text_field=milvus_conf["bm25"]["text_field"],
        vector_field=milvus_conf["bm25"]["vector_field"],
        connection_args=milvus_conf["connection_args"],
        collection_name=milvus_conf["collection_name"],
        index_params=milvus_conf["bm25"]["index_params"],
        drop_old=True,
    )
elif mode == "hybrid":
    print("使用混合檢索模式 (Hybrid Retrieval)")
    builtin_conf = milvus_conf["hybrid"]["builtin_function"]
    vectorstore = Milvus.from_documents(
        documents=total_chunks,
        embedding=emb,
        builtin_function=BM25BuiltInFunction(**builtin_conf),
        text_field=milvus_conf["hybrid"]["text_field"],
        vector_field=milvus_conf["hybrid"]["vector_field"],
        connection_args=milvus_conf["connection_args"],
        collection_name=milvus_conf["collection_name"],
        index_params=milvus_conf["hybrid"]["index_params"],
        drop_old=True,
    )
else:
    raise ValueError(f"Unknown Milvus mode: {mode}")
