import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "Memolet Backend"
    DATABASE_URL: str
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_USERNAME: Optional[str] = None
    REDIS_PASSWORD: Optional[str] = None
    NEO4J_URI: str
    NEO4J_USERNAME: str
    NEO4J_PASSWORD: str
    GEMINI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    NVIDIA_API_KEY: Optional[str] = None
    DEEPSEEK_API_KEY: Optional[str] = None
    MOONSHOT_API_KEY: Optional[str] = None
    MINIMAX_API_KEY: Optional[str] = None
    OPENROUTER_API_KEY: Optional[str] = None
    TOGETHER_API_KEY: Optional[str] = None
    MISTRAL_API_KEY: Optional[str] = None
    COHERE_API_KEY: Optional[str] = None
    CEREBRAS_API_KEY: Optional[str] = None
    SAMBANOVA_API_KEY: Optional[str] = None
    OLLAMA_API_BASE: Optional[str] = None
    OLLAMA_BASE_URL: Optional[str] = "http://localhost:11434"
    AI_GATEWAY_API_KEY: Optional[str] = None
    DEFAULT_MODEL: Optional[str] = None
    CLERK_SECRET_KEY: Optional[str] = None
    CLERK_PUBLISHABLE_KEY: Optional[str] = None
    CLERK_FRONTEND_API_URL: Optional[str] = "https://fine-ladybug-8955.clerk.accounts.dev"
    CLERK_BACKEND_API_URL: Optional[str] = "https://api.clerk.com"
    CLERK_JWKS_URL: Optional[str] = "https://fine-ladybug-8955.clerk.accounts.dev/.well-known/jwks.json"
    CORS_ORIGINS: str = "http://localhost,http://localhost:3000,http://127.0.0.1:3000"
    REDIS_URL: Optional[str] = None
    JWT_SECRET: str = "super_secret_jwt_key_here"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 1 week
    
    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
