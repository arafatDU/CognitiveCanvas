def test_generate_chat(client, mocker):
    # Mock LLM router to avoid true API calls
    mock_llm = mocker.patch("app.services.llm_router.llm_router.generate_response")
    mock_llm.return_value = {
        "choices": [
            {
                "message": {
                    "content": "This is a mocked semantic response returned securely from unit tests."
                }
            }
        ]
    }
    
    # Mock database logic since we mocked the get_db returning an empty list.
    request_data = {
        "message": "What is Memolet?",
        "active_memolet_ids": ["550e8400-e29b-41d4-a716-446655440000"]
    }
    
    response = client.post("/api/v1/chat/", json=request_data)
    
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["reply"] == "This is a mocked semantic response returned securely from unit tests."
    assert res_data["conflict_warning"] is False
    assert "confidence_heatmap" in res_data
    assert "citations" in res_data
    assert len(res_data["sentences"]) > 0

def test_fetch_sandbox_state(client):
    response = client.get("/api/v1/sandbox/state")
    assert response.status_code == 200
    assert response.json() == [] # Returns empty array from MockSession.all()

def test_save_chat_to_memory(client, mocker):
    mocker.patch("app.services.temporal_auditor_service.temporal_auditor_service._call_auditor_llm", return_value="""{
        "results": [
            {
                "index": 0,
                "summary": "Next.js 13 Pages router data fetching with getStaticProps.",
                "keywords": ["Next.js", "getStaticProps", "Pages router"],
                "is_time_sensitive": true,
                "temporal_anchor": "Next.js 13 Pages Router",
                "deprecation_risk": "high",
                "validity_horizon_days": 180,
                "is_deprecated": true,
                "deprecation_reason": "Next.js Pages router has been superseded by App Router.",
                "suggested_update": "Use Next.js App Router with Server Components."
            }
        ]
    }""")
    mocker.patch("app.db.neo4j.neo4j_connector.get_session")

    save_payload = {
        "messages": [
            {
                "user": "How do I use getStaticProps in Next.js 13?",
                "ai": "Export getStaticProps from pages/index.js."
            }
        ]
    }
    response = client.post("/api/v1/chat/save-memory", json=save_payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["saved"]) == 1
    assert data["saved"][0]["is_time_sensitive"] is True
    assert data["saved"][0]["is_deprecated"] is True
    assert data["saved"][0]["temporal_anchor"] == "Next.js 13 Pages Router"

