import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';

const WebSocketContext = createContext(null);

export const useWebSocket = () => useContext(WebSocketContext);

// Estado inicial
const initialState = {
  connectionState: 'disconnected', // 'connecting', 'connected', 'error'
  socket: null,
  roomId: null,
  isHost: false,
  roomDetails: {}, // ex: { name, users: [] }
  gameId: null, // Se aplicável, pode ser o mesmo que roomId
  gameState: 'lobby', // 'waiting', 'active', 'finished' (conforme backend)
  currentQuestion: null, // { id, question_text, options, points, question_number, total_questions }
  scores: {}, // { userId: score }
  lastMessage: null,
  error: null,
};

const actionTypes = {
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  ERROR: 'ERROR',
  SET_SOCKET: 'SET_SOCKET',
  RECEIVE_MESSAGE: 'RECEIVE_MESSAGE',
  SET_ROOM_ID: 'SET_ROOM_ID',
  SET_IS_HOST: 'SET_IS_HOST',
  UPDATE_ROOM_DETAILS: 'UPDATE_ROOM_DETAILS',
  UPDATE_GAME_STATE: 'UPDATE_GAME_STATE',
  SET_CURRENT_QUESTION: 'SET_CURRENT_QUESTION',
  UPDATE_SCORES: 'UPDATE_SCORES',
  JOIN_ROOM_SUCCESS: 'JOIN_ROOM_SUCCESS',
  GAME_STARTED: 'GAME_STARTED',
  NEW_QUESTION: 'NEW_QUESTION',
  ANSWER_RESULT: 'ANSWER_RESULT',
  SCORE_UPDATE: 'SCORE_UPDATE', // Backend envia 'score_update'
  GAME_OVER_FOR_ALL: 'GAME_OVER_FOR_ALL', // Backend envia 'game_over_for_all'
  ROOM_STATE_UPDATE: 'ROOM_STATE_UPDATE',
  RESET_STATE_FOR_NEW_GAME: 'RESET_STATE_FOR_NEW_GAME',
  CLEAR_ERROR: 'CLEAR_ERROR'
};

const reducer = (state, action) => {
  switch (action.type) {
    case actionTypes.CONNECTING:
      return { ...state, connectionState: 'connecting', error: null };
    case actionTypes.CONNECTED:
      return { ...state, connectionState: 'connected', socket: action.payload.socket, error: null };
    case actionTypes.DISCONNECTED:
      return {
        ...initialState, // Reset ao estado inicial ao desconectar para limpar dados de sala/jogo
        error: action.payload?.error ? { message: 'Desconectado: ' + action.payload.error } : { message: 'Desconectado do servidor.' }
      };
    case actionTypes.ERROR:
      return { ...state, connectionState: 'error', error: action.payload.error, socket: null };
    case actionTypes.SET_SOCKET: // Raramente usado diretamente se CONNECTED lida com isso
      return { ...state, socket: action.payload.socket };
    case actionTypes.RECEIVE_MESSAGE:
      // Este é um tipo genérico, ações mais específicas abaixo são preferíveis
      return { ...state, lastMessage: action.payload.message };
    case actionTypes.SET_ROOM_ID:
      return { ...state, roomId: action.payload.roomId };
    case actionTypes.SET_IS_HOST:
      return { ...state, isHost: action.payload.isHost };
    case actionTypes.UPDATE_ROOM_DETAILS: // Usado por ROOM_STATE_UPDATE
      return { ...state, roomDetails: action.payload.roomDetails };
    case actionTypes.UPDATE_GAME_STATE: // Usado por ROOM_STATE_UPDATE
      return { ...state, gameState: action.payload.gameState };
    case actionTypes.SET_CURRENT_QUESTION: // Usado por GAME_STARTED e NEW_QUESTION
      return { ...state, currentQuestion: action.payload.currentQuestion };
    case actionTypes.UPDATE_SCORES: // Usado por SCORE_UPDATE e GAME_OVER_FOR_ALL
      return { ...state, scores: action.payload.scores };

    // Ações baseadas em mensagens do WebSocket do backend
    case actionTypes.JOIN_ROOM_SUCCESS:
      return {
        ...state,
        roomId: action.payload.room_id,
        isHost: action.payload.is_host,
        roomDetails: action.payload.room_state.players ? { users: Object.keys(action.payload.room_state.players) } : { users: [] }, // Simplificado, ajuste conforme necessário
        gameState: action.payload.room_state.game_status,
        scores: action.payload.room_state.players ? Object.values(action.payload.room_state.players).reduce((acc, p) => { acc[p.name] = p.score; return acc; }, {}) : {},
        error: null,
      };
    case actionTypes.ROOM_STATE_UPDATE:
      return {
        ...state,
        roomDetails: action.payload.room_state.players ? { ...action.payload.room_state, users: Object.values(action.payload.room_state.players).map(p => p.name) } : { users: [] },
        gameState: action.payload.room_state.game_status,
        scores: action.payload.room_state.players ? Object.values(action.payload.room_state.players).reduce((acc, p) => { acc[p.name] = p.score; return acc; }, {}) : {},
        isHost: state.roomDetails.host_name === localStorage.getItem('userName'), // Reavaliar se o host mudou
        currentQuestion: action.payload.room_state.game_status === 'active' && action.payload.room_state.current_question_index !== -1
            ? action.payload.room_state.questions[action.payload.room_state.current_question_index]
            : null, // Atualiza a pergunta se o estado da sala indicar
      };
    case actionTypes.GAME_STARTED:
      return {
        ...state,
        gameState: 'active',
        currentQuestion: { ...action.payload.question, question_number: action.payload.question_number, total_questions: action.payload.total_questions },
        scores: state.roomDetails.users ? state.roomDetails.users.reduce((acc, userName) => { acc[userName] = 0; return acc; }, {}) : {}, // Reset scores on game start
      };
    case actionTypes.NEW_QUESTION:
      return {
        ...state,
        gameState: 'active', // Garante que o estado do jogo é 'active'
        currentQuestion: { ...action.payload.question, question_number: action.payload.question_number, total_questions: action.payload.total_questions },
      };
    case actionTypes.ANSWER_RESULT: // Mensagem pessoal, pode não precisar atualizar estado global, a menos que scores sejam atualizados aqui.
      // O backend já envia SCORE_UPDATE separadamente, então podemos apenas registrar a última mensagem ou um feedback local.
      return {
        ...state,
        lastMessage: action.payload // ou um estado específico para feedback de resposta
        // Se quiser atualizar a pontuação do jogador atual aqui:
        // scores: { ...state.scores, [localStorage.getItem('userName')]: action.payload.your_score }
      };
    case actionTypes.SCORE_UPDATE: //  Mensagem de broadcast com todos os scores
        return { ...state, scores: action.payload.scores };
    case actionTypes.GAME_OVER_FOR_ALL:
      return {
        ...state,
        gameState: 'finished',
        scores: action.payload.final_scores,
        currentQuestion: null, // Limpa a pergunta atual
      };
    case actionTypes.RESET_STATE_FOR_NEW_GAME:
      return {
        ...initialState,
        connectionState: state.connectionState, // Mantém o estado da conexão
        socket: state.socket, // Mantém o socket
        error: null,
      };
    case actionTypes.CLEAR_ERROR:
      return { ...state, error: null };
    default:
      return state;
  }
};

export const WebSocketProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const connect = useCallback((userName) => {
    if (state.socket && state.connectionState === 'connected') {
      console.log("Já conectado.");
      return;
    }
    dispatch({ type: actionTypes.CONNECTING });
    const wsUrl = `ws://localhost:8000/ws/\${userName}`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('WebSocket Conectado');
      dispatch({ type: actionTypes.CONNECTED, payload: { socket } });
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('WebSocket Mensagem Recebida:', message);
      dispatch({ type: actionTypes.RECEIVE_MESSAGE, payload: { message } });

      // Mapeia tipos de mensagens do backend para ações do reducer
      switch (message.type) {
        case 'join_room_success':
          dispatch({ type: actionTypes.JOIN_ROOM_SUCCESS, payload: message });
          // O nome do usuário é necessário para determinar isHost, pode ser pego do localStorage ou estado global
          const currentUserName = localStorage.getItem('userName');
          if (message.room_state && message.room_state.host_name === currentUserName) {
            dispatch({ type: actionTypes.SET_IS_HOST, payload: { isHost: true } });
          }
          break;
        case 'room_state_update':
          dispatch({ type: actionTypes.ROOM_STATE_UPDATE, payload: message });
          break;
        case 'game_started':
          dispatch({ type: actionTypes.GAME_STARTED, payload: message });
          break;
        case 'new_question':
          dispatch({ type: actionTypes.NEW_QUESTION, payload: message });
          break;
        case 'answer_result': // Mensagem pessoal
          dispatch({ type: actionTypes.ANSWER_RESULT, payload: message });
          break;
        case 'score_update': // Broadcast com scores
          dispatch({ type: actionTypes.SCORE_UPDATE, payload: message.scores });
          break;
        case 'game_over_for_all':
          dispatch({ type: actionTypes.GAME_OVER_FOR_ALL, payload: message });
          break;
        case 'create_room_error':
        case 'join_room_error':
        case 'error':
          dispatch({ type: actionTypes.ERROR, payload: { error: { type: message.type, message: message.message } } });
          break;
        default:
          console.warn(`Tipo de mensagem não tratada: \${message.type}`);
      }
    };

    socket.onclose = (event) => {
      console.log('WebSocket Desconectado:', event.reason, event.code);
      if (event.wasClean) {
        dispatch({ type: actionTypes.DISCONNECTED });
      } else {
        // Ex: O servidor encerrou a conexão ou houve um erro de rede
        dispatch({ type: actionTypes.DISCONNECTED, payload: { error: event.reason || 'Conexão perdida' } });
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket Erro:', error);
      dispatch({ type: actionTypes.ERROR, payload: { error: { message: 'Erro na conexão WebSocket.'} } });
      // Tenta fechar o socket se ele existir e não estiver fechado para limpar
      if (socket && socket.readyState !== WebSocket.CLOSED) {
        socket.close();
      }
    };
    // Não é necessário setSocket aqui, pois onopen fará isso.
  }, [state.socket, state.connectionState]); // Adicionar dependências relevantes

  const disconnect = useCallback(() => {
    if (state.socket) {
      state.socket.close();
      // O onclose handler vai disparar DISCONNECTED
    }
  }, [state.socket]);

  const sendMessage = useCallback((messageObject) => {
    if (state.socket && state.socket.readyState === WebSocket.OPEN) {
      state.socket.send(JSON.stringify(messageObject));
      console.log('WebSocket Mensagem Enviada:', messageObject);
    } else {
      console.error('Não é possível enviar mensagem, WebSocket não está conectado.');
      dispatch({ type: actionTypes.ERROR, payload: { error: { message: 'Falha ao enviar mensagem: WebSocket não conectado.'}}})
    }
  }, [state.socket]);

  // Funções de ação específicas
  const createRoom = useCallback(() => {
    sendMessage({ type: 'create_room' });
  }, [sendMessage]);

  const joinRoom = useCallback((roomIdToJoin) => {
    sendMessage({ type: 'join_room', payload: { room_id: roomIdToJoin } });
  }, [sendMessage]);

  const startGame = useCallback(() => {
    if (state.isHost) {
      sendMessage({ type: 'start_game' });
    } else {
      console.warn("Apenas o host pode iniciar o jogo.");
       dispatch({ type: actionTypes.ERROR, payload: { error: { message: 'Apenas o host pode iniciar o jogo.'}}});
    }
  }, [sendMessage, state.isHost]);

  const submitAnswer = useCallback((answer, questionId) => {
    // O backend espera 'question_id' como o índice da pergunta na lista de perguntas da sala
    // Se currentQuestion tem 'id' (o ID original da DB) e 'question_number' (1-indexed)
    // precisamos enviar o índice 0-indexed se for o caso.
    // Da game_manager.py: question_idx_answered = payload.get("question_id")
    // Isso sugere que o backend espera o índice da pergunta na sala.
    // currentQuestion.question_number é 1-indexed.
    const questionIndexInRoom = state.currentQuestion?.question_number - 1;

    if (state.currentQuestion && typeof questionIndexInRoom === 'number' && questionIndexInRoom >= 0) {
        sendMessage({
            type: 'submit_answer',
            payload: {
                answer: answer,
                question_id: questionIndexInRoom // Enviando o índice 0-based da pergunta na sala
            }
        });
    } else {
        console.error("Não é possível enviar resposta: pergunta atual inválida ou índice não encontrado.");
        dispatch({ type: actionTypes.ERROR, payload: { error: { message: 'Erro ao submeter resposta: pergunta atual inválida.'}}});
    }
  }, [sendMessage, state.currentQuestion]);

  const resetForNewGame = useCallback(() => {
    dispatch({ type: actionTypes.RESET_STATE_FOR_NEW_GAME });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: actionTypes.CLEAR_ERROR });
  }, []);


  // Efeito para limpar o socket ao desmontar o componente
  useEffect(() => {
    return () => {
      if (state.socket && state.socket.readyState === WebSocket.OPEN) {
        state.socket.close();
      }
    };
  }, [state.socket]);

  const contextValue = {
    ...state,
    connect,
    disconnect,
    sendMessage, // Genérico, pode ser removido se preferir apenas ações específicas
    createRoom,
    joinRoom,
    startGame,
    submitAnswer,
    resetForNewGame,
    clearError,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};