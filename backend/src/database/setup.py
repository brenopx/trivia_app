from sqlmodel import create_engine, SQLModel, Session
from app.core.config import settings
from typing import Annotated
from fastapi import Depends

connect_args = {"check_same_thread": False} # Específico para SQLite
engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, echo=True)

def create_db_and_tables():
    """Cria todas as tabelas no banco de dados se não existirem."""
    SQLModel.metadata.create_all(engine)

def get_session():
    """Gera uma sessão de banco de dados por requisição."""
    with Session(engine) as session:
        yield session

SessionDep = Annotated