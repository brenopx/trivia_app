from typing import Dict, Set, List, Optional
from fastapi import WebSocket
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # Armazena conexões ativas por sala: room_id -> Set
        self.rooms: Dict] = {}
        # Armazena o nome de usuário associado a cada WebSocket: WebSocket -> user_name
        self.websocket_users: Dict = {}

    async def connect(self, websocket: WebSocket, room_id: str, user_name: str):
        """Aceita uma nova conexão WebSocket, a adiciona à sala e mapeia o usuário."""
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = set()
        self.rooms[room_id].add(websocket)
        self.websocket_users[websocket] = user_name
        logger.info(f"WebSocket {user_name} ({websocket.client}) conectado à sala {room_id}. Conexões na sala: {len(self.rooms[room_id])}")

    def disconnect(self, websocket: WebSocket, room_id: str) -> Optional[str]:
        """Remove uma conexão WebSocket da sala e do mapeamento de usuários."""
        user_name = self.websocket_users.pop(websocket, None)
        if room_id in self.rooms:
            self.rooms[room_id].discard(websocket) # Use discard para não dar erro se não existir
            logger.info(f"WebSocket {user_name} ({websocket.client}) desconectado da sala {room_id}. Conexões restantes: {len(self.rooms.get(room_id, set()))}")
            if not self.rooms[room_id]: # Se a sala estiver vazia
                del self.rooms[room_id]
                logger.info(f"Sala {room_id} removida por estar vazia.")
        return user_name


    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Envia uma mensagem JSON pessoal para um WebSocket específico."""
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Erro ao enviar mensagem pessoal para {self.websocket_users.get(websocket)}: {e}")


    async def broadcast_to_room(self, room_id: str, message: dict, exclude_websocket: Optional = None):
        """Transmite uma mensagem JSON para todos os WebSockets em uma sala, opcionalmente excluindo um."""
        if room_id in self.rooms:
            # Criar uma cópia do set para iteração segura se houver modificações durante o broadcast (desconexões)
            connections_in_room = list(self.rooms[room_id])
            for connection in connections_in_room:
                if connection!= exclude_websocket:
                    try:
                        await connection.send_json(message)
                    except Exception as e:
                        # Se houver erro ao enviar (ex: conexão fechada), desconectar silenciosamente
                        logger.warning(f"Erro ao transmitir para {self.websocket_users.get(connection)} na sala {room_id}: {e}. Removendo.")
                        # A desconexão já deve ser tratada pelo loop principal do endpoint WebSocket
                        # self.disconnect(connection, room_id) # Evitar modificar durante iteração aqui

    def get_user_by_websocket(self, websocket: WebSocket) -> Optional[str]:
        return self.websocket_users.get(websocket)

    def get_websockets_in_room(self, room_id: str) -> Set:
        return self.rooms.get(room_id, set())

    def get_users_in_room(self, room_id: str) -> List[str]:
        users =
        if room_id in self.rooms:
            for ws in self.rooms[room_id]:
                user = self.get_user_by_websocket(ws)
                if user:
                    users.append(user)
        return users

# Instância global do ConnectionManager
manager = ConnectionManager()