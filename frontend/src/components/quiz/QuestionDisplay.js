import React from 'react';
import { Typography, Paper, Box } from '@mui/material';
import PropTypes from 'prop-types';

/**
 * Exibe o texto da pergunta atual do trivia, número da pergunta e pontuação atual.
 * @param {object} props - As props do componente.
 * @param {string} props.questionText - O texto da pergunta atual.
 * @param {number} props.questionNumber - O número da pergunta atual.
 * @param {number} props.totalQuestions - O número total de perguntas.
 * @param {number} props.currentScore - A pontuação atual do jogador.
 * @returns {JSX.Element}
 */
const QuestionDisplay = ({ questionText, questionNumber, totalQuestions, currentScore }) => {
  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3, textAlign: 'center' }}>
      <Typography variant="h5" component="h2" gutterBottom>
        Pergunta {questionNumber} de {totalQuestions}
      </Typography>
      <Typography variant="h6" component="p" sx={{ minHeight: '60px', my: 2, fontWeight: 500 }}>
        {questionText}
      </Typography>
      <Box sx={{ mt: 1 }}>
        <Typography variant="subtitle1" color="textSecondary">
          Sua Pontuação Atual: {currentScore}
        </Typography>
      </Box>
    </Paper>
  );
};

QuestionDisplay.propTypes = {
  questionText: PropTypes.string.isRequired,
  questionNumber: PropTypes.number.isRequired,
  totalQuestions: PropTypes.number.isRequired,
  currentScore: PropTypes.number.isRequired,
};

export default QuestionDisplay;