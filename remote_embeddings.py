
import requests
from typing import List
from langchain_core.embeddings import Embeddings

class RemoteEmbeddings(Embeddings):

    def __init__(self, api_url: str = "http://bgem3.toolmen.bime.ntu.edu.tw/embed"):
        self.api_url = api_url

        # 使用 HEAD 比 GET 更保險
        try:
            response = requests.head(self.api_url)
            print(f"成功連接 Embedding API (狀態碼: {response.status_code})")
        except Exception as e:
            print(f"警告：無法連接 Embedding API: {e}")

    def _embed(self, texts: List[str]) -> List[List[float]]:
        try:
            response = requests.post(self.api_url, json={"texts": texts})
            response.raise_for_status()
            data = response.json()

            if "embeddings" not in data:
                raise ValueError(f"API 回傳錯誤: {data}")

            return data["embeddings"]

        except requests.exceptions.RequestException as e:
            raise ConnectionError(f"呼叫 Embedding API 失敗: {e}")

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        # 分批（每批 8 筆）
        batch_size = 8
        results = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_emb = self._embed(batch)
            results.extend(batch_emb)
        return results

    def embed_query(self, text: str) -> List[float]:
        return self._embed([text])[0]

# --- 使用範例 (可選，用於直接測試此文件) ---
if __name__ == '__main__':
    print("--- 正在測試 RemoteEmbeddings 客戶端 ---")
    
    # 假設您的 API 正在 http://127.0.0.1:6666 運行
    # 如果 API 在另一台機器上，請替換 IP 地址
    remote_embed_client = RemoteEmbeddings(api_url="http://bgem3.toolmen.bime.ntu.edu.tw/embed")

    # 測試 embed_query
    try:
        query_text = "這是一個測試查詢"
        query_embedding = remote_embed_client.embed_query(query_text)
        print(f"\n成功獲取單一查詢的嵌入向量 (維度: {len(query_embedding)})")
        # print(f"向量前5個值: {query_embedding[:5]}")
    except Exception as e:
        print(f"\n測試 embed_query 失敗: {e}")

    # 測試 embed_documents
    try:
        doc_texts = ["第一份文件", "這是第二份要被嵌入的文件"]
        doc_embeddings = remote_embed_client.embed_documents(doc_texts)
        print(f"\n成功獲取 {len(doc_embeddings)} 份文件的嵌入向量 (維度: {len(doc_embeddings[0])})")
        # print(f"第一份文件的向量前5個值: {doc_embeddings[0][:5]}")
    except Exception as e:
        print(f"\n測試 embed_documents 失敗: {e}")
