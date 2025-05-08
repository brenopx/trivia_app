import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../contexts/WebSocketContext';
import {
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Box,
  CircularProgress,
  Alert
} from '@mui/material';

const ScorePage = () => {
  const navigate = useNavigate();
  const { scores, roomDetails, resetForNewGame, error, clearError, connectionState, roomId } = useWebSocket();

  const handlePlayAgain = () => {
    resetForNewGame();
    // Se o usuário quiser voltar para o lobby para criar/entrar em uma nova sala.
    // Se a intenção é REINICIAR o mesmo jogo com os mesmos jogadores,
    // o backend precisaria de uma lógica para isso, e uma mensagem como 'restart_game'.
    // Para o escopo atual, voltar ao lobby é mais simples.
    navigate('/lobby');
  };

  const handleReturnToHome = () => {
    resetForNewGame(); // Também reseta o estado do WebSocket
    navigate('/');
  };

  // Ordenar scores do maior para o menor
  const sortedScores = Object.entries(scores)
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score);

  const winner = sortedScores.length > 0 ? sortedScores[0] : null;

  if (connectionState === 'connecting') {
    return (
      <Container sx={{ textAlign: 'center', mt: 5 }}>
        <CircularProgress />
        <Typography variant="h6">Conectando...</Typography>
      </Container>
    );
  }
  
  // Se não há scores ou roomId (significa que não participou de um jogo ou estado foi resetado)
  // Redirecionar para o lobby ou home pode ser uma opção.
  if (!roomId || Object.keys(scores).length === 0) {
    return (
      <Container component={Paper} sx={{ p: 4, mt: 4, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>Nenhuma pontuação para exibir.</Typography>
        <Typography gutterBottom>
          Você pode ter chegado aqui diretamente ou o jogo anterior foi concluído.
        </Typography>
        <Button variant="contained" color="primary" onClick={() => navigate('/lobby')} sx={{ mr: 2 }}>
          Ir para o Lobby
        </Button>
        <Button variant="outlined" color="secondary" onClick={handleReturnToHome}>
          Página Inicial
        </Button>
      </Container>
    );
  }


  return (
    <Container component={Paper} sx={{ p: 4, mt: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Resultados Finais
      </Typography>

      {error && (
        <Alert severity="error" onClose={clearError} sx={{ mb: 2 }}>
          {error.message || 'Ocorreu um erro.'}
        </Alert>
      )}

      {winner && (
        <Box sx={{ textAlign: 'center', mb: 3, p: 2, backgroundColor: 'gold', borderRadius: 1 }}>
          <Typography variant="h5" >
            🏆 Vencedor: {winner.name} com {winner.score} pontos! 🏆
          </Typography>
        </Box>
      )}

      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table aria-label="placar final">
          <TableHead>
            <TableRow sx={{ backgroundColor: (theme) => theme.palette.grey[200] }}>
              <TableCell>Rank</TableCell>
              <TableCell>Nome do Jogador</TableCell>
              <TableCell align="right">Pontuação</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedScores.map((player, index) => (
              <TableRow key={player.name} sx={{ '&:nth-of-type(odd)': { backgroundColor: (theme) => theme.palette.action.hover } }}>
                <TableCell component="th" scope="row">
                  {index + 1}
                </TableCell>
                <TableCell>{player.name}</TableCell>
                <TableCell align="right">{player.score}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 3 }}>
        <Button variant="contained" color="primary" onClick={handlePlayAgain}>
          Jogar Novamente (Lobby)
        </Button>
        <Button variant="outlined" color="secondary" onClick={handleReturnToHome}>
          Sair para Página Inicial
        </Button>
      </Box>
       <Typography variant="caption" display="block" align="center" sx={{mt: 2}}>
            ID da Sala: {roomId}
      </Typography>
    </Container>
  );
};

export default ScorePage;