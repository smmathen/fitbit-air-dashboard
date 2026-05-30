import { useState } from 'react';
import { requestAccessToken, GOOGLE_CLIENT_ID } from '../lib/healthApi';

export default function LoginPage({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const needsConfig = GOOGLE_CLIENT_ID === 'YOUR_CLIENT_ID_HERE';

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      await requestAccessToken();
      onLogin();
    } catch (err) {
      setError(err.error_description || err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="20" fill="var(--accent)"/>
            <path d="M12 20C12 15.6 15.6 12 20 12C24.4 12 28 15.6 28 20" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="20" cy="20" r="3" fill="white"/>
            <path d="M20 17V12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>

        <h1>Health<br/>Dashboard</h1>
        <p className="login-subtitle">Fitbit Air · Google Health API</p>

        {needsConfig && (
          <div className="config-warning">
            <strong>Setup required</strong>
            <p>
              Add your Google Cloud OAuth Client ID to <code>.env</code>:<br/>
              <code>VITE_GOOGLE_CLIENT_ID=your_id.apps.googleusercontent.com</code>
            </p>
            <p>
              <a href="https://developers.google.com/health/setup" target="_blank" rel="noopener">
                → Setup guide
              </a>
            </p>
          </div>
        )}

        {error && <div className="error-msg">{error}</div>}

        <button
          className="login-btn"
          onClick={handleLogin}
          disabled={loading || needsConfig}
        >
          {loading ? (
            <span className="spinner" />
          ) : (
            <>
              <GoogleIcon />
              Sign in with Google
            </>
          )}
        </button>

        <p className="login-fine">
          Requests read-only access to your Fitbit Air data via the Google Health API.
          Your data never leaves your browser.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
