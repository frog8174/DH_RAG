import os
import json
from typing import List
import opencc

from utils import RecursiveTextSplitterLite 


def chunk_text(text: str, chunk_size: int = 512, chunk_overlap: int = 64) -> List[str]:
    """
    使用自訂 RecursiveTextSplitterLite 將文字切成 chunks。
    """
    splitter = RecursiveTextSplitterLite(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        # separators 預設為 ["\n\n", "\n", "。", "，", " "]
    )
    return splitter.split_text(text)


def process_txt_dir(input_dir: str, output_dir: str):
    """
    把 input_dir 底下所有 .txt 檔讀進來，先轉繁體，chunk 後各自存成一個 .json 檔。
    """
    os.makedirs(output_dir, exist_ok=True)

    # 簡體轉繁體
    cc = opencc.OpenCC('s2t')

    files = [
        f for f in os.listdir(input_dir)
        if f.endswith(".txt") and not f.startswith(".")  # 跳過隱藏檔
    ]
    files.sort()

    for fname in files:
        in_path = os.path.join(input_dir, fname)
        print(f"處理 {in_path} ...")

        # 讀整個 txt 內容
        with open(in_path, "r", encoding="utf-8") as f:
            text = f.read()

        text = cc.convert(text)

        # 取得檔名作為 title
        title_raw = os.path.splitext(fname)[0]  # 去掉 .txt
        
        title = cc.convert(title_raw)

        # 分 chunk
        chunks = chunk_text(text, chunk_size=512, chunk_overlap=64)
        print(f"  -> 切出 {len(chunks)} 個 chunk")

        # 準備輸出結構
        records = []

        for i, c in enumerate(chunks):
            records.append(
                {
                    "source_type": '中國史史料',
                    "content": c,
                    "title": title,
                    "chunk_index": i,
                    "reference": title,
                }
            )

        # 輸出成 json 檔
        safe_name = "".join(ch if ch.isalnum() or ch in "-_." else "_" for ch in title)
        out_path = os.path.join(output_dir, f"{safe_name}.json")

        with open(out_path, "w", encoding="utf-8") as out_f:
            json.dump(records, out_f, ensure_ascii=False, indent=2)

        print(f"  -> 已輸出 {out_path}")


if __name__ == "__main__":
    input_dir = "./data_raw/txt"          
    output_dir = "./China_json" 
    process_txt_dir(input_dir, output_dir)