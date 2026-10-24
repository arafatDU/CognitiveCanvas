from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi
import numpy as np

class RetrievalService:
    def __init__(self):
        # We will load embedding models lazily or globally
        self.encoder = SentenceTransformer("all-MiniLM-L6-v2")
        self._query_cache: dict[str, np.ndarray] = {}

    def encode_text(self, text: str) -> list[float]:
        return self.encoder.encode(text).tolist()

    def encode_query(self, query: str) -> np.ndarray:
        q = query.strip().lower()
        if q in self._query_cache:
            return self._query_cache[q]
        emb = np.array(self.encoder.encode(query), dtype=np.float32)
        if len(self._query_cache) >= 1000:
            self._query_cache.clear()
        self._query_cache[q] = emb
        return emb

    def hybrid_search(self, query: str, document_texts: list[str], document_embeddings: np.ndarray, alpha: float = 0.5):
        """
        Combines BM25 with Vector Search
        """
        if not document_texts:
            return []
            
        tokenized_corpus = [doc.split(" ") for doc in document_texts]
        bm25 = BM25Okapi(tokenized_corpus)
        tokenized_query = query.split(" ")
        bm25_scores = bm25.get_scores(tokenized_query)

        query_emb = self.encode_query(query)
        # Cosine similarity for vectors if document_embeddings present
        # Assuming normalized embeddings -> dot product
        if document_embeddings is not None and len(document_embeddings) > 0:
            doc_embs = np.array(document_embeddings, dtype=np.float32)
            vector_scores = np.dot(doc_embs, query_emb)
            
            # Min-Max Normalization
            if np.max(bm25_scores) > 0:
                bm25_scores = (bm25_scores - np.min(bm25_scores)) / (np.max(bm25_scores) - np.min(bm25_scores) + 1e-9)
            if np.max(vector_scores) > 0:
                vector_scores = (vector_scores - np.min(vector_scores)) / (np.max(vector_scores) - np.min(vector_scores) + 1e-9)
                
            hybrid_scores = (alpha * vector_scores) + ((1 - alpha) * bm25_scores)
            return hybrid_scores.tolist()
            
        return bm25_scores.tolist()

retrieval_service = RetrievalService()
