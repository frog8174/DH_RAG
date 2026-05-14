import yaml
from dotenv import load_dotenv
from pymilvus import connections, Collection

load_dotenv()  # 讀取 .env

# 讀取 YAML 設定檔
with open("config.yaml", "r", encoding="utf-8") as f:
    config = yaml.safe_load(f)

milvus_conf = config["milvus"]

connections.connect("default", uri=milvus_conf["connection_args"]["uri"])
collection = Collection(milvus_conf["collection_name"])

# 以 text field 去重複
all_docs = collection.query(expr="", output_fields=["text"], limit=10000)
print("\nCollection size before deletion:", len(all_docs)) 

unique_texts = set()
duplicates = []

for doc in all_docs:
    text = doc["text"]
    if text in unique_texts:
        duplicates.append(doc)
    else:
        unique_texts.add(text)

if duplicates:
    ids_to_delete = [doc["pk"] for doc in duplicates]
    collection.delete(expr=f"pk in {ids_to_delete}")

all_docs = collection.query(expr="", limit=10000)
print("\nCollection size after deletion:", len(all_docs))