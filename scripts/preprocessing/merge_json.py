import os
import json
from typing import List

def merge_json_dir_to_jsonl(input_dir: str, output_jsonl_path: str):
    """
    將資料夾底下所有 .json 檔合併成一個 .jsonl

    假設每個 .json 檔的結構都是：
    [
      {"source_type": ..., "content": ..., "chunk_index": ...},
      ...
    ]
    """
    files: List[str] = [
        f for f in os.listdir(input_dir)
        if f.endswith(".json")
    ]
    files.sort()  # 讓順序穩定一點（可選）

    count = 0
    with open(output_jsonl_path, "w", encoding="utf-8") as out_f:
        for fname in files:
            path = os.path.join(input_dir, fname)
            with open(path, "r", encoding="utf-8") as in_f:
                try:
                    data = json.load(in_f)  # list[dict]
                except json.JSONDecodeError as e:
                    print(f"讀取 {path} 失敗: {e}")
                    continue

            # 一筆一行寫進 jsonl
            for obj in data:
                # 如果想保留原檔名也可以加一欄：
                # obj["file_name"] = fname
                out_f.write(json.dumps(obj, ensure_ascii=False) + "\n")
                count += 1

    print(f"已將 {len(files)} 個 json 檔，共 {count} 筆資料，寫入 {output_jsonl_path}")


if __name__ == "__main__":
    input_dir = "./China_json"
    output_jsonl_path = "./China_merged.jsonl"
    os.makedirs(os.path.dirname(output_jsonl_path), exist_ok=True)

    merge_json_dir_to_jsonl(input_dir, output_jsonl_path)
