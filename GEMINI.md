# GEMINI.md: Project Overview

## Project Overview

This project is a Python-based Retrieval-Augmented Generation (RAG) system designed to generate multiple-choice history questions. It leverages a knowledge base stored in a local vector database. The system retrieves relevant documents based on a query and then uses a Google Gemini model to generate a well-structured, multiple-choice question complete with a question stem, options, the correct answer, and an explanation.

The entire workflow is orchestrated using the LangChain framework.

**Core Technologies:**

*   **Language Model:** Google Gemini (`gemini-1.5-flash`)
*   **LLM Framework:** LangChain
*   **Vector Database:** Milvus Lite
*   **Embeddings:** Google Embedding models (`gemini-embedding-001`)
*   **Primary Language:** Python

## Key Files and Scripts

*   `RAG.py`: The main entry point for the application. This script loads the vector database, defines the RAG chain using LangChain, and executes a query to generate a question.
*   `update_vectordb.py`: The data ingestion script. It reads data from a `.jsonl` file, processes and chunks the text, generates embeddings, and populates the Milvus vector database.
*   `config.yaml`: A central configuration file that controls all major aspects of the system, including:
    *   Gemini model parameters (model name, temperature, output JSON schema).
    *   Milvus database connection and collection details.
    *   Retrieval mode (`semantic`, `bm25`, or `hybrid`).
    *   The prompt template used for question generation.
*   `requirements.txt`: Lists all the necessary Python dependencies for the project.
*   `read_vectordb.py` / `delete_vectordb.py`: Utility scripts for inspecting and clearing the contents of the Milvus vector database.
*   `utils.py`: Contains helper functions, such as the `RecursiveTextSplitterLite` for document chunking.
*   `data/`: This directory contains the source data used for populating the vector database, specifically in `.jsonl` format.

## Building and Running

This project consists of a series of scripts rather than a single running application. The primary workflow is to first populate the database and then run queries against it.

### 1. Installation

First, install the required Python packages:

```bash
pip install -r requirements.txt
```

You will also need to set your Google API key in an environment variable. You can create a `.env` file in the root directory:

```
GOOGLE_API_KEY="your_google_api_key"
```

### 2. Populating the Vector Database

To load or update the knowledge base, run the `update_vectordb.py` script. This will process the data in `data/sampled_idiom.jsonl` and store it in the Milvus database (`./milvus_history.db`).

```bash
python update_vectordb.py
```

### 3. Generating Questions

To run the RAG process and generate a question, execute the `RAG.py` script. You can modify the `query` variable within this script to change the topic.

```bash
python RAG.py
```

The script will print the retrieved context and the final, structured JSON output containing the generated question.

### 4. Managing the Database

*   **To inspect the database contents:**
    ```bash
    python read_vectordb.py
    ```
*   **To delete the database collection:**
    ```bash
    python delete_vectordb.py
    ```

## Development Conventions

*   **Configuration:** All major settings are centralized in `config.yaml`. This is the primary place to adjust model behavior, database connections, and prompt engineering.
*   **RAG Logic:** The core RAG pipeline is defined in `RAG.py` using LangChain Expression Language (LCEL), providing a clear and modular structure.
*   **Data Ingestion:** The data pipeline is handled by `update_vectordb.py`, which reads from a predefined `.jsonl` file format.
*   **Retrieval Modes:** The system is designed to switch between semantic, BM25, and hybrid search by changing the `mode` parameter in `config.yaml`.
*   **Structured Output:** The Gemini model is configured with a specific JSON schema to ensure that the output is always a consistently formatted multiple-choice question.
