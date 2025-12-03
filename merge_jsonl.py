import os
import datetime
import glob

def merge_jsonl_files():
    """
    Merges all .jsonl files in the data_jsonl directory into a single
    file named with the current date (YYYY-MM-DD.jsonl).
    """
    input_dir = "data_jsonl"
    output_dir = "data_jsonl"  # Output to the same directory

    # Get current date for the output filename
    current_date = datetime.datetime.now().strftime("%Y-%m-%d")
    output_filename = f"{current_date}.jsonl"
    output_filepath = os.path.join(output_dir, output_filename)

    # Find all .jsonl files in the input directory
    jsonl_files = glob.glob(os.path.join(input_dir, "*.jsonl"))
    
    # Exclude the output file itself if the script is run multiple times on the same day
    if output_filepath in jsonl_files:
        jsonl_files.remove(output_filepath)

    print(f"Merging the following files into {output_filepath}:")
    for f in jsonl_files:
        print(f"- {f}")

    with open(output_filepath, 'w', encoding='utf-8') as outfile:
        for jsonl_file in jsonl_files:
            with open(jsonl_file, 'r', encoding='utf-8') as infile:
                for line in infile:
                    outfile.write(line)
    
    print("Merge complete.")

if __name__ == "__main__":
    merge_jsonl_files()
