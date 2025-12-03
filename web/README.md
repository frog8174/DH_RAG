# Gemini RAG System Technical Documentation

本文件將專案拆分為四個核心技術模組，分別介紹其架構與技術細節。

---

## 1. 後端服務 (Backend API)
**路徑:** `backend/server.py`

基於 FastAPI 構建的高效能後端服務，作為 RAG 系統的核心接口層，負責處理前端請求、用戶驗證以及整合 RAG 核心邏輯。

### 技術堆疊
- **Framework**: FastAPI (Python 3.12+)
- **Server**: Uvicorn
- **Validation**: Pydantic Models
- **Logging**: 自定義日誌系統 (支援 SQLite 儲存與查詢)

### 主要功能
- **命題生成 API** (`POST /api/rag/generate`): 接收前端參數（科目、主題、認知層次等），觸發 RAG 流程並回傳生成的試題。
- **配置管理** (`GET /api/config`): 提供前端動態載入模型選單、Prompt 模板與 Bloom 認知層次定義。
- **自我反思機制**: 實作 Two-Stage Self-Reflection (Evaluator -> Optimizer) 流程控制，提升出題品質。
- **權限與紀錄**: 包含 JWT 基礎的登入驗證與詳細的操作日誌 (Logging Utils)。

---

## 2. RAG 核心邏輯 (RAG Core)
**路徑:** `backend/RAG_core.py`

負責執行檢索增強生成 (Retrieval-Augmented Generation) 的核心業務邏輯模組，封裝了 LangChain 流程、向量檢索與 LLM 互動邏輯。

### 技術堆疊
- **Orchestration**: LangChain
- **LLM**: Google Gemini API (`gemini-2.5-flash` / `gemini-2.5-pro`)
- **Vector Store**: Milvus (via `langchain-milvus`)

### 核心流程
1. **Query Rewriting**: 使用 LLM 將使用者的簡短需求改寫為精確的檢索指令。
2. **Hybrid Retrieval**: 結合語意搜尋 (Dense Vector) 與關鍵字搜尋 (BM25/Sparse) 進行混合檢索。
3. **Context Construction**: 自動格式化檢索到的文檔 (Textbook/Exam Papers)，注入 Metadata (來源、年份)。
4. **Prompt Engineering**: 
   - 動態注入 Bloom's Taxonomy (記憶、理解、應用、分析、評鑑) 指導語。
   - 支援由 `config.yaml` 定義的客製化 Prompt Templates。
5. **Generation**: 呼叫 Google Gemini 模型生成符合 JSON Schema 格式的試題。

---

## 3. 向量資料庫與檢索 (Vector Search)
**路徑:** `backend/config.yaml`, `backend/milvus_history.db`

定義了資料的儲存結構與檢索策略，確保 AI 能參考到準確的領域知識。

### 配置架構 (Configuration)
- **Database**: Milvus (Lite mode / Local file)
- **Collection**: `textbook_teacher`
- **Mode**: Hybrid (混合檢索)

### 檢索策略
- **Semantic Search (Dense)**: 
  - 使用 Embedding 模型捕捉語意關聯。
  - Index Type: `FLAT` (Metric: `IP`)
- **Keyword Search (Sparse/BM25)**: 
  - 使用 BM25 演算法精確匹配歷史專有名詞或特定關鍵字。
  - Index Type: `SPARSE_WAND`
- **Re-ranking**: 透過加權參數平衡兩者的檢索結果 (`search_kwargs: k=5`)。

---

## 4. 前端應用 (Frontend Application)
**路徑:** `rag-frontend/`

基於 React 19 與 Vite 構建的現代化單頁應用 (SPA)，提供教師友善的操作介面，視覺化呈現 RAG 流程與試題結果。

### 技術堆疊
- **Core**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS v4
- **UI Components**: Lucide React (Icons)
- **State/Data**: Axios, Recharts (統計圖表)

### 主要特色
- **動態表單**: 根據後端 Config 動態渲染科目、主題與認知層次選單。
- **即時預覽**: 支援試題生成的串流式 (Streaming) 或分階段顯示。
- **分析儀表板**: 視覺化呈現試題品質檢核結果 (Clarity, Relevance, Correctness 等雷達圖)。
- **匯出功能**: 支援將生成的試題導出為 Word 或 JSON 格式。
- **管理員模式**: 提供 Prompt 編輯器與系統日誌查看器。
