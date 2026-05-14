import yaml
from dotenv import load_dotenv
import langchain
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_milvus import Milvus, BM25BuiltInFunction
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from remote_embeddings import RemoteEmbeddings

load_dotenv()  # 讀取 .env

# 讀取 YAML 設定檔
with open("config.yaml", "r", encoding="utf-8") as f:
    config = yaml.safe_load(f)

milvus_conf = config["milvus"]
mode = milvus_conf.get("mode", "bm25")

# 建立 embeddings（語意或混合都需要）
embeddings = RemoteEmbeddings()

# 根據模式建立 vectorstore
if mode == "semantic":
    print("使用語意檢索模式 (Semantic Retrieval)")
    vectorstore_loaded = Milvus(
        embedding_function=embeddings,
        text_field=milvus_conf["semantic"]["text_field"],
        vector_field=milvus_conf["semantic"]["vector_field"],
        connection_args=milvus_conf["connection_args"],
        collection_name=milvus_conf["collection_name"],
    )
elif mode == "bm25":
    print("使用全文檢索模式 (BM25 Retrieval)")
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
    print("使用混合檢索模式 (Hybrid Retrieval)")
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

# ====== 初始化 Gemini 模型 ======
google_conf = config["google"]
llm = ChatGoogleGenerativeAI(
    model=google_conf["model"],
    temperature=google_conf["temperature"],
    max_tokens=google_conf["max_tokens"],
    timeout=google_conf["timeout"],
    thinking_budget=google_conf["thinking_budget"],
    include_thoughts=google_conf["include_thoughts"],
    response_mime_type=google_conf["response_mime_type"],
    response_schema=google_conf["json_schema"],
)

# ====== 建立 Prompt 模板 ======
prompt_conf = config["prompt"]
prompt = PromptTemplate(
    template=prompt_conf["question_generation"],
    input_variables=["context", "question"],
)

# ====== 轉成 retriever ======
retriever_conf = config["retriever"]
retriever = vectorstore_loaded.as_retriever(search_kwargs=retriever_conf["search_kwargs"])

# ====== 定義格式化文件函數 ======
def format_docs(docs):
    return "\n---\n".join(
        f'["subject": {doc.metadata["subject"]}, "keywords": {doc.metadata["keywords"]}, '
        f'"title": {doc.metadata["title"]}, "topic": {doc.metadata["topic"]}] {doc.page_content}'
        for doc in docs
    )

# ====== 建立 RAG Chain ======
def inspect_input(x):
    print("\n--- Input ---\n", x)
    return x

def inspect_output(x):
    print("\n--- Output ---\n", x)
    return x

rag_chain = (
    {"context": retriever | format_docs, "question": RunnablePassthrough()}
    | prompt
    | RunnableLambda(inspect_input)
    | llm
    | RunnableLambda(inspect_output)
    | StrOutputParser()
)

langchain.debug = False

# ====== 測試查詢 ======
if __name__ == "__main__":
    query = "海峽兩岸的敵對與隔絕"
    retriever.search_kwargs["expr"] = "source_type == 'teachers_book'"
    res = rag_chain.invoke(query)
    print(type(res), '=========================')
    print("\n--- RAG 的輸出 ---\n", res)
