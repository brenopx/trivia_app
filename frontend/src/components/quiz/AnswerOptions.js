import React from 'react';
import { Button, Grid } from '@mui/material';
import PropTypes from 'prop-types';

/**
 * Exibe as opções de resposta para uma pergunta de trivia.
 * @param {object} props - As props do componente.
 * @param {string} props.options - Um array de strings representando as opções de resposta.
 * @param {function} props.onSelectAnswer - Callback chamado quando uma opção é selecionada.
 * @param {boolean} props.isSubmitting - Indica se uma resposta está sendo submetida (para desabilitar botões).
 * @returns {JSX.Element}
 */
const AnswerOptions = ({ options, onSelectAnswer, isSubmitting }) => {
  if (!options |
| options.length === 0) {
    return <Typography>Carregando opções...</Typography>;
  }

  return (
    <Grid container spacing={2} justifyContent="center">
      {options.map((option, index) => (
        <Grid item xs={12} sm={6} key={index}>
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={() => onSelectAnswer(option)}
            disabled={isSubmitting}
            sx={{ py: 1.5, fontSize: '1rem' }}
          >
            {option}
          </Button>
        </Grid>
      ))}
    </Grid>
  );
};

AnswerOptions.propTypes = {
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  onSelectAnswer: PropTypes.func.isRequired,
  isSubmitting: PropTypes.bool,
};

AnswerOptions.defaultProps = {
  isSubmitting: false,
};

export default AnswerOptions;