import json
import re

# 設定輸入與輸出檔名
input_file = 'Metadata_textbook_teacher.jsonl'
output_file = 'data_cleaned.jsonl'



# 尋找以【改寫自：開頭，】結尾的字串
ref_pattern = re.compile(r'(【改寫自：.*?】)')

processed_data = []

with open(input_file, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            item = json.loads(line)
            content = item.get('content', '')
            
            # 搜尋是否包含目標字串
            match = ref_pattern.search(content)
            
            if match:
                # --- 情況 A：找到了引用來源 ---
                reference_text = match.group(1)
                item['reference'] = reference_text
                
                # 從 content 中移除該段文字
                new_content = content.replace(reference_text, '')
                
                # 清理末端殘留的 <br> 標籤與空白
                while new_content.strip().endswith('<br>'):
                    new_content = new_content.strip()[:-4]
                
                item['content'] = new_content.strip()
                
            else:
                # --- 情況 B：沒找到引用來源 ---
                # 依照您的需求填入指定字串
                item['reference'] = "reference not found"
            
            processed_data.append(item)
            
        except json.JSONDecodeError:
            print(f"Skipping invalid JSON line: {line[:50]}...")

with open(output_file, 'w', encoding='utf-8') as f:
    for item in processed_data:
        f.write(json.dumps(item, ensure_ascii=False) + '\n')

print(f"處理完成，已輸出至 {output_file}")