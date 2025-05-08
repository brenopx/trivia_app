from sqlmodel import Session, select
from app.models.score import Score
from app.schemas.score import ScoreCreate
from typing import List

def create_score(db: Session, *, score_in: ScoreCreate) -> Score:
    """Cria uma nova pontuação no banco de dados."""
    db_score = Score.model_validate(score_in) # Valida e cria instância do modelo de tabela
    db.add(db_score)
    db.commit()
    db.refresh(db_score)
    return db_score

def get_scores(db: Session, skip: int = 0, limit: int = 10) -> List:
    """Recupera uma lista de pontuações, ordenadas da maior para a menor."""
    statement = select(Score).order_by(Score.score_value.desc(), Score.timestamp.desc()).offset(skip).limit(limit)
    scores = db.exec(statement).all()
    return scores