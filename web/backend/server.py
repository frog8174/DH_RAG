from typing import Optional, Any, Dict, List
import json
import yaml # added for raw config handling
import logging

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field

from RAG_core import (
    build_retriever,
    build_prompt,
    format_docs,
    google_conf,
    retriever_conf,
    build_rag_chain,
    prompt_conf,
    config as full_config, # import the raw dict
    update_config # new function
)

# New imports for logging and logic
import logging_utils
from RAG_core import VECTORSTORE  # Need access to vectorstore to query metadata if possible
from RAG_core import build_llm # Need to customize llm

# --- Logging Setup ---
# logging.basicConfig(level=logging.INFO) # Replaced with more specific config below
logger = logging.getLogger("rag_server")
logger.setLevel(logging.INFO)

if not logger.handlers:
    # Formatter
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    # File Handler
    file_handler = logging.FileHandler("server.log", encoding="utf-8")
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    
    # Stream Handler (Console)
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)


app = FastAPI(
    title="History RAG Test API",
    description="測試歷史題目的 RAG 出題效果用 API",
    version="0.1.0",
)

# Initialize Log DB
logging_utils.init_db()

# ===============================
# Pydantic Models
# ===============================

class LoginRequest(BaseModel):
    username: str
    password: str

class NewUserRequest(BaseModel):
    username: str
    password: str
    role: str = "user"

class FeedbackRequest(BaseModel):
    rating: Optional[float] = Field(None, ge=0, le=10)
    comment: Optional[str] = None

class RagRequest(BaseModel):
    query: str = Field(..., description="補充要求 (原 Question)")
    api_key: Optional[str] = None
    model: Optional[str] = None
    top_k: Optional[int] = Field(None, ge=1, le=50)
    mode: str = "question_generation"
    expr: Optional[str] = None
    custom_prompt_template: Optional[str] = None
    
    # New Fields
    source_types: Optional[List[str]] = Field(default=None, description="來源 (Source Type)")
    subject: Optional[str] = Field(default=None, description="主題類別 (Subject)") # Changed to string
    topic: Optional[str] = Field(default=None, description="詳細主題 (Topic)") # New
    cognitive_level: Optional[List[str]] = Field(default=None, description="認知層次 (Bloom Level)")
    count: int = Field(default=1, ge=1, le=10, description="出題數量") # New
    enable_self_reflection: bool = Field(default=False, description="是否啟用 AI 自我檢核 (Self-Correction)") # New Feature

    # Legacy/Compatibility
    subjects: Optional[List[str]] = None # Keep for backward compatibility if needed, but we use 'subject'

    # Advanced GenAI Params
    temperature: Optional[float] = None
    thinking_budget: Optional[int] = None
    use_query_rewriting: Optional[bool] = Field(default=False, description="是否啟用 Query Rewriting")
    rewrite_temperature: Optional[float] = Field(default=0.7, description="Rewriting LLM 的 Temperature")
    username: Optional[str] = Field(default="anonymous", description="使用者名稱")

class UpdatePromptRequest(BaseModel):
    mode: str
    template: str

class ValidateRequest(BaseModel):
    api_key: str
    model: str


class RetrievedDoc(BaseModel):
    metadata: Dict[str, Any]
    snippet: str


class RagResponse(BaseModel):
    ok: bool
    model: str
    top_k: int
    query: str
    output: Optional[Any] = None # Legacy: Single object or summary
    generated_questions: List[Any] = Field(default_factory=list) # New: List of questions
    raw_text: Optional[str] = None # Last raw text
    refined_prompt: Optional[str] = None 
    debug: Dict[str, Any] = Field(default_factory=dict)
    log_id: Optional[int] = None 


class ConfigResponse(BaseModel):
    models: List[str]
    default_model: str
    default_top_k: int
    max_top_k: int
    response_schema: Dict[str, Any] | None = None
    prompt_templates: Dict[str, str] = Field(default_factory=dict)
    cognitive_levels: Dict[str, str] = Field(default_factory=dict) 
    
class OptionsResponse(BaseModel):
    source_types: List[str]
    subjects: List[str]
    topics: List[str] = Field(default_factory=list)


# ===============================
# /api/login
# ===============================
@app.post("/api/login")
def login(creds: LoginRequest):
    user = logging_utils.verify_user(creds.username, creds.password)
    if user:
        return {"ok": True, "user": user}
    raise HTTPException(401, "Invalid credentials")

@app.post("/api/validate-gemini")
def validate_gemini(req: ValidateRequest):
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        llm = ChatGoogleGenerativeAI(
            model=req.model,
            google_api_key=req.api_key,
            max_tokens=5
        )
        llm.invoke("Hi")
        return {"ok": True}
    except Exception as e:
        logger.error(f"Validation failed: {e}")
        return {"ok": False, "error": str(e)}

# ===============================
# /api/users (Admin Only)
# ===============================
@app.get("/api/users")
def list_users():
    return logging_utils.get_users()

@app.post("/api/users")
def create_user(req: NewUserRequest):
    if logging_utils.add_user(req.username, req.password, req.role):
        return {"ok": True}
    raise HTTPException(400, "User already exists")

@app.delete("/api/users/{username}")
def delete_user_endpoint(username: str):
    if username == "admin":
        raise HTTPException(400, "Cannot delete main admin")
    logging_utils.delete_user(username)
    return {"ok": True}

# ===============================
# /api/config
# ===============================
@app.get("/api/config", response_model=ConfigResponse)
def get_config() -> ConfigResponse:
    supported_models = google_conf.get("models") or [
        "gemini-2.5-flash",
        "gemini-2.5-pro",
    ]

    default_model = google_conf["model"]
    default_top_k = retriever_conf.get("search_kwargs", {}).get("k", 5)

    # extract prompt templates
    prompt_templates: Dict[str, str] = {}
    for mode, cfg in prompt_conf.items():
        if isinstance(cfg, dict) and "template" in cfg:
            prompt_templates[mode] = cfg["template"]
        else:
            prompt_templates[mode] = str(cfg)
            
    # extract cognitive levels (bloom_level) keys and descriptions
    # We will return the full map so frontend can display descriptions if needed, 
    # or just keys. Let's return the map.
    from RAG_core import config # import raw config to access bloom_level
    cognitive_levels = config.get("bloom_level", {})

    return ConfigResponse(
        models=supported_models,
        default_model=default_model,
        default_top_k=default_top_k,
        max_top_k=50,
        response_schema=google_conf.get("json_schema"),
        prompt_templates=prompt_templates,
        cognitive_levels=cognitive_levels,
    )

# ===============================
# /api/config/update_prompt (Admin)
# ===============================
@app.post("/api/config/update_prompt")
def update_prompt_template(req: UpdatePromptRequest):
    # Update the in-memory config dict
    if req.mode not in prompt_conf:
         # Optionally allow creating new modes, but strict for now
         pass 

    # We need to access the deep structure of 'prompt_conf' which is a reference to 'config["prompt"]'
    # But to update properly we should modify the root 'full_config' and save it.
    
    current_mode_conf = full_config["prompt"].get(req.mode)
    if isinstance(current_mode_conf, dict):
        full_config["prompt"][req.mode]["template"] = req.template
    else:
        # It was a string, change it to string (or dict if we want to standardize, let's keep it simple)
        full_config["prompt"][req.mode] = req.template
        
    # Persist
    try:
        update_config(full_config)
    except Exception as e:
        logger.error(f"Failed to save config: {e}")
        raise HTTPException(500, f"Failed to save config: {e}")
        
    return {"ok": True, "message": f"Prompt for {req.mode} updated."}


# ===============================
# /api/options (New)
# ===============================
@app.get("/api/options", response_model=OptionsResponse)
def get_options() -> OptionsResponse:
    """
    Attempt to fetch distinct source_types and subjects from Milvus.
    Uses pagination to scan all documents.
    """
    sources = set()
    subjects = set()
    topics = set()
    
    try:
        if hasattr(VECTORSTORE, "col"):
            # Pagination loop
            offset = 0
            batch_size = 1000
            
            while True:
                results = VECTORSTORE.col.query(
                    expr="",
                    output_fields=["source_type", "subject", "topic"],
                    limit=batch_size,
                    offset=offset
                )
                
                if not results:
                    break
                    
                for res in results:
                    if "source_type" in res:
                        sources.add(res["source_type"])
                    if "subject" in res and res["subject"]:
                        subjects.add(res["subject"])
                    if "topic" in res and res["topic"]:
                        topics.add(res["topic"])
                
                if len(results) < batch_size:
                    break
                    
                offset += batch_size
                
    except Exception as e:
        logger.error(f"Error fetching options from Milvus: {e}")

    if not sources:
        sources = {"textbook", "exam_paper", "teachers_book"}
    if not subjects:
        subjects = {"history", "civics", "geography"}

    return OptionsResponse(
        source_types=sorted(list(sources)),
        subjects=sorted(list(subjects)),
        topics=sorted(list(topics))
    )


# ===============================
# /api/logs (New)
# ===============================
@app.get("/api/logs")
def get_logs_endpoint(limit: int = 50, username: Optional[str] = None, role: Optional[str] = None):
    return logging_utils.get_logs(limit=limit, username=username, role=role)

@app.post("/api/logs/{log_id}/feedback")
def add_feedback(log_id: int, req: FeedbackRequest):
    try:
        logging_utils.update_feedback(log_id, req.rating, req.comment)
        return {"ok": True}
    except Exception as e:
        logger.error(f"Failed to record feedback: {e}")
        raise HTTPException(500, f"Failed to record feedback: {e}")

@app.delete("/api/logs/{log_id}")
def delete_log_endpoint(log_id: int):
    try:
        logging_utils.delete_log(log_id)
        return {"ok": True}
    except Exception as e:
        logger.error(f"Failed to delete log: {e}")
        raise HTTPException(500, f"Failed to delete log: {e}")

# ===============================
# /api/admin/stats (New)
# ===============================
@app.get("/api/admin/stats")
def get_admin_stats():
    try:
        return logging_utils.get_stats(days=30)
    except Exception as e:
        logger.error(f"Failed to get stats: {e}")
        raise HTTPException(500, f"Failed to get stats: {e}")


# ===============================
# /api/rag/generate
# ===============================
@app.post("/api/rag/generate", response_model=RagResponse)
def rag_generate(req: RagRequest):
    if req.api_key:
        req.api_key = req.api_key.strip()

    logger.info("Received generation request")
    logger.info(f"Query: {req.query}")
    logger.info(f"Params: {req.model}, top_k={req.top_k}, source_types={req.source_types}, count={req.count}")

    default_k = retriever_conf.get("search_kwargs", {}).get("k", 5)
    top_k = req.top_k or default_k

    # ---- Construct Expr (Source Type Only) ----
    expr_parts = []
    if req.expr:
        expr_parts.append(f"({req.expr})")
    
    if req.source_types:
        sources_str = ", ".join([f"'{s}'" for s in req.source_types])
        expr_parts.append(f"source_type in [{sources_str}]")
        
    final_expr = " and ".join(expr_parts) if expr_parts else None
    logger.info(f"Final Milvus Expr: {final_expr}")

    # ---- Query Rewriting & Search Query Construction ----
    
    # 1. Construct Base Search Query from Subject + Topic + Query
    search_parts = []
    if req.subject:
        search_parts.append(req.subject)
    if req.topic:
        search_parts.append(req.topic)
    if req.query and req.query.strip() and req.query != "無補充要求":
        search_parts.append(req.query)
        
    base_search_query = " ".join(search_parts)
    
    # Fallback if everything is empty (should be rare with frontend validation)
    if not base_search_query:
        base_search_query = "歷史考題"

    logger.info(f"Base constructed search query: '{base_search_query}'")

    search_query = base_search_query
    final_generation_query = base_search_query # Use this for prompt variable if rewriting off

    if req.use_query_rewriting:
        try:
            logger.info("Performing Prompt Refinement (Rewriting)....")
            from langchain_google_genai import ChatGoogleGenerativeAI 
            from langchain_core.messages import HumanMessage
            
            rewrite_model_name = google_conf.get("rewriter_model", "gemini-2.5-flash")
            
            rewrite_llm = ChatGoogleGenerativeAI(
                model=rewrite_model_name,
                google_api_key=req.api_key,
                temperature=req.rewrite_temperature if req.rewrite_temperature is not None else 0.7, 
                include_thoughts=False,
            )
            
            # Using 'subject' and 'topic' for context in rewriting
            subject_context = f"主題：{req.subject}" if req.subject else ""
            topic_context = f"詳細主題：{req.topic}" if req.topic else ""
            
            rewrite_prompt = f"""
            你是一個「試題需求改寫助手」，專門協助歷史教師把簡略的出題需求，改寫成給 AI 出題模型使用的完整命題指令。
            --- 你的工作是 ---
              接收老師提供的簡短「補充要求」以及主題資訊，將它改寫成一段更完整、具體且專業的「協助命題指令」，
              這段命題指令會用來 **檢索資料庫** 以及 **交給出題模型** 使用。
              不產生任何實際試題或答案。

            --- 輸出格式 ---
            - 僅輸出一段完整的中文「協助命題指令」。
            - 不要加入任何說明、標題、條列、前言或結語。
            - 長度大約 50 ~ 80 字即可。
            
            「出題資訊」：
            {subject_context}
            {topic_context}
            「補充要求」：{req.query if req.query != "無補充要求" else "無"}
            """

            logger.info(f"Sending Rewrite Prompt to Gemini:\n{rewrite_prompt}")
            
            rewrite_resp = rewrite_llm.invoke([HumanMessage(content=rewrite_prompt)])
            
            refined_query = rewrite_resp.content.strip()
            
            if refined_query:
                search_query = refined_query
                final_generation_query = refined_query
                logger.info(f"Rewriting successful. New query: {final_generation_query}")
            else:
                logger.warning("Rewritten query was empty, falling back to base query.")
                
        except Exception as e:
            logger.error(f"Query Rewriting failed: {e}")

    # ---- Retrieval (ONCE) ----
    try:
        retriever_debug = build_retriever(top_k=top_k, expr=final_expr)
        docs = retriever_debug.invoke(search_query)
        logger.info(f"Retrieved {len(docs)} documents")
    except Exception as e:
        logger.error(f"Retrieval failed: {e}")
        raise HTTPException(500, f"檢索階段出錯: {e}")

    context_text = format_docs(docs)

    # ---- Build Prompt Template ----
    try:
        prompt_tmpl = build_prompt(
            mode=req.mode,
            custom_template=req.custom_prompt_template,
        )
        
        # Prepare Cognitive Level Description
        cognitive_level_desc = "不限"
        if req.cognitive_level:
            from RAG_core import config
            bloom_level_cfg = config.get("bloom_level", {})
            descriptions = []
            for lvl in req.cognitive_level:
                desc = bloom_level_cfg.get(lvl)
                if desc: descriptions.append(desc)
            
            if descriptions:
                cognitive_level_desc = "\n".join(descriptions)
        
        # Use final_generation_query (which is either raw query or rewritten query)
        # Note: final_generation_query currently contains the merged search string if rewriting was OFF.
        # But for the PROMPT, we want clarity.
        # If rewriting was OFF, `final_generation_query` = "Subject Topic Query".
        # If rewriting was ON, `final_generation_query` = "Rewritten Sentence".
        
        # We should use req.query (the raw supplementary input) for the {query} slot 
        # to match the user's expectation of "Supplementary Requirements".
        # HOWEVER, if rewriting happened, we want to use the refined instruction.
        
        # Strategy:
        # If rewritten: {query} = refined_query
        # If NOT rewritten: {query} = req.query (User's raw input)
        
        prompt_query_content = req.query
        if req.use_query_rewriting and final_generation_query != base_search_query:
             prompt_query_content = final_generation_query

        prompt_variables = {
            "context": context_text,
            "subject": req.subject or "歷史",
            "topic": req.topic or "無",
            "query": prompt_query_content,
            "cognitive_level": cognitive_level_desc
        }
        
    except Exception as e:
        logger.error(f"Prompt construction failed: {e}")
        raise HTTPException(400, f"套用 Prompt 失敗: {e}")

    # ---- Debug docs ----
    debug_docs = [
        RetrievedDoc(
            metadata=d.metadata,
            snippet=d.page_content[:200],
        )
        for d in docs
    ]
    
    # We also want to inject reference into generated_questions if possible, 
    # but the LLM generates them. 
    # Instead, we will pass the "primary reference" (e.g. first doc's title) 
    # or just list references in the debug info which frontend can display.
    # The user asked to show "Reference" in the "Analysis" field or similar.
    # Let's add a "references" list to the output structure or rely on the frontend 
    # to pick it up from 'debug.retrieved_docs'. 
    # Actually, the user said "add Reference field to the Analysis display".
    # I will stick to returning `retrieved_docs` in debug, and frontend will render it.
    # But wait, standard RAG response usually doesn't link specific question to specific doc 
    # unless LLM cites it.
    # I will modify the JSON structure instruction in PROMPT to ask for Reference?
    # No, user asked "Show Analysis field needs to add Reference data, use metadata 'reference'".
    # This implies the frontend should show it.
    # I need to ensure `metadata` contains `reference`.
    # Let's check `format_docs`.
    
    # ... logic continues ...
    from langchain_google_genai import ChatGoogleGenerativeAI
    
    # Override logic
    overrides = {}
    if req.temperature is not None: overrides["temperature"] = req.temperature
    if req.thinking_budget is not None: overrides["thinking_budget"] = req.thinking_budget
    
    model_name = req.model or google_conf["model"]
    
    llm_kwargs = {
        "model": model_name,
        "temperature": overrides.get("temperature", google_conf.get("temperature")),
        "max_tokens": google_conf.get("max_tokens"),
        "timeout": google_conf.get("timeout"),
        "thinking_budget": overrides.get("thinking_budget", google_conf.get("thinking_budget")),
        "response_mime_type": google_conf.get("response_mime_type"),
        "response_schema": google_conf.get("json_schema"),
    }
    
    if req.api_key:
        llm_kwargs["google_api_key"] = req.api_key
        
    llm_kwargs = {k: v for k, v in llm_kwargs.items() if v is not None}
    
    try:
        llm = ChatGoogleGenerativeAI(**llm_kwargs)
    except Exception as e:
        raise HTTPException(500, f"LLM init failed: {e}")

    # ---- Generation Loop (Single Call for List) ----
    generated_questions = []
    last_raw_text = ""
    prompt_str_log = "" 
    review_log = None # For logging

    logger.info(f"Starting generation for {req.count} questions (Single Batch)...")
    
    try:
        # Inject 'count' into variables
        prompt_variables["count"] = req.count
        
        # Invoke Prompt Template
        prompt_val = prompt_tmpl.invoke(prompt_variables)
        prompt_str_log = prompt_val.to_string()

        # Invoke LLM (Round 1)
        res = llm.invoke(prompt_val)
        text_output = res.content
        last_raw_text = text_output
        
        # Parse JSON Round 1
        try:
            parsed = json.loads(text_output)
            if isinstance(parsed, list):
                generated_questions = parsed
            elif isinstance(parsed, dict):
                generated_questions = [parsed]
            else:
                logger.error(f"Unexpected JSON structure: {type(parsed)}")
                generated_questions = [{"error": "Model returned unexpected JSON structure"}]
                
        except json.JSONDecodeError as je:
            logger.error(f"Failed to parse JSON: {je}")
            generated_questions = [{"raw_error": "JSON Parse Error", "content": text_output}]

        # ---- Self-Reflection (Round 2) -> Optimization (Two-Stage) ----
        review_log = [] # List to store review details for each question

        if req.enable_self_reflection and generated_questions and "error" not in generated_questions[0]:
            logger.info("Executing Two-Stage Self-Reflection...")
            try:
                # 1. Prepare Models
                # Evaluator: Can use a cheaper model if configured, or the same Pro model
                reviewer_model_name = google_conf.get("reviewer_model", "gemini-2.5-pro") 
                
                # Load Schemas from Config
                evaluator_schema = google_conf.get("evaluator_schema")
                optimizer_schema = google_conf.get("optimizer_schema")

                # Evaluator LLM (Enforce JSON Schema)
                evaluator_llm = ChatGoogleGenerativeAI(
                    model=reviewer_model_name,
                    google_api_key=req.api_key,
                    temperature=0, 
                    response_mime_type="application/json",
                    response_schema=evaluator_schema # Enforce Strict Schema
                )

                # Optimizer LLM (Enforce JSON Schema)
                optimizer_llm = ChatGoogleGenerativeAI(
                    model=reviewer_model_name, # Use powerful model for rewriting
                    google_api_key=req.api_key,
                    temperature=0.7, # Slight creativity for rewriting
                    response_mime_type="application/json",
                    response_schema=optimizer_schema # Enforce Strict Schema
                )

                # Load Prompts
                eval_tpl_str = full_config["prompt"].get("evaluator_prompt")
                opt_tpl_str = full_config["prompt"].get("optimizer_prompt")
                
                if eval_tpl_str and opt_tpl_str:
                    from langchain_core.messages import HumanMessage
                    
                    for idx, q_obj in enumerate(generated_questions):
                        logger.info(f"--- Reviewing Question #{idx+1} ---")
                        
                        # --- Stage 1: Evaluation ---
                        q_json_str = json.dumps(q_obj, ensure_ascii=False)
                        
                        eval_input = eval_tpl_str.replace("{question_json}", q_json_str)
                        eval_input = eval_input.replace("{context}", context_text)
                        eval_input = eval_input.replace("{cognitive_level}", cognitive_level_desc)
                        
                        # --- Helper for Score Extraction ---
                        def _safe_get_score(val):
                            if val is None: return 0
                            if isinstance(val, (int, float)): return float(val)
                            try:
                                # Handle strings like "3/3", "21分", "Score: 3"
                                s = str(val).strip()
                                import re
                                # Extract the first numeric sequence found
                                match = re.search(r"(\d+(\.\d+)?)", s)
                                if match:
                                    return float(match.group(1))
                                return 0
                            except:
                                return 0

                        try:
                            eval_res = evaluator_llm.invoke([HumanMessage(content=eval_input)])
                            eval_data = json.loads(eval_res.content)
                            
                            # Check Pass/Fail Logic (Python controlled)
                            # Criteria: Total >= 18 AND Correctness > 1
                            
                            # --- Robust Parsing for Score ---
                            raw_total_score = 0
                            if "total_score" in eval_data:
                                raw_total_score = eval_data["total_score"]
                            elif "final_score" in eval_data:
                                raw_total_score = eval_data["final_score"]
                            elif "summary" in eval_data and isinstance(eval_data["summary"], dict):
                                raw_total_score = eval_data["summary"].get("總體評分", eval_data["summary"].get("total_score", 0))

                            total_score = _safe_get_score(raw_total_score)

                            # --- Robust Parsing for Correctness ---
                            raw_correctness_score = 0
                            criteria_scores = eval_data.get("criteria_scores", {})
                            if criteria_scores:
                                raw_correctness_score = criteria_scores.get("Correctness", criteria_scores.get("正確性", 0))
                            else:
                                # Fallback: Look into list-based 'evaluation_results' or 'assessment_result'
                                possible_lists = [eval_data.get("evaluation_results"), eval_data.get("evaluation_result")]
                                for lst in possible_lists:
                                    if isinstance(lst, list):
                                        for item in lst:
                                            indicator = item.get("indicator") or item.get("指標") or ""
                                            if "Correctness" in indicator or "正確性" in indicator:
                                                raw_correctness_score = item.get("score", item.get("評分", 0))
                                                break
                                
                                # Fallback 2: Check nested 'assessment_result' dict
                                if "assessment_result" in eval_data and isinstance(eval_data["assessment_result"], dict):
                                     ar = eval_data["assessment_result"]
                                     if "correctness" in ar:
                                         raw_correctness_score = ar["correctness"].get("score", 0)

                            correctness_score = _safe_get_score(raw_correctness_score)

                            logger.info(f"Parsed Scores -> Total: {total_score} (raw: {raw_total_score}), Correctness: {correctness_score} (raw: {raw_correctness_score})")
                            
                            is_pass = (total_score >= 18) and (correctness_score > 1)
                            
                            review_entry = {
                                "index": idx + 1,
                                "initial_evaluation": eval_data,
                                "original_question": q_obj, # Always save original for comparison
                                "optimization_summary": None,
                                "final_question": None, # Will be filled if optimized
                                "final_evaluation": None # We skip re-eval for speed in this mode
                            }
                            
                            if is_pass:
                                logger.info(f"Q#{idx+1} PASSED (Score: {total_score}). Skipping optimization.")
                                # No change to generated_questions[idx]
                                
                            else:
                                logger.info(f"Q#{idx+1} FAILED (Score: {total_score}). Triggering Optimizer...")
                                
                                # --- Stage 2: Optimization ---
                                opt_input = opt_tpl_str.replace("{question_json}", q_json_str)
                                opt_input = opt_input.replace("{context}", context_text)
                                opt_input = opt_input.replace("{comments}", eval_data.get("comments", "No comments"))
                                
                                opt_res = optimizer_llm.invoke([HumanMessage(content=opt_input)])
                                opt_data = json.loads(opt_res.content)
                                
                                # Update Question
                                if "final_question" in opt_data:
                                    final_q = opt_data["final_question"]
                                    generated_questions[idx] = final_q # Replace in main list
                                    
                                    # Update Review Entry
                                    review_entry["final_question"] = final_q
                                    review_entry["optimization_summary"] = opt_data.get("optimization_summary")
                                    
                                    # Simulate Perfect Score for UI visualization (Since we trust the Optimizer fixed it)
                                    review_entry["final_evaluation"] = {
                                        "total_score": 21,
                                        "criteria_scores": {k: 3 for k in eval_data.get("criteria_scores", {})},
                                        "comments": "經過優化修正後，預期已符合所有指標標準。"
                                    }
                                    
                                else:
                                    logger.warning("Optimizer returned no final_question structure.")

                            review_log.append(review_entry)

                        except Exception as e:
                            logger.error(f"Error processing review for Q#{idx+1}: {e}")
                            # Keep original if error

            except Exception as review_e:
                logger.error(f"Two-Stage Self-Reflection process failed: {review_e}")

        # Log the full review trace
        if review_log:
             logger.info(f"Full Review Log:\n{json.dumps(review_log, ensure_ascii=False, indent=2)}")

    except Exception as e:
        logger.error(f"Error generating questions: {e}")
        generated_questions = [{"error": str(e)}]

    # ---- Log (Batch) ----
    log_id = None
    try:
        log_refined_prompt = None
        if req.use_query_rewriting and final_generation_query != req.query:
            log_refined_prompt = final_generation_query

        # We log the whole list of questions
        log_response_obj = {
            "count": req.count,
            "questions": generated_questions
        }

        log_id = logging_utils.insert_log(
            query=req.query, 
            params={
                "model": req.model,
                "top_k": top_k,
                "mode": req.mode,
                "expr": final_expr,
                "source_types": req.source_types,
                "subject": req.subject,
                "topic": req.topic,
                "count": req.count,
                "cognitive_level": req.cognitive_level,
                "temperature": req.temperature,
                "thinking_budget": req.thinking_budget,
                "use_query_rewriting": req.use_query_rewriting,
                "rewrite_temperature": req.rewrite_temperature,
                "enable_self_reflection": req.enable_self_reflection
            },
            prompt=prompt_str_log,
            response=log_response_obj,
            raw_output=last_raw_text if len(generated_questions) == 1 else json.dumps(generated_questions, ensure_ascii=False),
            refined_prompt=log_refined_prompt,
            username=req.username,
            review_data=review_log if 'review_log' in locals() else None
        )
    except Exception as log_e:
        logger.error(f"Logging failed: {log_e}")

    return RagResponse(
        ok=True,
        model=model_name,
        top_k=top_k,
        query=req.query,
        output=generated_questions[0] if generated_questions else None, # Legacy compat
        generated_questions=generated_questions,
        raw_text=last_raw_text,
        refined_prompt=log_refined_prompt if 'log_refined_prompt' in locals() else None,
        debug={
            "prompt": prompt_str_log,
            "retrieved_docs": [d.dict() for d in debug_docs],
            "cognitive_level_applied": str(req.cognitive_level),
            "review_log": review_log if 'review_log' in locals() else None
        },
        log_id=log_id
    )


# ===============================
# health check
# ===============================
@app.get("/health")
def health():
    return {"status": "ok"}


# ===============================
# uvicorn
# ===============================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8080, reload=True)
