import os
import pandas as pd
import numpy as np
from bertopic import BERTopic
from sklearn.feature_extraction.text import CountVectorizer

def main():
    print(">>> Step 3: Running BERTopic Analysis...")
    
    pkl_path = os.path.join(os.path.dirname(__file__), 'dataset.pkl')
    if not os.path.exists(pkl_path):
        print("Error: dataset.pkl not found.")
        return

    df = pd.read_pickle(pkl_path)
    
    docs = df['text'].tolist()
    # Convert vectors to numpy array for BERTopic
    embeddings = np.array(df['dense'].tolist())
    
    print(f"Training BERTopic on {len(docs)} documents using pre-computed embeddings...")

    # Configure BERTopic for Chinese
    # We use a custom CountVectorizer to handle Chinese segmentation better if needed,
    # but for now standard is fine. 
    # Important: calculate_probabilities=False to save memory
    topic_model = BERTopic(
        language="multilingual", 
        verbose=True,
        min_topic_size=10 # Minimum docs per topic
    )
    
    # Fit model using existing embeddings (FAST!)
    topics, probs = topic_model.fit_transform(docs, embeddings=embeddings)
    
    # Save Info
    freq = topic_model.get_topic_info()
    print("Top 5 Topics Found:")
    print(freq.head())

    out_dir = os.path.join(os.path.dirname(__file__), 'bertopic_output')
    os.makedirs(out_dir, exist_ok=True)
    
    # Save Visualizations
    print("Generating visualizations...")
    try:
        fig1 = topic_model.visualize_topics()
        fig1.write_html(os.path.join(out_dir, "topics_map.html"))
        
        fig2 = topic_model.visualize_barchart(top_n_topics=20)
        fig2.write_html(os.path.join(out_dir, "topic_keywords.html"))
        
        # Save Model Info
        freq.to_csv(os.path.join(out_dir, "topic_info.csv"), index=False)
        
        print(f"✅ BERTopic analysis complete. Results in: {out_dir}")
        print("👉 Open 'topics_map.html' in your browser.")
        
    except Exception as e:
        print(f"Visualization failed (maybe data too small?): {e}")

if __name__ == "__main__":
    main()
