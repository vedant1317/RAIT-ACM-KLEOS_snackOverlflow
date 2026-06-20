import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, X } from 'lucide-react';
import OtpInput from './OtpInput';
import { getCriteria, isValidEmail } from '../utils/passwordCriteria';

export default function ForgotPassword({ onClose, onBackToLogin }) {
  // fpStep: 'email' | 'otp' | 'verifying' | 'update' | 'update-criteria'
  const [fpStep, setFpStep] = useState('email');
  const [fpEmail, setFpEmail] = useState('');
  const [fpOtp, setFpOtp] = useState('');
  const [fpVerifyState, setFpVerifyState] = useState('idle'); // idle | verifying | verified
  const [fpPassword, setFpPassword] = useState('');
  const [fpConfirm, setFpConfirm] = useState('');
  const [fpShowPw, setFpShowPw] = useState(false);
  const [fpShowCf, setFpShowCf] = useState(false);

  const fpCriteria = getCriteria(fpPassword);
  const allMet = fpCriteria.every(c => c.ok);
  const passwordsMatch = allMet && fpConfirm === fpPassword && fpConfirm.length > 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="login-modal fp-modal" onClick={e => e.stopPropagation()}>

        {/* Close */}
        <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
          <X />
        </button>

        {/* ── STEP 1 : Email entry ── */}
        {fpStep === 'email' && (
          <>
            <h2 className="fp-title">Forgot password?</h2>
            <p className="fp-sub">Enter your email and we'll send you a reset link</p>

            <label className="fp-label">Email</label>
            <div className="fp-input-wrap">
              <Mail className="fp-input-icon" />
              <input
                className="fp-input"
                type="email"
                placeholder="you@example.com"
                value={fpEmail}
                onChange={e => setFpEmail(e.target.value)}
                autoFocus
              />
            </div>

            <button
              className={`fp-action-btn ${isValidEmail(fpEmail) ? 'fp-btn-active' : ''}`}
              disabled={!isValidEmail(fpEmail)}
              onClick={() => setFpStep('otp')}
            >
              Send OTP →
            </button>

            <div className="fp-or-divider"><span>OR</span></div>

            <button className="fp-back-login" onClick={onBackToLogin}>Back to log in</button>
            <button className="fp-create-account" onClick={onClose}>Create a new account</button>
          </>
        )}

        {/* ── STEP 2 : OTP entry ── */}
        {fpStep === 'otp' && (
          <>
            <div className="fp-email-icon-wrap">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              <svg className="fp-email-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>

            <h2 className="fp-title" style={{ fontSize: '26px' }}>Enter your one-time password</h2>
            <p className="fp-sub">We've sent a code to your email. Please enter it below.</p>

            <div className="fp-divider" />

            <OtpInput value={fpOtp} onChange={setFpOtp} />

            <button
              className={`fp-action-btn ${fpOtp.length === 6 ? 'fp-btn-active' : ''}`}
              disabled={fpOtp.length !== 6}
              onClick={() => {
                setFpStep('verifying');
                setFpVerifyState('verifying');
                setTimeout(() => {
                  setFpVerifyState('verified');
                  setTimeout(() => setFpStep('update'), 1200);
                }, 1500);
              }}
            >
              Continue
            </button>

            <p className="fp-resend">
              Experiencing issues receiving the code?{' '}
              <strong><u style={{ cursor: 'pointer' }} onClick={() => setFpOtp('')}>Resend Code</u></strong>
            </p>
          </>
        )}

        {/* ── STEP 2.5 : Verifying / Verified ── */}
        {fpStep === 'verifying' && (
          <div className="fp-verify-center">
            {fpVerifyState === 'verifying' && (
              <>
                <div className="fp-spinner" />
                <p className="fp-verify-text">Verifying…</p>
              </>
            )}
            {fpVerifyState === 'verified' && (
              <>
                <div className="fp-verified-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <p className="fp-verify-text" style={{ color: '#22c55e' }}>Verified!</p>
              </>
            )}
          </div>
        )}

        {/* ── STEP 3 : Update Password (collapsed) ── */}
        {fpStep === 'update' && (
          <>
            <h2 className="fp-title">Update Password</h2>
            <p className="fp-sub">Enter your new password below</p>

            <label className="fp-label" style={{ marginTop: '20px' }}>New Password</label>
            <div className="fp-input-wrap">
              <Lock className="fp-input-icon" />
              <input
                className="fp-input"
                type={fpShowPw ? 'text' : 'password'}
                placeholder="Create a strong password"
                value={fpPassword}
                onChange={e => setFpPassword(e.target.value)}
                onFocus={() => setFpStep('update-criteria')}
              />
              <button type="button" className="fp-eye-btn" onClick={() => setFpShowPw(p => !p)}>
                {fpShowPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            <button className="fp-action-btn" disabled style={{ marginTop: '24px' }}>
              Update Password
            </button>
          </>
        )}

        {/* ── STEP 4+5 : Update Password with criteria & confirm ── */}
        {fpStep === 'update-criteria' && (
          <>
            <h2 className="fp-title">Update Password</h2>
            <p className="fp-sub">Enter your new password below</p>

            <label className="fp-label" style={{ marginTop: '20px' }}>New Password</label>
            <div className="fp-input-wrap">
              <Lock className="fp-input-icon" />
              <input
                className="fp-input"
                type={fpShowPw ? 'text' : 'password'}
                placeholder="Create a strong password"
                value={fpPassword}
                onChange={e => setFpPassword(e.target.value)}
                autoFocus
              />
              <button type="button" className="fp-eye-btn" onClick={() => setFpShowPw(p => !p)}>
                {fpShowPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            {/* Strength bar */}
            <div className="fp-strength-bar">
              <div className="fp-strength-fill" style={{ width: `${(fpCriteria.filter(c => c.ok).length / 5) * 100}%` }} />
            </div>

            {/* Criteria list */}
            <div className="fp-criteria-block">
              <p className="fp-criteria-title">Enter a password. Must contain:</p>
              {fpCriteria.map((c, i) => (
                <div key={i} className={`fp-criteria-row ${c.ok ? 'fp-criteria-ok' : ''}`}>
                  <span className="fp-criteria-icon">{c.ok ? '✓' : '✕'}</span>
                  <span>{c.label}</span>
                </div>
              ))}
            </div>

            {/* Confirm password — only appears when all criteria met */}
            {allMet && (
              <>
                <label className="fp-label" style={{ marginTop: '16px' }}>Confirm Password</label>
                <div className="fp-input-wrap">
                  <Lock className="fp-input-icon" />
                  <input
                    className="fp-input"
                    type={fpShowCf ? 'text' : 'password'}
                    placeholder="Re-enter your password"
                    value={fpConfirm}
                    onChange={e => setFpConfirm(e.target.value)}
                  />
                  <button type="button" className="fp-eye-btn" onClick={() => setFpShowCf(p => !p)}>
                    {fpShowCf ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </>
            )}

            <button
              className={`fp-action-btn ${passwordsMatch ? 'fp-btn-active' : ''}`}
              disabled={!passwordsMatch}
              style={{ marginTop: '20px' }}
              onClick={onBackToLogin}
            >
              Confirm Password
            </button>
          </>
        )}

      </div>
    </div>
  );
}
