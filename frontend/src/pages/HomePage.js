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
  Alert
} from '@mui/material';

const HomePage = () => {
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '');
  const navigate = useNavigate();
  const { connect, connectionState, disconnect, error, clearError, resetForNewGame } = useWebSocket();

  useEffect(() => {
    // Se o usuário volta para a HomePage e já estava conectado a uma sala,
    // pode ser útil desconectar e resetar o estado do WebSocket.
    if (connectionState === 'connected') {
        // Pequeno delay para garantir que a mensagem de desconexão seja enviada se necessário
        // ou apenas resetar o estado para forçar uma nova conexão com o nome de usuário.
        // Se o socket ainda estiver ativo de uma sessão anterior sem nome de usuário,
        // é melhor desconectar explicitamente.
        disconnect(); // Isso irá eventualmente levar ao estado 'disconnected'
        resetForNewGame(); // Limpa roomId, gameState, etc.
    }
  }, []); // Executa apenas na montagem para limpar estado prévio.


  const handleConnect = () => {
    if (userName.trim()) {
      localStorage.setItem('userName', userName.trim());
      clearError(); // Limpa erros anteriores antes de tentar conectar
      connect(userName.trim());
      // A navegação para o lobby pode ocorrer aqui ou ser acionada pelo estado 'connected'
      // Por simplicidade, navegaremos após a tentativa de conexão.
      // O LobbyPage pode lidar com o estado 'connecting'.
      navigate('/lobby');
    } else {
      // Tratar erro de nome de usuário vazio se necessário (MUI TextField já tem validação 'required')
      alert("Por favor, insira um nome de usuário.");
    }
  };

  return (
    <Container component={Paper} maxWidth="sm" sx={{ mt: 8, p: 4, textAlign: 'center' }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Bem-vindo ao Trivia Game!
      </Typography>

      {error && connectionState !== 'connecting' && ( // Não mostrar erro de conexão anterior se estiver tentando uma nova
        <Alert severity="error" onClose={clearError} sx={{ mb: 2 }}>
          {error.message || 'Ocorreu um erro na conexão.'}
        </Alert>
      )}

      <Box component="form" onSubmit={(e) => { e.preventDefault(); handleConnect(); }} sx={{ mt: 3 }}>
        <TextField
          label="Seu Nome de Usuário"
          variant="outlined"
          fullWidth
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          required
          sx={{ mb: 2 }}
          autoFocus
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          size="large"
          disabled={connectionState === 'connecting'}
          fullWidth
        >
          {connectionState === 'connecting' ? <CircularProgress size={24} color="inherit" /> : 'Entrar / Conectar'}
        </Button>
      </Box>

      {connectionState !== 'disconnected' && connectionState !== 'error' && (
         <Typography variant="caption" display="block" sx={{ mt: 2 }}>
           Status da Conexão: {connectionState}
         </Typography>
      )}
    </Container>
  );
};

export default HomePage;