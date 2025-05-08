import shortuuid
import json
import random
from typing import Dict, List, Optional, Any
from fastapi import WebSocket
from app.services.connection_manager import manager as conn_manager # Renomeado para evitar conflito
from app.schemas.game import GameRoomStateSchema, PlayerSchema, QuestionSchema
from app.schemas.score import ScoreCreate
from app.crud.crud_score import create_score
from app.database.setup import get_session
import logging

logger = logging.getLogger(__name__)

NUMBER_OF_QUESTIONS = 10

class GameManager:
    def __init__(self):
        self.rooms_data: Dict = {}
        self.questions_pool: List[Dict[str, Any]] = self._load_questions()

    def _load_questions(self) -> List[Dict[str, Any]]:
        """Carrega as perguntas do arquivo JSON."""
        try:
            with open("questions.json", "r", encoding="utf-8") as f:
                questions = json.load(f)
            logger.info(f"{len(questions)} perguntas carregadas do arquivo.")
            return questions
        except FileNotFoundError:
            logger.error("ERRO: Arquivo questions.json não encontrado.")
            return
        except json.JSONDecodeError:
            logger.error("ERRO: Formato inválido no arquivo questions.json.")
            return

    def _get_questions_for_room(self) -> List[Dict[str, Any]]:
        if not self.questions_pool:
            return
        # Seleciona aleatoriamente NUMBER_OF_QUESTIONS perguntas
        return random.sample(self.questions_pool, min(NUMBER_OF_QUESTIONS, len(self.questions_pool)))

    async def handle_create_room(self, creator_name: str, websocket: WebSocket) -> Optional[str]:
        """Cria uma nova sala de jogo, retorna o ID da sala."""
        room_id = shortuuid.uuid()[:6].upper()
        while room_id in self.rooms_data:
            room_id = shortuuid.uuid()[:6].upper()

        selected_raw_questions = self._get_questions_for_room()
        if not selected_raw_questions:
            await conn_manager.send_personal_message({"type": "error", "message": "Falha ao carregar perguntas para a sala."}, websocket)
            return None

        questions_for_schema =,
                options=q["options"],
                points=q.get("points", 10) # Default 10 pontos se não especificado
            ) for i, q in enumerate(selected_raw_questions)
        ]

        room_state = GameRoomStateSchema(
            room_id=room_id,
            creator_name=creator_name,
            host_name=creator_name,
            players={},
            questions=questions_for_schema,
            current_question_index=-1,
            game_status="waiting",
            player_order=
        )
        # Armazena as respostas corretas internamente (não no schema enviado ao cliente)
        room_state.original_questions_with_answers = selected_raw_questions
        
        self.rooms_data[room_id] = room_state
        logger.info(f"Sala {room_id} criada por {creator_name}.")
        
        # Conecta o criador à sala e ao ConnectionManager
        await conn_manager.connect(websocket, room_id, creator_name)
        await self.handle_player_join(room_id, creator_name, websocket) # Trata o join do criador
        
        return room_id

    async def handle_player_join(self, room_id: str, user_name: str, websocket: WebSocket):
        room_state = self.rooms_data.get(room_id)
        if not room_state:
            await conn_manager.send_personal_message({"type": "join_room_error", "message": "Sala não encontrada."}, websocket)
            return

        if room_state.game_status!= "waiting":
            await conn_manager.send_personal_message({"type": "join_room_error", "message": "Jogo já em progresso ou finalizado."}, websocket)
            return

        if user_name in room_state.players:
            # Lógica para reconexão ou nome duplicado
            await conn_manager.send_personal_message({"type": "join_room_error", "message": f"Jogador '{user_name}' já está na sala ou nome duplicado."}, websocket)
            return

        # Adiciona jogador ao estado da sala
        room_state.players[user_name] = PlayerSchema(name=user_name, answers=[None] * len(room_state.questions))
        if user_name not in room_state.player_order: # Evita duplicatas se houver lógica de reconexão
            room_state.player_order.append(user_name)
        
        logger.info(f"Jogador {user_name} adicionado ao estado da sala {room_id}.")

        # Enviar estado atual da sala para o jogador que acabou de entrar
        await conn_manager.send_personal_message({
            "type": "join_room_success",
            "room_id": room_id,
            "is_host": (user_name == room_state.host_name),
            "room_state": room_state.model_dump(exclude={'original_questions_with_answers'}) # Envia o estado atual
        }, websocket)
        
        # Notificar outros jogadores na sala
        await self._broadcast_room_update(room_id)


    async def process_client_message(self, room_id: str, user_name: str, data: dict, websocket: WebSocket):
        message_type = data.get("type")
        payload = data.get("payload", {})
        room_state = self.rooms_data.get(room_id)

        if not room_state:
            await conn_manager.send_personal_message({"type": "error", "message": "Sala não encontrada."}, websocket)
            return

        if message_type == "start_game":
            if user_name == room_state.host_name and room_state.game_status == "waiting":
                room_state.game_status = "active"
                room_state.current_question_index = 0
                
                if not room_state.questions: # Caso as perguntas não tenham sido carregadas
                    logger.error(f"Tentativa de iniciar jogo na sala {room_id} sem perguntas carregadas.")
                    await conn_manager.broadcast_to_room(room_id, {"type": "error", "message": "Erro interno: Não foi possível carregar as perguntas."})
                    room_state.game_status = "waiting" # Reverte o status
                    return

                current_question_data = room_state.questions[room_state.current_question_index]
                
                await conn_manager.broadcast_to_room(room_id, {
                    "type": "game_started",
                    "question": current_question_data.model_dump(),
                    "question_number": 1,
                    "total_questions": len(room_state.questions)
                })
                logger.info(f"Jogo iniciado na sala {room_id} por {user_name}.")
            elif user_name!= room_state.host_name:
                await conn_manager.send_personal_message({"type": "error", "message": "Apenas o host pode iniciar o jogo."}, websocket)
            elif room_state.game_status!= "waiting":
                await conn_manager.send_personal_message({"type": "error", "message": f"O jogo não pode ser iniciado (status: {room_state.game_status})."}, websocket)

        elif message_type == "submit_answer":
            if room_state.game_status == "active" and room_state.current_question_index < len(room_state.questions):
                player = room_state.players.get(user_name)
                if player and not player.finished_game:
                    answer_text = payload.get("answer")
                    question_idx_answered = payload.get("question_id") # ID da pergunta (índice no array de perguntas do jogo)

                    # Validar se a resposta é para a pergunta atual
                    if question_idx_answered!= room_state.current_question_index:
                        await conn_manager.send_personal_message({"type": "error", "message": "Resposta para pergunta incorreta ou fora de ordem."}, websocket)
                        return

                    player.answers[question_idx_answered] = answer_text
                    
                    correct_answer = room_state.original_questions_with_answers[question_idx_answered]["correct_answer"]
                    points_for_question = room_state.original_questions_with_answers[question_idx_answered]["points"]
                    is_correct = (str(answer_text).strip().lower() == str(correct_answer).strip().lower())

                    if is_correct:
                        player.score += points_for_question

                    await conn_manager.send_personal_message({
                        "type": "answer_result",
                        "question_id": room_state.questions[question_idx_answered].id,
                        "is_correct": is_correct,
                        "your_score": player.score
                    }, websocket)
                    
                    logger.info(f"Jogador {user_name} (sala {room_id}) respondeu Q{question_idx_answered+1}: '{answer_text}' (Correta: {is_correct}). Pontuação: {player.score}")

                    # Atualizar scores para todos (opcional, pode ser feito menos frequentemente)
                    await self._broadcast_score_update(room_id)

                    # Verificar se este jogador terminou todas as perguntas
                    if all(ans is not None for ans in player.answers):
                        player.finished_game = True
                        logger.info(f"Jogador {user_name} terminou todas as perguntas na sala {room_id}.")
                        # A regra é: "quando um jogador terminar, o jogo fechar para todos"
                        # Aqui, consideramos o "host" como o jogador que dita o fim.
                        # Se o host terminar, o jogo acaba.
                        if user_name == room_state.host_name:
                            logger.info(f"Host {user_name} terminou. Finalizando jogo para sala {room_id}.")
                            await self._finalize_game_for_all(room_id)
                            return # Jogo finalizado

                    # Verificar se todos os jogadores ativos responderam à pergunta atual
                    # para então avançar para a próxima.
                    all_active_players_answered_current_q = True
                    for p_name_loop, p_obj_loop in room_state.players.items():
                        # Considera apenas jogadores que ainda estão conectados (presentes no conn_manager)
                        # e que não terminaram o jogo ainda.
                        if p_name_loop in conn_manager.get_users_in_room(room_id) and \
                           not p_obj_loop.finished_game and \
                           p_obj_loop.answers[room_state.current_question_index] is None:
                            all_active_players_answered_current_q = False
                            break
                    
                    if all_active_players_answered_current_q:
                        await self._check_next_question_or_end_game(room_id)

            elif room_state.game_status!= "active":
                 await conn_manager.send_personal_message({"type": "error", "message": "Não é possível submeter resposta: jogo não está ativo."}, websocket)


    async def _check_next_question_or_end_game(self, room_id: str):
        room_state = self.rooms_data.get(room_id)
        if not room_state or room_state.game_status!= "active":
            return

        # Se o host já marcou o jogo como finalizado (ex: por ele ter terminado)
        host_player = room_state.players.get(room_state.host_name)
        if host_player and host_player.finished_game:
            # O jogo já deveria ter sido finalizado por _finalize_game_for_all
            # Esta é uma checagem de segurança.
            if room_state.game_status!= "finished":
                 logger.warning(f"Host {room_state.host_name} terminou, mas jogo {room_id} não está 'finished'. Finalizando agora.")
                 await self._finalize_game_for_all(room_id)
            return

        # Avançar para a próxima pergunta
        if room_state.current_question_index < len(room_state.questions) - 1:
            room_state.current_question_index += 1
            next_question_data = room_state.questions[room_state.current_question_index]
            await conn_manager.broadcast_to_room(room_id, {
                "type": "new_question",
                "question": next_question_data.model_dump(),
                "question_number": room_state.current_question_index + 1,
                "total_questions": len(room_state.questions)
            })
            logger.info(f"Próxima pergunta ({room_state.current_question_index + 1}) enviada para sala {room_id}.")
        else:
            # Todas as perguntas foram enviadas. Finalizar o jogo.
            logger.info(f"Todas as {len(room_state.questions)} perguntas foram enviadas para sala {room_id}. Finalizando jogo.")
            await self._finalize_game_for_all(room_id)

    async def _finalize_game_for_all(self, room_id: str):
        room_state = self.rooms_data.get(room_id)
        if not room_state or room_state.game_status == "finished": # Evita finalização dupla
            return

        room_state.game_status = "finished"
        logger.info(f"Jogo finalizado para todos na sala {room_id}.")

        final_scores_dict = {name: p.score for name, p in room_state.players.items()}
        
        # Salvar pontuações no banco de dados
        # É importante obter uma nova sessão aqui para operações de DB
        db_session_gen = get_session()
        db = next(db_session_gen)
        try:
            for player_name, player_score in final_scores_dict.items():
                score_to_create = ScoreCreate(player_name=player_name, score_value=player_score)
                create_score(db=db, score_in=score_to_create)
            logger.info(f"Pontuações finais da sala {room_id} persistidas no banco de dados.")
        except Exception as e:
            logger.error(f"Erro ao salvar pontuações para sala {room_id}: {e}")
        finally:
            db.close()

        await conn_manager.broadcast_to_room(room_id, {
            "type": "game_over_for_all",
            "final_scores": final_scores_dict
        })
        
        # Opcional: Limpar dados da sala da memória após o jogo
        # if room_id in self.rooms_data:
        #     del self.rooms_data[room_id]
        #     logger.info(f"Dados da sala {room_id} limpos da memória após o jogo.")


    async def process_disconnect(self, room_id: str, user_name: str, websocket: WebSocket):
        logger.info(f"Jogador {user_name} desconectado da sala {room_id}.")
        room_state = self.rooms_data.get(room_id)
        if not room_state:
            return

        # Lógica para lidar com a saída do jogador
        # Se o jogador que saiu era o host:
        if user_name == room_state.host_name:
            logger.info(f"Host {user_name} desconectou da sala {room_id}.")
            # Eleger novo host se houver outros jogadores e o jogo não terminou
            if room_state.game_status!= "finished" and room_state.player_order:
                new_host = None
                # Tenta encontrar o próximo na ordem de entrada que ainda está conectado
                for potential_host_name in room_state.player_order:
                    if potential_host_name!= user_name and \
                       potential_host_name in conn_manager.get_users_in_room(room_id): # Verifica se ainda está conectado
                        new_host = potential_host_name
                        break
                
                if new_host:
                    room_state.host_name = new_host
                    logger.info(f"Novo host para sala {room_id}: {new_host}.")
                else:
                    # Nenhum outro jogador para ser host, a sala pode ser considerada "abandonada"
                    # Se o jogo estava ativo, finalizar.
                    if room_state.game_status == "active":
                        logger.info(f"Host saiu e não há outros jogadores na sala {room_id}. Finalizando jogo.")
                        await self._finalize_game_for_all(room_id)
                    # Se estava esperando, e não há mais ninguém, a sala será limpa pelo ConnectionManager
                    # e os dados do GameManager podem ser limpos aqui ou por um job.
                    elif not conn_manager.get_users_in_room(room_id) and room_id in self.rooms_data:
                        logger.info(f"Host saiu, sala {room_id} vazia e esperando. Removendo dados do jogo.")
                        del self.rooms_data[room_id]
                        return # Sai cedo pois a sala não existe mais para broadcast

        # Remove o jogador da lista de jogadores ativos para fins de lógica de jogo
        # (mas mantém seus dados de pontuação se o jogo já começou)
        # A remoção do conn_manager.rooms já acontece em conn_manager.disconnect

        # Notifica os demais jogadores sobre a saída e possível mudança de host
        await self._broadcast_room_update(room_id, exclude_websocket=websocket)

        # Se o jogo estava ativo e a saída do jogador implica que todos os restantes responderam
        if room_state.game_status == "active":
            all_remaining_active_players_answered_current_q = True
            active_player_exists = False
            current_q_idx = room_state.current_question_index
            if current_q_idx >= 0:
                for p_name_loop, p_obj_loop in room_state.players.items():
                    if p_name_loop in conn_manager.get_users_in_room(room_id): # Se ainda está conectado
                        active_player_exists = True
                        if not p_obj_loop.finished_game and p_obj_loop.answers[current_q_idx] is None:
                            all_remaining_active_players_answered_current_q = False
                            break
                
                if active_player_exists and all_remaining_active_players_answered_current_q:
                    await self._check_next_question_or_end_game(room_id)
                elif not active_player_exists and room_state.game_status == "active":
                     logger.info(f"Último jogador ativo ({user_name}) desconectou da sala {room_id} durante o jogo. Finalizando.")
                     await self._finalize_game_for_all(room_id)


    async def _broadcast_room_update(self, room_id: str, exclude_websocket: Optional = None):
        """Envia uma atualização completa do estado da sala para todos os jogadores nela."""
        room_state = self.rooms_data.get(room_id)
        if not room_state:
            return

        # Garante que a lista de jogadores no room_state reflita quem está conectado
        connected_player_names = conn_manager.get_users_in_room(room_id)
        current_players_in_state = list(room_state.players.keys())
        
        # Remove jogadores do estado se não estiverem mais conectados
        for p_name_in_state in current_players_in_state:
            if p_name_in_state not in connected_player_names:
                logger.debug(f"Removendo jogador {p_name_in_state} do estado da sala {room_id} pois não está mais conectado.")
                room_state.players.pop(p_name_in_state, None)
                if p_name_in_state in room_state.player_order:
                    room_state.player_order.remove(p_name_in_state)


        # Prepara o payload para enviar aos clientes (sem respostas corretas)
        payload_to_send = room_state.model_dump(exclude={'original_questions_with_answers'})
        
        await conn_manager.broadcast_to_room(room_id, {
            "type": "room_state_update",
            "room_state": payload_to_send
        }, exclude_websocket=exclude_websocket)
        logger.debug(f"Broadcast de atualização da sala {room_id} enviado.")

    async def _broadcast_score_update(self, room_id: str):
        room_state = self.rooms_data.get(room_id)
        if not room_state:
            return
        
        scores_dict = {name: p.score for name, p in room_state.players.items()}
        await conn_manager.broadcast_to_room(room_id, {
            "type": "score_update",
            "scores": scores_dict
        })


# Instância única do GameManager
game_manager = GameManager()