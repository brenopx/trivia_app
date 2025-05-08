import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../contexts/WebSocketContext';
import {
  Container,
  TextField,
  Button,
  Typography,
  Paper,
  Box,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
  Grid
} from '@mui/material';

const LobbyPage = () => {
  const navigate = useNavigate();
  const {
    connectionState,
    createRoom,
    joinRoom,
    roomId,
    roomDetails,
    isHost,
    startGame,
    gameState,
    error,
    clearError,
    connect // Para o caso de F5 na página
  } = useWebSocket();
  const [roomIdToJoin, setRoomIdToJoin] = useState('');
  const currentUserName = localStorage.getItem('userName');

 useEffect(() => {
    // Se não houver nome de usuário, redireciona para a HomePage
    if (!currentUserName) {
      navigate('/');
      return;
    }
    // Se o estado da conexão for 'disconnected', tenta reconectar
    if (connectionState === 'disconnected') {
      connect(currentUserName);
    }
  }, [connectionState, connect, currentUserName, navigate]);

  useEffect(() => {
    // Se um ID de sala existe e o jogo começou, navega para a página do quiz
    // gameState pode ser 'waiting', 'active', 'finished'
    if (roomId && gameState === 'active') {
      navigate(`/quiz/\${roomId}`);
    }
    // Se um ID de sala existe e o jogo terminou, navega para a página de scores
    if (roomId && gameState === 'finished') {
      navigate(`/score/\${roomId}`);
    }
  }, [roomId, gameState, navigate]);

  const handleCreateRoom = () => {
    clearError();
    createRoom();
    // A navegação ou atualização da UI ocorrerá baseada nas mensagens WebSocket (join_room_success, room_state_update)
  };

  const handleJoinRoom = () => {
    if (roomIdToJoin.trim()) {
      clearError();
      joinRoom(roomIdToJoin.trim().toUpperCase());
    } else {
       alert("Por favor, insira o ID da Sala.");
    }
  };

  const handleStartGame = () => {
    if (isHost) {
      clearError();
      startGame();
    }
  };

 if (connectionState === 'connecting') {
    return (
      <Container sx={{ textAlign: 'center', mt: 5 }}>
        <CircularProgress />
        <Typography variant="h6">Conectando ao servidor do Lobby...</Typography>
      </Container>
    );
  }

  if (connectionState === 'disconnected' || connectionState === 'error' && !error?.type?.includes('room_error')) {
     // Se o erro for específico da sala, permite que o usuário tente outra ação no lobby
    return (
      <Container component={Paper} sx={{ p: 4, mt: 4, textAlign: 'center' }}>
        <Typography variant="h5" color="error">
          {error?.message || 'Desconectado do servidor.'}
        </Typography>
        <Button variant="contained" onClick={() => navigate('/')} sx={{ mt: 2 }}>
          Voltar para a Página Inicial
        </Button>
      </Container>
    );
  }


  return (
    <Container component={Paper} sx={{ p: 3, mt: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Lobby do Jogo Trivia
      </Typography>
      <Typography variant="subtitle1" align="center" gutterBottom>
        Olá, {currentUserName}! Conectado como: {currentUserName}
      </Typography>

      {error && (
        <Alert severity="error" onClose={clearError} sx={{ mb: 2 }}>
          {error.message || 'Ocorreu um erro.'} (Tipo: {error.type})
        </Alert>
      )}

      {!roomId ? (
        <Grid container spacing={3} justifyContent="center">
          <Grid item xs={12} md={6}>
            <Box sx={{ p: 2, border: '1px dashed grey', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>Criar Nova Sala</Typography>
              <Button variant="contained" color="primary" onClick={handleCreateRoom} fullWidth>
                Criar Sala
              </Button>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box component="form" onSubmit={(e) => {e.preventDefault(); handleJoinRoom();}} sx={{ p: 2, border: '1px dashed grey', borderRadius: 1 }}>
              <Typography variant="h6" gutterBottom align="center">Entrar em Sala Existente</Typography>
              <TextField
                label="ID da Sala"
                variant="outlined"
                fullWidth
                value={roomIdToJoin}
                onChange={(e) => setRoomIdToJoin(e.target.value)}
                sx={{ mb: 1 }}
                inputProps={{ style: { textTransform: 'uppercase' } }}
              />
              <Button type="submit" variant="contained" color="secondary" fullWidth>
                Entrar na Sala
              </Button>
            </Box>
          </Grid>
        </Grid>
      ) : (
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            Você está na Sala: {roomId}
          </Typography>
          {roomDetails?.name && <Typography variant="subtitle1">Nome da Sala: {roomDetails.name}</Typography>}
          
          <Typography variant="h6" sx={{mt: 2}}>Jogadores na Sala ({roomDetails?.users?.length || 0}):</Typography>
          {roomDetails?.users && roomDetails.users.length > 0 ? (
            <List dense sx={{ maxWidth: 300, margin: 'auto', border: '1px solid #ccc', borderRadius: 1, mb:2 }}>
              {roomDetails.users.map((user, index) => (
                <React.Fragment key={user}>
                  <ListItem>
                    <ListItemText primaryTypographyProps={{ fontWeight: user === roomDetails.host_name ? 'bold' : 'normal' }}>
                        {user} {user === roomDetails.host_name ? '(Host 👑)' : ''} {user === currentUserName ? '(Você)' : ''}
                    </ListItemText>
                  </ListItem>
                  {index < roomDetails.users.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          ) : (
            <Typography sx={{mb:2}}>Aguardando jogadores...</Typography>
          )}

          {isHost && gameState === 'waiting' && (
            <Button variant="contained" color="success" size="large" onClick={handleStartGame} sx={{ mt: 2 }}>
              Iniciar Jogo
            </Button>
          )}
          {!isHost && gameState === 'waiting' && (
            <Typography variant="subtitle1" sx={{ mt: 2 }}>
              Aguardando o host ({roomDetails?.host_name || '...'}) iniciar o jogo.
            </Typography>
          )}
           {gameState !== 'waiting' && (
             <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 2 }}>
                Status do Jogo: {gameState}
            </Typography>
           )}
        </Box>
      )}
    </Container>
  );
};

export default LobbyPage;