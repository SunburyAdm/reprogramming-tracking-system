import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/index';
import LoginPage from './pages/LoginPage';
import SessionDashboard from './pages/SessionDashboard';
import SessionDetail from './pages/SessionDetail';
import StationWorkbench from './pages/StationWorkbench';
import './App.css';

function PrivateRoute({ children }: { children: JSX.Element }) {
  const { token } = useAuthStore();
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { token, fetchMe } = useAuthStore();

  useEffect(() => {
    if (token) fetchMe();
  }, [token]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/sessions" element={<PrivateRoute><SessionDashboard /></PrivateRoute>} />
      <Route path="/sessions/:id" element={<PrivateRoute><SessionDetail /></PrivateRoute>} />
      <Route path="/sessions/:id/workbench" element={<PrivateRoute><StationWorkbench /></PrivateRoute>} />
      <Route path="*" element={<Navigate to={token ? '/sessions' : '/login'} replace />} />
    </Routes>
  );
}
