from sqlmodel import SQLModel, Field
from datetime import datetime

class Score(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    player_name: str = Field(index=True, max_length=50)
    score_value: int = Field(index=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)