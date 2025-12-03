"""簡化版入口：使用 rag_core 的 run_rag 進行測試。

這個檔案現在只負責 CLI / 手動測試。
真正的 RAG 邏輯都集中在 rag_core.py 裡面。
"""

from rag_core import run_rag

if __name__ == "__main__":
    # query = "告訴我一些成語的典故？"
    query = "海峽兩岸的敵對與隔絕"

    result = run_rag(
        query=query,
        expr="source_type == 'teachers_book'",  # just an example filter
        with_debug=True,
    )

    print("\n--- RAG 的輸出 ---\n", result)
