from datetime import datetime, timezone
from app.services.temporal_auditor_service import temporal_auditor_service

def test_dynamic_time_grounding():
    time_info = temporal_auditor_service.get_current_time_grounding()
    now = datetime.now(timezone.utc)
    assert time_info["current_year"] == now.year
    assert now.strftime("%B %Y") == time_info["current_date_str"]

def test_heuristic_regex_scan_invariant():
    text = "QuickSort is a divide and conquer algorithm with average time complexity of O(N log N)."
    scan = temporal_auditor_service.scan_temporal_heuristics(text)
    assert scan["is_time_sensitive"] is False
    assert scan["risk"] == "none"

def test_heuristic_regex_scan_versioned_library():
    text = "In Next.js 13, you can use getStaticProps or Pages router to fetch data at build time."
    scan = temporal_auditor_service.scan_temporal_heuristics(text)
    assert scan["is_time_sensitive"] is True
    assert "next.js" in scan["matched_tech"] or "version_phrase" in scan["matched_patterns"]

def test_heuristic_regex_scan_explicit_deprecated():
    text = "This method is deprecated and superseded by modern server actions. Do not use legacy callbacks."
    scan = temporal_auditor_service.scan_temporal_heuristics(text)
    assert scan["is_time_sensitive"] is True
    assert scan["risk"] == "high"

def test_heuristic_regex_scan_temporal_adverbs():
    text = "Currently as of this month, the API pricing quota is limited to 100 requests per minute."
    scan = temporal_auditor_service.scan_temporal_heuristics(text)
    assert scan["is_time_sensitive"] is True
    assert "temporal_adverb" in scan["matched_patterns"]

def test_auditor_time_grounding_endpoint(client):
    response = client.get("/api/v1/auditor/time-grounding")
    assert response.status_code == 200
    data = response.json()
    assert "current_year" in data
    assert "current_date_str" in data
    assert data["current_year"] == datetime.now(timezone.utc).year
