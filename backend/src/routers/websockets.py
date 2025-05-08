from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from app.services.connection_manager import manager as conn_manager
from app.services.game_manager import game_manager
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# Este endpoint é um ponto de entrada genérico.
# A primeira mensagem do cliente determinará se é CREATE_ROOM ou JOIN_ROOM.
# Ou, podemos ter endpoints separados para clareza, mas para simplificar o cliente,
# usaremos um endpoint que espera uma mensagem inicial de "ação".
# No entanto, a URL já contém o nome de usuário, o que é um bom começo.
# A sala será determinada por uma mensagem subsequente.

@router.websocket("/ws/{user_name}")
async def websocket_endpoint_entry(websocket: WebSocket, user_name: str):
    """
    Ponto de entrada principal para conexões WebSocket.
    O cliente deve enviar uma mensagem inicial especificando a ação:
    - {"type": "create_room"}
    - {"type": "join_room", "payload": {"room_id": "XYZ123"}}
    """
    # Aceita a conexão preliminarmente. A associação à sala e ao ConnectionManager
    # ocorrerá após o cliente enviar a mensagem de 'create_room' ou 'join_room'.
    await websocket.accept()
    logger.info(f"WS conexão preliminar aceita para usuário '{user_name}' ({websocket.client}). Aguardando ação.")
    
    current_room_id: str | None = None

    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")
            payload = data.get("payload", {})
            
            logger.info(f"WS msg de '{user_name}': tipo='{message_type}', payload='{payload}'")

            if not current_room_id: # Se ainda não associado a uma sala
                if message_type == "create_room":
                    room_id_created = await game_manager.handle_create_room(user_name, websocket)
                    if room_id_created:
                        current_room_id = room_id_created
                        # Mensagem de sucesso já é enviada por handle_create_room (via handle_player_join)
                    else:
                        # Erro ao criar sala, fechar conexão ou enviar erro específico
                        await conn_manager.send_personal_message({"type": "create_room_error", "message": "Falha ao criar sala."}, websocket)
                        break # Encerra o loop e a conexão
                
                elif message_type == "join_room":
                    room_id_to_join = payload.get("room_id")
                    if not room_id_to_join:
                        await conn_manager.send_personal_message({"type": "join_room_error", "message": "ID da sala não fornecido."}, websocket)
                        continue # Espera próxima mensagem

                    # Conecta ao ConnectionManager ANTES de chamar handle_player_join
                    # para que o websocket já esteja no pool do conn_manager para broadcasts.
                    await conn_manager.connect(websocket, room_id_to_join, user_name)
                    await game_manager.handle_player_join(room_id_to_join, user_name, websocket)
                    # Se o join for bem-sucedido, o handle_player_join envia 'join_room_success'
                    # Se falhar, handle_player_join envia 'join_room_error'
                    # Precisamos saber se o join foi bem-sucedido para definir current_room_id
                    # Uma forma é o handle_player_join retornar um status ou o cliente confirmar.
                    # Por ora, assumimos que se não houver erro, o join foi ok.
                    # Se o join falhar e o cliente não receber 'join_room_success', ele deve tratar.
                    # Se o join falhar, o conn_manager.disconnect deve ser chamado.
                    # Vamos simplificar: se handle_player_join não levantar exceção e enviar sucesso,
                    # então current_room_id é definido.
                    # Se o join falhar (sala não existe, jogo em progresso), o handle_player_join envia erro.
                    # O cliente deve tratar isso. Se o cliente desconectar após erro, ok.
                    # Se o cliente continuar enviando msgs sem current_room_id, este loop trata.
                    
                    # Verificando se a sala existe no game_manager para definir current_room_id
                    if room_id_to_join in game_manager.rooms_data and user_name in game_manager.rooms_data[room_id_to_join].players:
                         current_room_id = room_id_to_join
                    else:
                        # O join falhou (provavelmente handle_player_join enviou erro e desconectou o websocket do conn_manager)
                        # Se o websocket ainda estiver ativo aqui, é um estado inconsistente.
                        logger.warning(f"Tentativa de join de '{user_name}' à sala '{room_id_to_join}' falhou ou estado inconsistente.")
                        await conn_manager.disconnect(websocket, room_id_to_join) # Garante desconexão
                        break


                else:
                    await conn_manager.send_personal_message({"type": "error", "message": "Ação inicial inválida. Envie 'create_room' ou 'join_room'."}, websocket)
                    # Poderia desconectar aqui se a primeira mensagem não for válida.
            
            else: # Já associado a uma sala (current_room_id está definido)
                # Passa a mensagem para o GameManager processar
                await game_manager.process_client_message(current_room_id, user_name, data, websocket)

    except WebSocketDisconnect:
        logger.info(f"WS Desconexão: '{user_name}' ({websocket.client})" + (f" da sala '{current_room_id}'" if current_room_id else ""))
        if current_room_id:
            conn_manager.disconnect(websocket, current_room_id) # Remove do ConnectionManager
            await game_manager.process_disconnect(current_room_id, user_name, websocket) # Notifica GameManager
    except Exception as e:
        logger.error(f"Erro inesperado no WebSocket para '{user_name}' ({websocket.client})" + (f" na sala '{current_room_id}'" if current_room_id else "") + f": {e}", exc_info=True)
        if current_room_id:
            conn_manager.disconnect(websocket, current_room_id)
            await game_manager.process_disconnect(current_room_id, user_name, websocket) # Trata como desconexão
        try:
            await websocket.close(code=1011) # Internal Error
        except Exception:
            pass # Conexão pode já estar fechada
    finally:
        # Garante que se current_room_id foi definido mas a desconexão não foi tratada acima,
        # tentamos uma última vez.
        if current_room_id and websocket in conn_manager.websocket_users:
            logger.warning(f"Limpando conexão de '{user_name}' da sala '{current_room_id}' no bloco finally.")
            conn_manager.disconnect(websocket, current_room_id)
            # Não chamar game_manager.process_disconnect aqui para evitar chamadas duplas se já tratado.