import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWebSocket } from '../contexts/WebSocketContext';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  CircularProgress,
  Alert,
  LinearProgress,
  Chip
} from '@mui/material';

const QuizPage = () => {
  const { roomIdFromParams } = useParams(); // roomId da URL
  const navigate = useNavigate();
  const {
    connectionState,
    roomId, // roomId do contexto WebSocket
    gameState,
    currentQuestion,
    submitAnswer,
    scores,
    isHost,
    error,
    clearError,
    lastMessage, // Para feedback de resposta correta/incorreta
    connect
  } = useWebSocket();

  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [answerSubmittedForQuestion, setAnswerSubmittedForQuestion] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' }); // Para 'answer_result'
  const currentUserName = localStorage.getItem('userName');

  // Checagem inicial e redirecionamento
  useEffect(() => {
    if (!currentUserName) {
        navigate('/'); // Sem usuário, volta para home
        return;
    }
    if (connectionState === 'disconnected') {
        connect(currentUserName); // Tenta reconectar se desconectado
    }
    // Se o roomId do WebSocket não corresponder ao da URL, ou não houver roomId no contexto,
    // pode indicar um estado inconsistente ou acesso direto à URL.
    // Idealmente, o LobbyPage deveria ser a entrada.
    if (connectionState === 'connected' && !roomId) {
        // Poderia tentar um join automático se tivermos o room Id dos params,
        // mas isso pode ser complexo. Por ora, redireciona para o lobby.
        console.warn("QuizPage acessada sem um roomId no contexto WebSocket. Redirecionando para o lobby.");
        navigate('/lobby');
    }
  }, [connectionState, roomId, roomIdFromParams, currentUserName, connect, navigate]);


  // Navegação baseada no estado do jogo
  useEffect(() => {
    if (gameState === 'finished' && roomId) {
      navigate(`/score/\${roomId}`);
    } else if (gameState === 'waiting' && roomId) {
      // Se o jogo voltar para 'waiting' por algum motivo (ex: host saiu e voltou pro lobby)
      navigate('/lobby');
    }
  }, [gameState, roomId, navigate]);

  // Feedback da resposta
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'answer_result') {
      if (lastMessage.is_correct) {
        setFeedback({ type: 'success', message: 'Correto!' });
      } else {
        setFeedback({ type: 'error', message: 'Incorreto.' });
      }
      // Limpa feedback após um tempo
      const timer = setTimeout(() => setFeedback({ type: '', message: '' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastMessage]);

  // Quando uma nova pergunta chega, reseta a seleção e o estado de submissão
  useEffect(() => {
    if (currentQuestion) {
      setSelectedAnswer('');
      setAnswerSubmittedForQuestion(false);
      setFeedback({ type: '', message: '' }); // Limpa feedback anterior
      clearError(); // Limpa erros gerais
    }
  }, [currentQuestion, clearError]);


  const handleAnswerChange = (event) => {
    setSelectedAnswer(event.target.value);
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer && currentQuestion) {
      // O question_id esperado pelo backend é o índice da pergunta na sala.
      // currentQuestion.id é o ID original da DB.
      // currentQuestion.question_number é 1-indexed.
      submitAnswer(selectedAnswer, currentQuestion.question_number -1); // Enviando índice 0-based
      setAnswerSubmittedForQuestion(true);
    }
  };

  if (connectionState === 'connecting') {
    return (
      <Container sx={{ textAlign: 'center', mt: 5 }}>
        <CircularProgress />
        <Typography variant="h6">Carregando Quiz...</Typography>
      </Container>
    );
  }

  if (connectionState === 'disconnected' || (connectionState === 'error' && !roomId) ) {
    return (
      <Container component={Paper} sx={{ p: 4, mt: 4, textAlign: 'center' }}>
        <Typography variant="h5" color="error">
           {error?.message || 'Desconectado ou erro na conexão.'}
        </Typography>
        <Button variant="contained" onClick={() => navigate('/')} sx={{ mt: 2 }}>
          Voltar para a Página Inicial
        </Button>
      </Container>
    );
  }

  if (gameState !== 'active' || !currentQuestion) {
    return (
      <Container component={Paper} sx={{ p: 4, mt: 4, textAlign: 'center' }}>
        <Typography variant="h5">Aguardando o início do jogo ou a próxima pergunta...</Typography>
        {isHost && gameState === 'waiting' && (
          <Button variant="contained" color="primary" onClick={() => navigate('/lobby')} sx={{mt:2}}>
            Voltar ao Lobby para Iniciar
          </Button>
        )}
        <CircularProgress sx={{ mt: 2 }} />
         {roomId && <Typography variant="caption" sx={{display: 'block', mt:1}}>Sala: {roomId}</Typography>}
      </Container>
    );
  }
  
  // Progresso do quiz
  const progress = currentQuestion.total_questions > 0 ? (currentQuestion.question_number / currentQuestion.total_questions) * 100 : 0;

  return (
    <Container component={Paper} sx={{ p: 3, mt: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Trivia Quiz - Sala: {roomId}
      </Typography>

      {error && (
        <Alert severity="error" onClose={clearError} sx={{ mb: 2 }}>
          {error.message || 'Ocorreu um erro.'}
        </Alert>
      )}

      <Box sx={{ width: '100%', mb: 2 }}>
        <Typography variant="body2" color="text.secondary" align="center" sx={{mb: 1}}>
            Pergunta {currentQuestion.question_number} de {currentQuestion.total_questions}
            {currentQuestion.points && <Chip label={`\${currentQuestion.points} pontos`} size="small" sx={{ml:1}}/>}
        </Typography>
        <LinearProgress variant="determinate" value={progress} />
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
          {currentQuestion.question_text}
        </Typography>
        <FormControl component="fieldset" fullWidth disabled={answerSubmittedForQuestion}>
          <RadioGroup
            aria-label="quiz-question"
            name="quiz-question-options"
            value={selectedAnswer}
            onChange={handleAnswerChange}
          >
            {currentQuestion.options.map((option, index) => (
              <FormControlLabel
                key={index}
                value={option}
                control={<Radio />}
                label={option}
                sx={{
                    p: 1,
                    borderRadius: 1,
                    border: '1px solid #eee',
                    mb: 1,
                    '&:hover': { backgroundColor: '#f9f9f9'},
                }}
              />
            ))}
          </RadioGroup>
        </FormControl>
      </Box>

        {feedback.message && (
            <Alert severity={feedback.type} sx={{ mb: 2 }}>
            {feedback.message}
            </Alert>
        )}

      <Box sx={{ textAlign: 'center' }}>
        {!answerSubmittedForQuestion ? (
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={handleSubmitAnswer}
            disabled={!selectedAnswer || answerSubmittedForQuestion}
          >
            Enviar Resposta
          </Button>
        ) : (
          <Box>
            <Typography variant="subtitle1" sx={{mb:1}}>Resposta enviada! Aguardando resultado ou próxima pergunta...</Typography>
            <CircularProgress size={24}/>
          </Box>
        )}
      </Box>
      
      <Box sx={{mt: 3, p:1, borderTop: '1px solid #eee'}}>
        <Typography variant="h6" sx={{fontSize: '1rem'}}>Sua Pontuação Atual: {scores[currentUserName] !== undefined ? scores[currentUserName] : 'Calculando...'}</Typography>
      </Box>

    </Container>
  );
};

export default QuizPage;