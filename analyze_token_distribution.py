
import json
import argparse
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import tiktoken
import os

def analyze_jsonl(file_path, field_name):

    token_counts = []
    # Using cl100k_base encoder, which is used by models like gpt-3.5-turbo and gpt-4.
    # It serves as a reasonable approximation for Gemini models.
    encoding = tiktoken.get_encoding("cl100k_base")
    
    print(f"Reading file: {file_path}")
    print(f"Analyzing field: '{field_name}'")
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            for i, line in enumerate(f):
                try:
                    data = json.loads(line)
                    content = data.get(field_name, "")
                    if content:
                        # Calculate number of tokens
                        num_tokens = len(encoding.encode(content))
                        token_counts.append(num_tokens)
                    else:
                        print(f"Warning: Line {i+1} has no '{field_name}' field or is empty.")
                except json.JSONDecodeError:
                    print(f"Warning: Could not parse JSON on line {i+1}.")
        print(f"Successfully processed {len(token_counts)} entries.")
        return token_counts
    except FileNotFoundError:
        print(f"Error: File not found at {file_path}")
        return None

def print_statistics(token_counts):
    """Prints statistical information about token counts."""
    if not token_counts:
        print("No token data to calculate statistics.")
        return

    stats = {
        "Total Entries": len(token_counts),
        "Average Tokens": f"{np.mean(token_counts):.2f}",
        "Median Tokens": np.median(token_counts),
        "Max Tokens": np.max(token_counts),
        "Min Tokens": np.min(token_counts),
        "Std Dev of Tokens": f"{np.std(token_counts):.2f}",
        "25th Percentile": np.percentile(token_counts, 25),
        "75th Percentile": np.percentile(token_counts, 75)
    }
    
    print("\n--- Token Statistics ---")
    for key, value in stats.items():
        print(f"{key}: {value}")
    print("------------------------\n")

def plot_distribution(token_counts, field_name, output_filename="token_distribution.png"):
    """Plots and saves the token count distribution."""
    if not token_counts:
        print("No data to plot.")
        return

    plt.figure(figsize=(12, 7))
    sns.set_style("whitegrid")
    
    # Plot histogram and kernel density estimate
    sns.histplot(token_counts, kde=True, bins=50)
    
    # Add statistical lines
    plt.axvline(np.mean(token_counts), color='r', linestyle='--', linewidth=2, label=f'Mean: {np.mean(token_counts):.2f}')
    plt.axvline(np.median(token_counts), color='g', linestyle='-', linewidth=2, label=f'Median: {np.median(token_counts)}')
    
    plt.title(f"Token Count Distribution for '{field_name}'", fontsize=16)
    plt.xlabel('Number of Tokens', fontsize=12)
    plt.ylabel('Frequency', fontsize=12)
    plt.legend()
    
    try:
        plt.savefig(output_filename)
        print(f"Chart saved to: {os.path.abspath(output_filename)}")
    except Exception as e:
        print(f"Error saving chart: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analyze the token distribution for a specified field in a JSONL file.")
    parser.add_argument("file_path", type=str, help="Path to the .jsonl file to be analyzed.")
    parser.add_argument("--field", type=str, default="context", help="The JSON field to analyze (default: context).")
    
    args = parser.parse_args()
    
    token_counts = analyze_jsonl(args.file_path, args.field)
    
    if token_counts:
        print_statistics(token_counts)
        plot_distribution(token_counts, args.field)
