from typing import List
from langchain_core.documents import Document
from langchain_text_splitters.base import TextSplitter

class RecursiveTextSplitterLite(TextSplitter):
    """
    輕量版 RecursiveCharacterTextSplitter，具有實際 overlap 效果。
    """

    def __init__(
        self,
        chunk_size: int = 512,
        chunk_overlap: int = 64,
        separators: List[str] = None,
    ):
        super().__init__(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        self.separators = separators or ["\n\n", "\n", "。", "，", " "]

    def _split_recursively(self, text: str, seps: List[str]) -> List[str]:
        """模擬遞迴分割：由粗到細"""
        if len(text) <= self._chunk_size or not seps:
            return [text]

        sep = seps[0]
        parts = text.split(sep)
        chunks, current = [], ""

        for p in parts:
            if current and len(current) + len(p) + len(sep) > self._chunk_size:
                # 若當前塊太長則收起
                if len(current) > self._chunk_size:
                    chunks.extend(self._split_recursively(current, seps[1:]))
                else:
                    chunks.append(current.strip())
                current = p
            else:
                current += (sep + p) if current else p

        if current:
            if len(current) > self._chunk_size:
                chunks.extend(self._split_recursively(current, seps[1:]))
            else:
                chunks.append(current.strip())

        return chunks

    def split_text(self, text: str) -> List[str]:
        """實際執行分割 + 加入 overlap"""
        chunks = self._split_recursively(text, self.separators)

        if self._chunk_overlap > 0 and len(chunks) > 1:
            overlapped = []
            for i, c in enumerate(chunks):
                if i == 0:
                    overlapped.append(c)
                else:
                    prev = chunks[i - 1]
                    overlap_text = prev[-self._chunk_overlap:]
                    overlapped.append(overlap_text + c)
            return overlapped
        return chunks

    def split_documents(self, documents: List[Document]) -> List[Document]:
        """與 LangChain 的介面一致"""
        docs_out = []
        for doc in documents:
            for i, chunk in enumerate(self.split_text(doc.page_content)):
                new_doc = Document(
                    page_content=chunk,
                    metadata=doc.metadata,
                )
                docs_out.append(new_doc)
        return docs_out