# DH-RAG (Digital Humanities Retrieval-Augmented Generation)

這是一個結合了 **Google Gemini**、**LangChain** 與 **Milvus Lite** 的數位人文專案，旨在利用檢索增強生成（RAG）技術，從歷史文獻與教科書資料中提取相關內容，並自動生成高品質的歷史科多選題。

本專案不僅包含核心的 CLI 工具，還提供了一個完整的 **Web 應用程式**（前後端分離），方便使用者透過圖形介面進行出題、管理與測試。

## ✨ 主要功能

*   **智慧出題 (RAG)**：結合語意檢索與 LLM 生成能力，根據指定主題與補充要求，自動產生包含題幹、選項、答案與解析的多選題。
*   **多模式檢索**：支援 **語意檢索 (Semantic)**、**關鍵字檢索 (BM25)** 以及 **混合檢索 (Hybrid)** 模式，確保檢索結果的準確性。
*   **自我修正機制**：內建兩階段自我檢核 (Self-Reflection) 與優化流程，確保生成的試題符合品質標準。
*   **完整資料管線**：提供資料前處理、切分 (Chunking)、向量化與資料庫更新的自動化腳本。
*   **Web 應用介面**：
    *   **前端 (React + Vite)**：直觀的操作介面，支援試題生成、預覽、下載 (Excel/JSON) 與歷史紀錄查看。
    *   **後端 (FastAPI)**：提供 RESTful API，處理使用者認證、RAG 請求、日誌記錄與系統配置。
*   **高度可配置**：透過 `config.yaml` 集中管理模型參數、Prompt 模板與資料庫設定。

---

## 🛠️ 系統架構

專案主要分為三個部分：

1.  **Core RAG (Root)**：包含資料處理腳本與核心 RAG 邏輯 (`RAG.py`, `update_vectordb.py`)。
2.  **Backend (`web/backend`)**：基於 FastAPI 的 API 伺服器，負責與 LLM 及 Milvus 互動。
3.  **Frontend (`web/rag-frontend`)**：基於 React + TypeScript + Vite 的網頁介面。

---

## 🚀 安裝與設定

### 前置需求

*   **Python 3.9+**
*   **Node.js 18+** (用於運行前端)
*   **Google API Key** (需具備 Gemini 模型使用權限)

### 1. 環境變數設定

在專案根目錄建立 `.env` 檔案，並填入您的 Google API Key：

```env
GOOGLE_API_KEY="your_google_api_key_here"
```

### 2. 安裝核心與後端依賴

```bash
# 安裝根目錄核心依賴
pip install -r requirements.txt

# 安裝後端 API 依賴
cd web/backend
pip install -r requirements.txt
cd ../..
```

### 3. 安裝前端依賴

```bash
cd web/rag-frontend
npm install
cd ../..
```

---

## 📖 使用說明

### A. 資料庫管理 (CLI)

在開始生成題目之前，需先建立並填充向量資料庫。

1.  **更新向量資料庫**：
    讀取 `data/` 目錄下的 JSONL 檔案並寫入 Milvus Lite (`milvus_history.db`)。
    ```bash
    python update_vectordb.py
    ```
    *注意：您可能需要修改 `config.yaml` 或腳本中的資料路徑以符合您的需求。*

2.  **讀取資料庫內容** (檢查用)：
    ```bash
    python read_vectordb.py
    ```

3.  **清空資料庫**：
    ```bash
    python delete_vectordb.py
    ```

### B. 執行 RAG 測試 (CLI)

直接在終端機測試 RAG 出題效果：

```bash
python RAG.py
```
*您可以在 `RAG.py` 檔案中修改 `query` 變數來測試不同的出題需求。*

### C. 啟動 Web 應用程式

為了獲得最佳體驗，建議啟動完整的 Web 介面。

1.  **啟動後端伺服器** (Port 8080)：
    ```bash
    cd web/backend
    python server.py
    ```
    *後端啟動後，Swagger API 文件位於：`http://localhost:8080/docs`*

2.  **啟動前端開發伺服器**：
    開啟一個新的終端機視窗：
    ```bash
    cd web/rag-frontend
    npm run dev
    ```
    *預設會在 `http://localhost:5173` 開啟網頁介面。*

---

## ⚙️ 配置說明 (`config.yaml`)

專案的核心設定位於根目錄的 `config.yaml`，主要包含：

*   **google**: 設定 Gemini 模型版本 (如 `gemini-1.5-flash`)、Temperature 等。
*   **milvus**: 設定向量資料庫連線、Collection 名稱與檢索模式 (`semantic`, `hybrid` 等)。
*   **retriever**: 設定檢索回傳的文檔數量 (`k`)。
*   **prompt**: 定義各階段 (出題、評分、優化) 的 Prompt Template。

---

## 📂 專案結構摘要

```text
DH_RAG/
├── config.yaml              # 全域設定檔
├── RAG.py                   # RAG 核心邏輯與 CLI 測試入口
├── update_vectordb.py       # 資料庫更新腳本
├── requirements.txt         # 核心 Python 依賴
├── data/                    # 原始資料來源 (.jsonl)
├── web/
│   ├── backend/             # FastAPI 後端
│   │   ├── server.py        # API 伺服器入口
│   │   ├── RAG_core.py      # RAG 核心功能封裝
│   │   └── logging_utils.py # 日誌與資料庫管理
│   └── rag-frontend/        # React 前端
│       ├── src/             # 前端原始碼
│       ├── package.json     # 前端依賴
│       └── vite.config.ts   # Vite 設定
└── README.md                # 專案說明文件
```

## 📝 授權

本專案供學術研究與數位人文應用參考使用。