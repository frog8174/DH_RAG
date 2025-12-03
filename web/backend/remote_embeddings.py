
import requests
from typing import List
from langchain_core.embeddings import Embeddings

class RemoteEmbeddings(Embeddings):
    """
    一個 LangChain 的 Embeddings 類別，它不自己計算嵌入，
    而是透過呼叫遠端的 Embedding API 來獲取嵌入向量。
    """
    def __init__(self, api_url: str = "http://bgem3.toolmen.bime.ntu.edu.tw/embed"):
        """
        初始化遠端嵌入客戶端。

        Args:
            api_url (str): Embedding API 的完整 URL。
        """
        self.api_url = api_url
        # 檢查 API 是否可連線
        try:
            response = requests.get(self.api_url.replace("/embed", "/"))
            response.raise_for_status()
            print(f"成功連接至 Embedding API: {response.json().get('status')}")
        except requests.exceptions.RequestException as e:
            print(f"警告：無法連接至 Embedding API ({self.api_url})。請確保 API 伺服器正在運行。錯誤: {e}")


    def _embed(self, texts: List[str]) -> List[List[float]]:
        """
        內部方法，用於呼叫 API 並返回嵌入向量。
        """
        try:
            # 設定 10 秒 timeout，避免卡死導致 Nginx 504
            response = requests.post(self.api_url, json={"texts": texts}, timeout=10)
            response.raise_for_status()  # 如果 HTTP 狀態碼是 4xx 或 5xx，則拋出異常
            data = response.json()
            if "embeddings" in data:
                return data["embeddings"]
            else:
                # 處理 API 返回錯誤訊息的情況
                error_message = data.get("error", "未知的 API 錯誤")
                raise ValueError(f"API 返回錯誤: {error_message}")
        except requests.exceptions.RequestException as e:
            # 處理網路層面的錯誤
            raise ConnectionError(f"呼叫 Embedding API 失敗: {e}")
        except Exception as e:
            # 處理其他所有可能的錯誤
            raise RuntimeError(f"處理嵌入請求時發生未知錯誤: {e}")

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """
        為多個文件（字串）生成嵌入向量。

        Args:
            texts: 一個包含多個字串的列表。

        Returns:
            一個包含對應嵌入向量的列表。
        """
        return self._embed(texts)

    def embed_query(self, text: str) -> List[float]:
        """
        為單個查詢（字串）生成嵌入向量。

        Args:
            text: 一個字串。

        Returns:
            一個嵌入向量（浮點數列表）。
        """
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
