from pydantic import BaseModel
from typing import List, Dict, Optional, Any

class PlayerSchema(BaseModel):
    name: str
    score: int = 0
    answers: List[Optional[str]] =
    finished_game: bool = False

class QuestionSchema(BaseModel):
    id: int
    question_text: str
    options: List[str]
    # correct_answer: str # Não enviar ao cliente no payload da pergunta
    points: int

class GameRoomStateSchema(BaseModel):
    room_id: str
    creator_name: str # Nome do usuário que criou a sala
    host_name: Optional[str] = None # Nome do host atual (pode mudar se o criador sair)
    players: Dict = {} # user_name -> Player object
    questions: List =
    # original_questions_with_answers: List[Dict[str, Any]] = # Apenas no servidor
    current_question_index: int = -1
    game_status: str = "waiting"  # waiting, active, finished
    player_order: List[str] = # Ordem de entrada dos jogadores

    class Config:
        from_attributes = True