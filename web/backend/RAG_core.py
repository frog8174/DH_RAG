import yaml
from dotenv import load_dotenv
import langchain
from typing import Optional
from langchain_milvus import Milvus, BM25BuiltInFunction
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.runnables import RunnablePassthrough
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from remote_embeddings import RemoteEmbeddings

load_dotenv()

with open("config.yaml", "r", encoding="utf-8") as f:
    config = yaml.safe_load(f)

milvus_conf = config["milvus"]
retriever_conf = config["retriever"]
prompt_conf = config["prompt"]
google_conf = config["google"]


# ---------------------- Milvus Vectorstore --------------------------
def _build_vectorstore():
    mode = milvus_conf.get("mode", "bm25")
    embeddings = RemoteEmbeddings()

    if mode == "semantic":
        vectorstore_loaded = Milvus(
            embedding_function=embeddings,
            text_field=milvus_conf["semantic"]["text_field"],
            vector_field=milvus_conf["semantic"]["vector_field"],
            connection_args=milvus_conf["connection_args"],
            collection_name=milvus_conf["collection_name"],
        )

    elif mode == "bm25":
        builtin_conf = milvus_conf["bm25"]["builtin_function"]
        vectorstore_loaded = Milvus(
            embedding_function=None,
            builtin_function=BM25BuiltInFunction(**builtin_conf),
            text_field=milvus_conf["bm25"]["text_field"],
            vector_field=milvus_conf["bm25"]["vector_field"],
            connection_args=milvus_conf["connection_args"],
            collection_name=milvus_conf["collection_name"],
        )

    elif mode == "hybrid":
        builtin_conf = milvus_conf["hybrid"]["builtin_function"]
        vectorstore_loaded = Milvus(
            embedding_function=embeddings,
            builtin_function=BM25BuiltInFunction(**builtin_conf),
            text_field=milvus_conf["hybrid"]["text_field"],
            vector_field=milvus_conf["hybrid"]["vector_field"],
            connection_args=milvus_conf["connection_args"],
            collection_name=milvus_conf["collection_name"],
        )

    else:
        raise ValueError(f"Unknown Milvus mode: {mode}")

    return vectorstore_loaded


VECTORSTORE = _build_vectorstore()


# ---------------------- LLM --------------------------
def build_llm(api_key: str | None = None, model: str | None = None):
    model_name = model or google_conf["model"]

    kwargs = dict(
        model=model_name,
        temperature=google_conf.get("temperature"),
        max_tokens=google_conf.get("max_tokens"),
        timeout=google_conf.get("timeout"),
        thinking_budget=google_conf.get("thinking_budget"),
        include_thoughts=google_conf.get("include_thoughts"),
        response_mime_type=google_conf.get("response_mime_type"),
        response_schema=google_conf.get("json_schema"),
    )

    if api_key:
        kwargs["api_key"] = api_key

    return ChatGoogleGenerativeAI(**kwargs)


# ---------------------- Prompt --------------------------
def build_prompt(
    mode: str = "question_generation",
    custom_template: Optional[str] = None,
):
    if mode not in prompt_conf:
        raise KeyError(f"未知的 prompt mode: {mode}")

    entry = prompt_conf[mode]
    base_tpl = entry["template"] if isinstance(entry, dict) else str(entry)

    tpl_str = custom_template or base_tpl

    return PromptTemplate(
        template=tpl_str,
        input_variables=["context", "question", "subject", "topic", "query", "cognitive_level", "count"],
    )


# ---------------------- Retriever --------------------------
def build_retriever(top_k: int | None = None, expr: str | None = None):
    search_kwargs = dict(retriever_conf["search_kwargs"])
    if top_k is not None:
        search_kwargs["k"] = top_k

    retriever = VECTORSTORE.as_retriever(search_kwargs=search_kwargs)

    if expr is not None:
        retriever.search_kwargs["expr"] = expr

    return retriever


# ---------------------- Format docs --------------------------
def format_docs(docs):
    out = []
    for doc in docs:
        subject = doc.metadata.get("subject", "unknown")
        topic = doc.metadata.get("topic", "unknown")
        title = doc.metadata.get("title", "unknown")
        keywords = doc.metadata.get("keywords", "unknown")
        reference = doc.metadata.get("reference", "unknown")
        snippet = doc.page_content[:200]

        out.append(
            f"[subject: {subject} | topic: {topic} | title: {title} | reference: {reference} | keywords: {keywords}]\n{snippet}"
        )

    return "\n\n".join(out)


# ---------------------- RAG chain --------------------------
def build_rag_chain(
    api_key: str | None = None,
    model: str | None = None,
    top_k: int | None = None,
    expr: str | None = None,
    mode: str = "question_generation",
    custom_template: str | None = None,
):
    llm = build_llm(api_key=api_key, model=model)
    retriever = build_retriever(top_k=top_k, expr=expr)
    prompt = build_prompt(mode=mode, custom_template=custom_template)

    chain = (
        {"context": retriever | format_docs, "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )
    return chain


# ---------------------- Config Updater --------------------------
def update_config(new_config: dict):
    """
    Overwrites config.yaml with new_config and reloads global variables.
    """
    global config, milvus_conf, retriever_conf, prompt_conf, google_conf, VECTORSTORE
    
    # 1. Write to file
    with open("config.yaml", "w", encoding="utf-8") as f:
        yaml.dump(new_config, f, allow_unicode=True, sort_keys=False)
        
    # 2. Update globals
    config = new_config
    milvus_conf = config["milvus"]
    retriever_conf = config["retriever"]
    prompt_conf = config["prompt"]
    google_conf = config["google"]
    
    # 3. Re-init Vectorstore (to reflect potential connection changes or just ensuring consistency)
    # Note: Frequent re-init might be heavy, but acceptable for admin config updates.
    try:
        VECTORSTORE = _build_vectorstore()
    except Exception as e:
        print(f"Warning: Failed to reload Vectorstore after config update: {e}")


# ---------------------- Simple Runner --------------------------
def run_rag(
    query: str,
    api_key: str | None = None,
    model: str | None = None,
    top_k: int | None = None,
    expr: str | None = None,
    mode: str = "question_generation",
    custom_template: Optional[str] = None,
):
    chain = build_rag_chain(
        api_key=api_key,
        model=model,
        top_k=top_k,
        expr=expr,
        mode=mode,
        custom_template=custom_template,
    )

    return chain.invoke(query)
