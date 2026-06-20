import { useState } from 'react';
import { Mail, Lock, Eye, X } from 'lucide-react';
import Typewriter from './Typewriter';
import CreateAccount from './CreateAccount';

export default function LoginModal({ auth, mode = 'client', onClose, onSuccess, onForgotPassword }) {
  const [showWelcomeCard, setShowWelcomeCard] = useState(false);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Show Create Account modal
  if (showCreateAccount) {
    return (
      <CreateAccount
        onClose={() => setShowCreateAccount(false)}
        onSuccess={() => {
          // After sign-up → go straight to the welcome card
          setShowCreateAccount(false);
          setShowWelcomeCard(true);
        }}
      />
    );
  }

  return (
    <div
      className="modal-backdrop"
      onClick={() => {
        if (showWelcomeCard) {
          onSuccess();
        } else {
          onClose();
        }
      }}
    >
      <div
        className={`login-modal ${showWelcomeCard ? 'welcome-zoom' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        {!showWelcomeCard ? (
          <>
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X />
            </button>

            <h2 className="modal-title-text">
              {mode === 'admin' ? 'CA Admin Login' : 'Log in to your business dashboard'}
            </h2>

            <form
              onSubmit={async e => {
                e.preventDefault();
                const ok = await auth.login(email, password);
                if (ok) {
                  setPassword('');
                  setShowWelcomeCard(true);
                }
              }}
            >
              <div className="input-group">
                <Mail className="input-icon" />
                <input
                  type="email"
                  placeholder="Email address"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              <div className="input-group">
                <Lock className="input-icon" />
                <input
                  type="password"
                  placeholder="Password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <Eye className="input-icon-right" />
              </div>

              <div className="form-options">
                <label className="remember-me">
                  <div className="switch">
                    <input type="checkbox" id="remember" />
                    <span className="slider"></span>
                  </div>
                  <span>Remember me</span>
                </label>
                <a
                  href="#"
                  className="forgot-password"
                  onClick={e => { e.preventDefault(); onForgotPassword(); }}
                >
                  Forgot password?
                </a>
              </div>

              {auth.error && <p className="login-error-text">{auth.error}</p>}

              <button type="submit" className="login-btn" disabled={auth.loading}>
                {auth.loading ? 'Logging in…' : 'Log In'}
              </button>
            </form>

            <div className="modal-footer">
              Don't have an account?{' '}
              <a
                href="#"
                onClick={e => { e.preventDefault(); setShowCreateAccount(true); }}
              >
                Create Account
              </a>
            </div>
          </>
        ) : (
          <div
            className="welcome-content"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}
            onClick={e => { e.stopPropagation(); onSuccess(); }}
          >
            <div className="step-badge-outer">
              <div className="step-badge-inner">1</div>
            </div>
            <h2 className="welcome-title">Welcome</h2>
            <p className="welcome-subtitle">
              <Typewriter text={"Experience the future of digital interaction\nwith our premium platform"} />
            </p>
            <p className="welcome-click-hint">Click anywhere to continue →</p>
          </div>
        )}
      </div>
    </div>
  );
}
