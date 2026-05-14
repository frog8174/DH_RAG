import csv
import json
import os

def convert_csv_to_jsonl(input_csv_path, output_jsonl_path):
    """
    Converts a CSV file to a JSONL file based on specified column mappings.
    """
    with open(input_csv_path, 'r', encoding='utf-8') as infile, \
         open(output_jsonl_path, 'w', encoding='utf-8') as outfile:
        
        reader = csv.reader(infile)
        headers = next(reader)  # Read header row

        header_mapping = {
            "content": "text",
            "source_type": "source_type",
            "subject": "subject",
            "topic": "topic",
            "keywords": "keywords",
            "chapter": "chapter",
            "title": "title",
        }

        # Map desired JSON keys to CSV column indices
        column_mapping = {}
        for json_key, header_name in header_mapping.items():
            if header_name in headers:
                column_mapping[json_key] = headers.index(header_name)
            else:
                column_mapping[json_key] = None  # 用 None 表示沒有這個欄

        for row in reader:
            json_obj = {}
            for json_key, col_index in column_mapping.items():
                if col_index is None:
                    # 這個 CSV 沒有這欄，給預設值
                    json_obj[json_key] = ""   # 或 None
                else:
                    json_obj[json_key] = row[col_index] if col_index < len(row) else ""
            outfile.write(json.dumps(json_obj, ensure_ascii=False) + "\n")

def main():
    input_dir = "data_raw"
    output_dir = "data_jsonl"
    
    os.makedirs(output_dir, exist_ok=True)

    csv_files = ["Metadata_textbook.csv", "Metadata_textbook_teacher.csv", "學測歷史.csv"]

    for csv_file in csv_files:
        input_csv_path = os.path.join(input_dir, csv_file)
        output_jsonl_filename = csv_file.replace(".csv", ".jsonl")
        output_jsonl_path = os.path.join(output_dir, output_jsonl_filename)
        
        print(f"Converting {input_csv_path} to {output_jsonl_path}...")
        convert_csv_to_jsonl(input_csv_path, output_jsonl_path)
        print(f"Finished converting {csv_file}.")

if __name__ == "__main__":
    main()
