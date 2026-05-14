import os
import json
from typing import List, Dict


from utils import RecursiveTextSplitterLite

def select_and_chunk_per_index(
    input_jsonl: str,
    output_dir: str,
    indices: list[int],
    chunk_size: int = 512,
    chunk_overlap: int = 64,
):
    """
    從 jsonl 檔案中選出指定行號(1-based)的資料，
    對每一行的 text 做 chunk，各自存成一個 json 檔。

    輸出的每個檔案格式：
    [
      {
        "source_type": <name>,
        "content": <chunk_text>,
        "chunk_index": <在該 name 內的序號>,
        "orig_index": <這筆原本在 jsonl 中的行號>
      },
      ...
    ]
    """
    os.makedirs(output_dir, exist_ok=True)

    index_set = set(indices)
    splitter = RecursiveTextSplitterLite(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )

    found_indices = set()

    with open(input_jsonl, "r", encoding="utf-8") as f:
        for i, line in enumerate(f, start=1):
            if i not in index_set:
                continue
            line = line.strip()
            if not line:
                continue

            obj = json.loads(line)
            title = obj.get("name", f"doc_{i}")
            # 先拿掉前面的路徑（如果它長這樣：史藏/志存記錄/臺灣紀事.txt）
            base = os.path.basename(title)
            # 再去掉副檔名，只切最後一個點
            title_no_ext, _ = os.path.splitext(base)

            title = title_no_ext
            text = obj.get("text", "")

            found_indices.add(i)

            # 做 chunk
            chunks = splitter.split_text(text)
            records: List[Dict] = []
            for j, c in enumerate(chunks):
                records.append(
                    {
                        "source_type": "臺灣史",
                        "content": c,
                        "title": title,
                        "chunk_index": j,
                        "orig_index": i,
                        "reference": title,
                    }
                )

            # 做一個安全檔名：用 name + index
            base_name = os.path.splitext(title)[0]
            safe_name = "".join(
                ch if ch.isalnum() or ch in "-_." else "_" for ch in base_name
            )
            out_path = os.path.join(output_dir, f"{safe_name}_idx{i}.json")

            with open(out_path, "w", encoding="utf-8") as out_f:
                json.dump(records, out_f, ensure_ascii=False, indent=2)

            print(
                f"行 {i}（name={title}）切出 {len(chunks)} 個 chunks，已寫入 {out_path}"
            )

    missing = index_set - found_indices
    if missing:
        print(f"⚠ 有這些行號在檔案裡找不到：{sorted(missing)}")
    else:
        print("所有指定行號都已處理完成。")


if __name__ == "__main__":
    input_jsonl = "Taiwan.jsonl"

    # 👉 想要的「第幾筆」(1-based) —— 在這裡填
    indices = [3,4,6,7,8,10,13,16,17,24,25,26,27,28,29,31,34,35,37,38,42,43,46,48,50,59,60,68,70]

    output_dir = "./Taiwan_jsons"  # 每行一個 json 檔會輸出到這個資料夾

    select_and_chunk_per_index(
        input_jsonl=input_jsonl,
        output_dir=output_dir,
        indices=indices,
        chunk_size=512,
        chunk_overlap=64,
    )
