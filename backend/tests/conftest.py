import pytest
from fastapi.testclient import TestClient
from typing import Generator
import uuid
from datetime import datetime

from app.main import app
from app.api import deps
from app.db.session import get_db
from app.db.neo4j import get_neo4j
from app.models.memolet import User

class MockSession:
    def __init__(self):
        self.queries = []
        self.committed = False

    def query(self, *args, **kwargs):
        self.queries.append(args)
        return self

    def filter(self, *args, **kwargs):
        return self
        
    def join(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def first(self):
        return None

    def all(self):
        return []

    def add(self, instance):
        pass

    def delete(self, instance):
        pass

    def commit(self):
        self.committed = True

    def refresh(self, instance):
        if getattr(instance, 'id', None) is None:
            instance.id = uuid.uuid4()
        if getattr(instance, 'created_at', None) is None:
            instance.created_at = datetime.utcnow()
            
def override_get_db():
    try:
        db = MockSession()
        yield db
    finally:
        pass

def override_get_neo4j():
    try:
        class MockNeo4jSession:
            def run(self, *args, **kwargs):
                pass
        yield MockNeo4jSession()
    finally:
        pass

def override_get_current_user():
    return User(
        id=uuid.uuid4(),
        username="test_user",
        hashed_password="hashed_password_mock",
        created_at=datetime.utcnow()
    )

app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_neo4j] = override_get_neo4j
app.dependency_overrides[deps.get_current_user] = override_get_current_user

@pytest.fixture
def client() -> Generator:
    with TestClient(app) as c:
        yield c