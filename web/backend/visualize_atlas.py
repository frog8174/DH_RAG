import os
import yaml
import pandas as pd
from dotenv import load_dotenv
from pymilvus import connections, Collection
from nomic import atlas, login

def main():
    # 1. 載入環境變數
    load_dotenv()
    
    # 檢查 Nomic API Key
    api_key = os.getenv("NOMIC_API_KEY")
    if not api_key:
        print("提示: 未檢測到 NOMIC_API_KEY 環境變數 ويعمل.")
        print("請確保您已執行 'nomic login' 或在 .env 文件中設置了 NOMIC_API_KEY。")
        # 嘗試互動式登入 (如果是在終端機執行)
        try:
            login()
        except Exception:
            pass

    # 2. 讀取 Config
    config_path = "config.yaml"
    if not os.path.exists(config_path):
        print(f"錯誤: 找不到設定檔 {config_path}")
        return

    with open(config_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    milvus_conf = config["milvus"]
    collection_name = milvus_conf["collection_name"]
    uri = milvus_conf["connection_args"]["uri"]

    # 3. 連接 Milvus
    print(f"正在連接至 Milvus: {uri} ...")
    try:
        connections.connect(alias="default", uri=uri)
        col = Collection(collection_name)
        col.load()
        total_entities = col.num_entities
        print(f"Collection '{collection_name}' 已載入。總筆數: {total_entities}")
    except Exception as e:
        print(f"連接 Milvus 失敗: {e}")
        return

    # 4. 提取所有資料 (透過分頁)
    all_results = []
    offset = 0
    batch_size = 1000  # 每次提取的數量
    
    print(f"正在提取所有資料 (每次 {batch_size} 筆)...")

    while True:
        try:
            results = col.query(
                expr="",  # 空字串代表提取所有符合條件的資料
                output_fields=["text", "subject", "topic", "source_type"], # 提取文本和 Metadata
                limit=batch_size,
                offset=offset
            )
            all_results.extend(results)
            print(f"已提取 {len(all_results)} / {total_entities} 筆資料...")

            if len(results) < batch_size or len(all_results) >= total_entities:
                break # 如果提取的數量少於 batch_size，表示已到最後一頁，或已達到總筆數
            
            offset += batch_size

        except Exception as e:
            print(f"查詢失敗 (Offset: {offset}): {e}")
            break

    if not all_results:
        print("未找到任何資料。")
        return

    # 5. 轉換為 DataFrame
    df = pd.DataFrame(all_results)
    
    # 確保 text 欄位存在 (Nomic 需要文本來計算它自己的 embedding)
    if "text" not in df.columns:
        print("錯誤: 回傳資料中缺少 'text' 欄位，無法進行視覺化。")
        return

    print(f"資料準備完成: {len(df)} 筆。")
    print("前 5 筆預覽:")
    print(df.head())

    # 6. 上傳至 Nomic Atlas
    # 注意: Nomic Atlas 免費版通常支援約 10,000 - 100,000 點。
    # 如果您的資料量非常大，可能需要分批上傳或考慮升級帳戶。
    print("\n正在上傳至 Nomic Atlas (這可能需要幾分鐘，取決於資料量)...")
    
    try:
        project = atlas.map_data(
            data=df.to_dict('records'),
            indexed_field='text',
            identifier='Gemini-RAG-Dataset',
            description='Visualization of History/Civics/Geography RAG dataset from Gemini Project',
            topic_model=True, # 自動生成主題標籤
            id_field=None     # 讓 Nomic 自動生成 ID
        )
        
        print("\n" + "="*50)
        print(f"✅ 地圖建立成功！")
        
        # 修正: 從 AtlasDataset 中獲取地圖連結
        if hasattr(project, 'maps') and project.maps:
            print(f"請訪問以下連結查看您的資料視覺化: {project.maps[0].map_link}")
        else:
            # 若結構不同，印出整個物件供參考 (有些版本可能直接回傳 Project)
            print(f"地圖物件建立完成: {project}")
            
        print("="*50)

    except Exception as e:
        print(f"上傳至 Nomic Atlas 失敗: {e}")
        print("可能原因: Nomic API Key 無效、網路問題或資料量超過免費方案限制。")

if __name__ == "__main__":
    main()