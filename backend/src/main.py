from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.database.setup import create_db_and_tables, engine
from app.routers import websockets as ws_router, ranking as ranking_router
from app.core.config import settings
from app.services.game_manager import game_manager # Para carregar perguntas no startup

# Configuração básica de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Aplicação iniciando...")
    create_db_and_tables()
    logger.info("Banco de dados e tabelas verificados/criados.")
    # Carregar perguntas no GameManager
    if not game_manager.questions_pool: # Evita recarregar se já tiver
        game_manager.questions_pool = game_manager._load_questions()
        if game_manager.questions_pool:
            logger.info(f"{len(game_manager.questions_pool)} perguntas carregadas para o GameManager.")
        else:
            logger.warning("Nenhuma pergunta carregada para o GameManager na inicialização.")
    yield
    logger.info("Aplicação encerrando...")
    if hasattr(engine, 'dispose'): # Para SQLAlchemy engine
        engine.dispose()

app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan
)

# Configuração do CORS
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=, # Garante que são strings
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # Permitir tudo se não especificado (para desenvolvimento local fácil)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# Incluir roteadores
app.include_router(ws_router.router, prefix=settings.WEBSOCKET_PREFIX) # Adiciona prefixo global para WebSockets
app.include_router(ranking_router.router, prefix="/api/v1") # Adiciona prefixo para API REST

@app.get("/api/v1/health")
async def root():
    return {"status": "healthy", "message": "Bem-vindo à API do Jogo Trivia!"}

logger.info("Configuração da aplicação FastAPI concluída.")