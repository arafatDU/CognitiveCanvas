from sqlalchemy.orm import Session
from app.models.memolet import Memolet
import numpy as np
import random


def simple_kmeans(data: np.ndarray, k: int, max_iter: int = 50) -> list[int]:
    """Pure NumPy K-Means clustering to eliminate scikit-learn & scipy dependency."""
    n = len(data)
    if n <= k:
        return list(range(n))
    np.random.seed(42)
    indices = np.random.choice(n, size=k, replace=False)
    centroids = data[indices].copy()
    labels = np.zeros(n, dtype=int)
    for _ in range(max_iter):
        distances = np.linalg.norm(data[:, np.newaxis] - centroids, axis=2)
        new_labels = np.argmin(distances, axis=1)
        if np.array_equal(labels, new_labels):
            break
        labels = new_labels
        for j in range(k):
            members = data[labels == j]
            if len(members) > 0:
                centroids[j] = members.mean(axis=0)
    return labels.tolist()


class SandboxService:
    def __init__(self):
        pass
        
    def organize_memolets(self, db: Session, memolets: list[Memolet], n_clusters=3):
        """
        LLM-Driven Auto-Organize:
        Triggers K-Means clustering scattered Memolets based on their embeddings.
        """
        if len(memolets) < n_clusters or len(memolets) == 0:
            return memolets # Not enough data
            
        embeddings = []
        valid_memolets = []
        for m in memolets:
            if m.embedding is not None and len(m.embedding) in (384, 1536):
                embeddings.append(m.embedding)
                valid_memolets.append(m)
                
        if len(valid_memolets) < n_clusters:
            return valid_memolets
            
        embeddings_np = np.array(embeddings, dtype=np.float32)
        labels = simple_kmeans(embeddings_np, k=n_clusters)
        
        # Determine 2D coordinates for centroids
        cluster_centers_2d = [(random.randint(100, 900), random.randint(100, 900)) for _ in range(n_clusters)]
        
        for i, label in enumerate(labels):
            # Move memolets to cluster centers + random spread
            spread = 50
            if valid_memolets[i]:
                valid_memolets[i].pos_x = cluster_centers_2d[label][0] + random.randint(-spread, spread)
                valid_memolets[i].pos_y = cluster_centers_2d[label][1] + random.randint(-spread, spread)
                valid_memolets[i].color = f"cluster-{label}"

        db.commit()
        return valid_memolets
        
    def calculate_prompt_weights(self, memolets: list[Memolet]) -> list[float]:
        """
        Context Weighting: Normalizes weights based on manipulation data (e.g. node size/weight slider).
        """
        raw_weights = [float(m.weight) if m.weight is not None else 1.0 for m in memolets]
        total_weight = sum(raw_weights)
        if total_weight == 0:
            return [1.0/len(memolets)] * len(memolets) if memolets else []
        return [rw/total_weight for rw in raw_weights]

sandbox_service = SandboxService()
