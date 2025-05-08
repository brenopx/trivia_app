import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Container, Box } from '@mui/material';

import { theme } from './theme/theme';
import HomePage from './pages/HomePage';
import LobbyPage from './pages/LobbyPage';
import QuizPage from './pages/QuizPage';
import ScorePage from './pages/ScorePage';
import RankingPage from './pages/RankingPage';
import Navbar from './components/layout/Navbar';
import { WebSocketProvider } from './contexts/WebSocketContext';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <WebSocketProvider>
        <Router>
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Navbar />
            <Container component="main" maxWidth="md" sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/lobby/:roomId" element={<LobbyPage />} />
                <Route path="/quiz/:roomId" element={<QuizPage />} />
                <Route path="/score/:roomId" element={<ScorePage />} />
                <Route path="/ranking" element={<RankingPage />} />
              </Routes>
            </Container>
            {/* Footer pode ser adicionado aqui se necessário */}
          </Box>
        </Router>
      </WebSocketProvider>
    </ThemeProvider>
  );
}

export default App;