import os
import pandas as pd
import csv
import numpy as np

def main():
    print(">>> Step 2: Generating TensorBoard Files...")
    
    # Load Data
    pkl_path = os.path.join(os.path.dirname(__file__), 'dataset.pkl')
    if not os.path.exists(pkl_path):
        print("Error: dataset.pkl not found. Run Step 1 first.")
        return

    df = pd.read_pickle(pkl_path)
    
    # Check for dense vector
    if 'dense' not in df.columns:
        print("Error: 'dense' column missing in dataset.")
        return

    out_dir = os.path.join(os.path.dirname(__file__), 'tensorboard_output')
    os.makedirs(out_dir, exist_ok=True)
    
    vec_path = os.path.join(out_dir, 'vectors.tsv')
    meta_path = os.path.join(out_dir, 'metadata.tsv')

    print(f"Writing {len(df)} records to TSV...")

    # Write Vectors
    # Milvus returns list of floats, convert to tab-separated string
    with open(vec_path, 'w', encoding='utf-8', newline='') as f_vec:
        writer = csv.writer(f_vec, delimiter='\t')
        for vec in df['dense']:
            writer.writerow(vec)

    # Write Metadata
    # We include headers for nicer visualization
    with open(meta_path, 'w', encoding='utf-8', newline='') as f_meta:
        writer = csv.writer(f_meta, delimiter='\t')
        writer.writerow(['Index', 'Subject', 'Topic', 'Source', 'Text_Snippet']) # Header
        
        for idx, row in df.iterrows():
            text_snippet = row.get('text', '')[:50].replace('\n', ' ') + '...'
            writer.writerow([
                idx,
                row.get('subject', 'Unknown'),
                row.get('topic', 'Unknown'),
                row.get('source_type', 'Unknown'),
                text_snippet
            ])

    print(f"✅ TensorBoard files generated in: {out_dir}")
    print("   - vectors.tsv")
    print("   - metadata.tsv")
    print("👉 To view: Open http://projector.tensorflow.org/ and load these two files.")

if __name__ == "__main__":
    main()
