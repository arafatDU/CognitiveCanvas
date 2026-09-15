import uuid
from app.models.memolet import Memolet

def test_delete_memory_not_found(client):
    fake_id = str(uuid.uuid4())
    res = client.delete(f"/api/v1/memories/{fake_id}")
    assert res.status_code == 404

def test_delete_memory_invalid_uuid(client):
    res = client.delete("/api/v1/memories/not-a-valid-uuid")
    assert res.status_code == 400

def test_delete_memory_success(client, mocker):
    mock_memolet = Memolet(
        id=uuid.uuid4(),
        text="Summary: Test memolet\nUser: hello\nAI: world",
        keywords=["test", "hello"],
    )

    mocker.patch("tests.conftest.MockSession.first", return_value=mock_memolet)
    mock_neo4j_del = mocker.patch("app.services.graphrag.graphrag_service.delete_memolet_from_graph")

    res = client.delete(f"/api/v1/memories/{mock_memolet.id}")
    assert res.status_code == 200
    assert res.json()["status"] == "success"
    assert res.json()["id"] == str(mock_memolet.id)
    assert mock_neo4j_del.called

def test_search_memories_empty_query(client):
    res = client.get("/api/v1/memories/search?query=")
    assert res.status_code == 200
    assert res.json() == []

def test_search_memories_matching(client, mocker):
    mock_m1 = Memolet(
        id=uuid.uuid4(),
        text="Summary: GraphRAG explanation\nUser: What is GraphRAG?\nAI: GraphRAG is...",
        keywords=["graphrag", "knowledge"],
        embedding=None,
    )
    mock_m2 = Memolet(
        id=uuid.uuid4(),
        text="Summary: Python recipe\nUser: How to bake cake?\nAI: Mix flour...",
        keywords=["cake", "baking"],
        embedding=None,
    )

    mocker.patch("tests.conftest.MockSession.all", return_value=[mock_m1, mock_m2])
    
    # Search for GraphRAG keyword
    res = client.get("/api/v1/memories/search?query=GraphRAG")
    assert res.status_code == 200
    results = res.json()
    assert len(results) == 1
    assert results[0]["id"] == str(mock_m1.id)

    # Search for non-existent keyword returns empty list
    res_none = client.get("/api/v1/memories/search?query=supercalifragilistic")
    assert res_none.status_code == 200
    assert res_none.json() == []
