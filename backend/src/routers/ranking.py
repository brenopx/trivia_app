from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from typing import List

from app.crud import crud_score
from app.schemas.score import ScoreCreate, ScoreRead
from app.database.setup import SessionDep

router = APIRouter(
    prefix="/ranking",
    tags=["ranking"],
)

# O endpoint POST para criar score não é mais necessário aqui,
# pois as pontuações são salvas pelo GameManager ao final do jogo.
# Se fosse necessário um endpoint manual:
# @router.post("/", response_model=ScoreRead)
# def create_new_score_endpoint(score: ScoreCreate, db: SessionDep):
#     return crud_score.create_score(db=db, score_in=score)

@router.get("/", response_model=List)
def read_scores_ranking(skip: int = 0, limit: int = 10, db: SessionDep):
    """
    Retorna o ranking das maiores pontuações.
    """
    scores = crud_score.get_scores(db=db, skip=skip, limit=limit)
    if not scores:
        return
    return scores