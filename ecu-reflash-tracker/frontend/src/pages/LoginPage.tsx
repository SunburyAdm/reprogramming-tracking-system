import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/api';
import { useAuthStore } from '../store/index';
import './LoginPage.css';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@local');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await login(email, password);
      setAuth(data.access_token, data.user);
      navigate('/sessions');
    } catch {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">⚡ ECU Reflash Tracker</div>
        <p className="login-subtitle">Industrial Flash Session Management</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" required autoFocus />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" required />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
