import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from typing import List, Union, Any
from pydantic import field_validator, AnyHttpUrl

load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "Trivia Game API"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./trivia_scores.db")
    WEBSOCKET_PREFIX: str = os.getenv("WEBSOCKET_PREFIX", "/ws")
    
    # CORS
    BACKEND_CORS_ORIGINS_STR: str = os.getenv("CORS_ORIGINS", '["http://localhost:3000","http://127.0.0.1:3000"]')
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] =

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]], info: Any) -> Union[List[AnyHttpUrl], str]:
        # Use BACKEND_CORS_ORIGINS_STR from environment for validation
        # This validator is a bit tricky with how BaseSettings loads env vars.
        # We'll parse the string directly.
        if isinstance(info.data.get("BACKEND_CORS_ORIGINS_STR"), str):
            import json
            try:
                origins_list = json.loads(info.data)
                return [AnyHttpUrl(origin) for origin in origins_list]
            except json.JSONDecodeError:
                raise ValueError("CORS_ORIGINS string is not a valid JSON list of URLs")
        elif isinstance(v, list): # If already a list (e.g. from direct instantiation)
            return [AnyHttpUrl(origin) for origin in v]
        raise ValueError("BACKEND_CORS_ORIGINS must be a list of URLs or a JSON string list of URLs")

    class Config:
        case_sensitive = True
        env_file = ".env"
        env_file_encoding = 'utf-8'

settings = Settings()