import { useState, useEffect } from 'react';
import { initGoogleAuth, getStoredToken } from './lib/healthApi';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import './styles.css';

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Check for existing valid token
    const token = getStoredToken();
    if (token) setAuthed(true);

    // Initialize Google auth library
    initGoogleAuth().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="splash">
        <div className="splash-dot" />
      </div>
    );
  }

  return authed
    ? <Dashboard onLogout={() => setAuthed(false)} />
    : <LoginPage onLogin={() => setAuthed(true)} />;
}
