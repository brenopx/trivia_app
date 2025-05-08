from pydantic import BaseModel
from datetime import datetime

class ScoreBase(BaseModel):
    player_name: str
    score_value: int

class ScoreCreate(ScoreBase):
    pass

class ScoreRead(ScoreBase):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True # Anteriormente orm_mode