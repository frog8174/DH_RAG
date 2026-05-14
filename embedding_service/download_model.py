# download_model.py
# This script is used during the Docker build process to pre-download the model
# from Hugging Face. This ensures the model is baked into the image and avoids
# a long download time on the container's first startup.

from langchain_community.embeddings import HuggingFaceEmbeddings

MODEL_NAME = "BAAI/bge-m3"

print(f"Downloading and caching model: {MODEL_NAME}")

try:
    # Just initializing the class is enough to trigger the download
    HuggingFaceEmbeddings(model_name=MODEL_NAME)
    print("Model download complete.")
except Exception as e:
    print(f"An error occurred during model download: {e}")
    # Exit with a non-zero code to fail the Docker build if download fails
    exit(1)
