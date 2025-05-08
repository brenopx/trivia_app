import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#1E88E5', // Um azul vibrante
    },
    secondary: {
      main: '#FFC107', // Um amarelo para destaque
    },
    background: {
      default: '#f4f6f8', // Um cinza claro para o fundo
      paper: '#ffffff',
    },
    text: {
      primary: '#333333',
      secondary: '#555555',
    }
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
      marginBottom: '1rem',
    },
    h5: {
      fontWeight: 600,
      marginBottom: '0.75rem',
    },
    h6: {
        fontWeight: 600,
        marginBottom: '0.5rem',
    }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          textTransform: 'none',
          padding: '10px 20px',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          boxShadow: '0px 5px 15px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiTextField: {
        defaultProps: {
            variant: 'outlined',
            margin: 'normal',
            fullWidth: true,
        }
    }
  }
});