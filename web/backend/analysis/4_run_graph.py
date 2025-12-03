import os
import pandas as pd
import numpy as np
import networkx as nx
from sklearn.neighbors import NearestNeighbors
import matplotlib.pyplot as plt

def main():
    print(">>> Step 4: Running Graph Network Analysis...")
    
    pkl_path = os.path.join(os.path.dirname(__file__), 'dataset.pkl')
    if not os.path.exists(pkl_path):
        print("Error: dataset.pkl not found.")
        return

    df = pd.read_pickle(pkl_path)
    embeddings = np.array(df['dense'].tolist())
    
    # 1. Build KNN Graph
    k_neighbors = 5
    print(f"Building KNN Graph (k={k_neighbors})...")
    
    nbrs = NearestNeighbors(n_neighbors=k_neighbors, metric='cosine').fit(embeddings)
    distances, indices = nbrs.kneighbors(embeddings)
    
    G = nx.Graph()
    
    # Add nodes
    for i in range(len(df)):
        G.add_node(i, subject=df.iloc[i].get('subject', 'unknown'))
        
    # Add edges
    for i in range(len(df)):
        for j_idx, neighbor_i in enumerate(indices[i]):
            if i == neighbor_i: continue # Skip self
            # Add edge, weight = similarity (1 - distance)
            weight = 1 - distances[i][j_idx]
            if weight > 0.7: # Only keep strong connections
                G.add_edge(i, neighbor_i, weight=weight)
                
    print(f"Graph stats: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    
    # 2. Analyze Components (Islands)
    components = list(nx.connected_components(G))
    print(f"Number of connected components (Islands): {len(components)}")
    
    # Sort islands by size
    components.sort(key=len, reverse=True)
    print(f"Largest component size: {len(components[0])}")
    if len(components) > 1:
        print(f"Second largest: {len(components[1])}")
        print(f"Number of single isolated nodes: {sum(1 for c in components if len(c) == 1)}")
    
    # 3. Centrality (Top 5 Important Nodes)
    # Degree centrality is fast
    print("Calculating centrality...")
    degree_dict = nx.degree_centrality(G)
    top_nodes = sorted(degree_dict.items(), key=lambda x: x[1], reverse=True)[:5]
    
    print("\n🏆 Top 5 Central Nodes (Knowledge Hubs):")
    for node_idx, score in top_nodes:
        row = df.iloc[node_idx]
        print(f" - [{row.get('subject')}] {row.get('text')[:30]}... (Score: {score:.4f})")
        
    # 4. Save Gephi File (Optional)
    out_dir = os.path.join(os.path.dirname(__file__), 'graph_output')
    os.makedirs(out_dir, exist_ok=True)
    
    # Saving as GEXF for Gephi
    # nx.write_gexf(G, os.path.join(out_dir, "knowledge_graph.gexf"))
    # print(f"Graph saved to {out_dir}/knowledge_graph.gexf (Use Gephi to open)")

    # 5. Simple Matplotlib Plot (of the largest component)
    # Only plot if small enough, otherwise it's a mess
    if len(components[0]) < 1000:
        print("Plotting largest component...")
        subgraph = G.subgraph(components[0])
        pos = nx.spring_layout(subgraph, seed=42)
        plt.figure(figsize=(10, 10))
        nx.draw(subgraph, pos, node_size=20, alpha=0.6)
        plt.title("Largest Knowledge Cluster")
        plt.savefig(os.path.join(out_dir, "cluster_plot.png"))
        print(f"Plot saved to {out_dir}/cluster_plot.png")
    else:
        print("Graph too large to plot statically. Use Gephi.")

    print("✅ Graph analysis complete.")

if __name__ == "__main__":
    main()
