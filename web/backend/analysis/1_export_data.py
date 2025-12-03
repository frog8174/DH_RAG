import os
import sys
import yaml
import pandas as pd
import pickle
from dotenv import load_dotenv
from pymilvus import connections, Collection

# Add backend to path to import local modules if needed
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

def main():
    print(">>> Step 1: Exporting Data from Milvus...")
    load_dotenv()
    
    # Load Config
    config_path = os.path.join(os.path.dirname(__file__), '..', 'config.yaml')
    if not os.path.exists(config_path):
        print(f"Error: Config not found at {config_path}")
        return

    with open(config_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    milvus_conf = config["milvus"]
    uri = milvus_conf["connection_args"]["uri"]
    collection_name = milvus_conf["collection_name"]
    
    # Connect
    print(f"Connecting to {uri}...")
    try:
        connections.connect(alias="default", uri=uri)
        col = Collection(collection_name)
        col.load()
        total = col.num_entities
        print(f"Collection loaded. Total entities: {total}")
    except Exception as e:
        print(f"Connection failed: {e}")
        return

    # Fetch Data (Pagination)
    batch_size = 2000
    offset = 0
    all_data = []

    print("Fetching data and vectors (this may take a moment)...")
    while True:
        try:
            # We explicitly fetch the 'dense' vector field
            res = col.query(
                expr="",
                output_fields=["text", "subject", "topic", "dense", "source_type"], 
                limit=batch_size,
                offset=offset
            )
            
            if not res:
                break
                
            all_data.extend(res)
            print(f"Fetched {len(all_data)} / {total}")
            
            if len(res) < batch_size:
                break
                
            offset += batch_size
        except Exception as e:
            print(f"Query failed at offset {offset}: {e}")
            break

    if not all_data:
        print("No data found.")
        return

    # Convert to DataFrame
    df = pd.DataFrame(all_data)
    print(f"Dataframe shape: {df.shape}")
    
    # Save to Pickle (Preserves Vector Arrays better than CSV)
    output_path = os.path.join(os.path.dirname(__file__), 'dataset.pkl')
    df.to_pickle(output_path)
    print(f"✅ Data exported successfully to: {output_path}")

if __name__ == "__main__":
    main()
