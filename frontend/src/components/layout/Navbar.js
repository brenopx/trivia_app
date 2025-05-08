import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useWebSocketContext } from '../../contexts/WebSocketContext'; // Para desconectar

const Navbar = () => {
  const navigate = useNavigate();
  const { userName, disconnectWebSocket, gameStatus } = useWebSocketContext();

  const handleLogout = () => {
    disconnectWebSocket();
    navigate('/');
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component={RouterLink} to="/" sx={{ flexGrow: 1, color: 'inherit', textDecoration: 'none' }}>
          Trivia Game
        </Typography>
        <Button color="inherit" component={RouterLink} to="/ranking">Ranking</Button>
        {userName && gameStatus!== 'IDLE' && (
          <Button color="inherit" onClick={handleLogout}>
            Sair (Logout)
          </Button>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;