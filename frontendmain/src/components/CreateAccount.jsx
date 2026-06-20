import { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Lock } from 'lucide-react';
import { getCriteria, isValidEmail } from '../utils/passwordCriteria';
import OtpInput4 from './OtpInput4';

/* ─── Main CreateAccount Component ─────────────────────── */
export default function CreateAccount({ onClose, onSuccess }) {
  // 'form' | 'otp'
  const [caStep, setCaStep] = useState('form');

  // Form fields
  const [firstName, setFirstName]     = useState('');
  const [lastName, setLastName]       = useState('');
  const [username, setUsername]       = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirmPw, setConfirmPw]     = useState('');
  const [showPw, setShowPw]           = useState(false);
  const [showCf, setShowCf]           = useState(false);
  const [agreeTerms, setAgreeTerms]   = useState(false);
  const [pwFocused, setPwFocused]     = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  // OTP state
  const [otpValue, setOtpValue]   = useState('');
  const [countdown, setCountdown] = useState(60);

  // Password criteria
  const criteria    = getCriteria(password);
  const allMet      = criteria.every(c => c.ok);
  const showCriteria   = pwFocused || password.length > 0;
  const showConfirmField = allMet;
  const pwsMatch    = allMet && confirmPw === password && confirmPw.length > 0;

  const canSignUp   = firstName && lastName && username &&
                      isValidEmail(email) && otpVerified &&
                      pwsMatch && agreeTerms;

  // Countdown timer while OTP overlay is open
  useEffect(() => {
    if (caStep !== 'otp') return;
    setCountdown(60);
    const id = setInterval(() => {
      setCountdown(prev => { if (prev <= 1) { clearInterval(id); return 0; } return prev - 1; });
    }, 1000);
    return () => clearInterval(id);
  }, [caStep]);

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const handleVerifyOtp = () => {
    setOtpVerified(true);
    setCaStep('form');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="login-modal ca-modal" onClick={e => e.stopPropagation()}>

        {/* Close */}
        <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
          <X />
        </button>

        <h2 className="ca-title">Create an account</h2>
        <p className="ca-sub">Welcome! Create an account to get started.</p>

        {/* First name + Last name */}
        <div className="ca-row">
          <div className="ca-field-group">
            <label className="ca-label">First name</label>
            <input className="ca-input" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} />
          </div>
          <div className="ca-field-group">
            <label className="ca-label">Last name</label>
            <input className="ca-input" type="text" value={lastName} onChange={e => setLastName(e.target.value)} />
          </div>
        </div>

        {/* Username */}
        <div className="ca-field-full">
          <label className="ca-label">Username</label>
          <input className="ca-input" type="text" value={username} onChange={e => setUsername(e.target.value)} />
        </div>

        {/* Email */}
        <div className="ca-field-full">
          <label className="ca-label">Email address</label>
          <input className="ca-input" type="email" value={email} onChange={e => { setEmail(e.target.value); setOtpVerified(false); }} />
        </div>

        {/* Verify OTP button — active when valid email and not yet verified */}
        <button
          className={`ca-verify-otp-btn ${isValidEmail(email) && !otpVerified ? 'ca-verify-active' : ''}`}
          disabled={!isValidEmail(email) || otpVerified}
          onClick={() => { setOtpValue(''); setCaStep('otp'); }}
        >
          {otpVerified ? '✓ Email Verified' : 'Verify OTP'}
        </button>

        {/* Password */}
        <div className="ca-field-full" style={{ marginTop: '12px' }}>
          <label className="ca-label">Input with password strength indicator</label>
          <div className="ca-pw-wrap">
            <input
              className="ca-input ca-pw-input"
              type={showPw ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onFocus={() => setPwFocused(true)}
            />
            <button type="button" className="ca-eye-btn" onClick={() => setShowPw(p => !p)}>
              {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>

          {/* Strength bar + criteria — appear once user starts typing */}
          {showCriteria && (
            <>
              <div className="ca-strength-bar">
                <div
                  className="ca-strength-fill"
                  style={{ width: `${(criteria.filter(c => c.ok).length / 5) * 100}%` }}
                />
              </div>
              {allMet && <p className="ca-strong-label">Strong password.</p>}
              <div className="ca-criteria-block">
                {criteria.map((c, i) => (
                  <div key={i} className={`ca-criteria-row ${c.ok ? 'ca-criteria-ok' : ''}`}>
                    <span className="ca-criteria-icon">{c.ok ? '✓' : '✕'}</span>
                    <span>{c.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Confirm Password — only after all criteria met */}
        {showConfirmField && (
          <div className="ca-field-full">
            <label className="ca-label">Confirm Password</label>
            <div className="ca-pw-wrap">
              <Lock className="ca-lock-icon" />
              <input
                className="ca-input ca-confirm-input"
                type={showCf ? 'text' : 'password'}
                placeholder="Confirm your password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
              />
              <button type="button" className="ca-eye-btn" onClick={() => setShowCf(p => !p)}>
                {showCf ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>
        )}

        {/* Terms */}
        <div className="ca-terms-row">
          <input
            type="checkbox"
            id="ca-terms"
            checked={agreeTerms}
            onChange={e => setAgreeTerms(e.target.checked)}
          />
          <label htmlFor="ca-terms">
            I agree to the <strong>Terms</strong> & <strong>Conditions</strong>
          </label>
        </div>

        {/* Sign Up button */}
        <button
          className={`ca-signup-btn ${canSignUp ? 'ca-signup-active' : ''}`}
          disabled={!canSignUp}
          onClick={onSuccess}
        >
          Sign Up
        </button>

        {/* ── OTP Overlay ── renders inside the modal, blurs the form behind */}
        {caStep === 'otp' && (
          <div className="ca-otp-overlay">
            <div className="ca-otp-card" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                className="modal-close-btn ca-otp-close"
                onClick={() => setCaStep('form')}
                aria-label="Close OTP"
              >
                <X />
              </button>

              <h2 className="ca-otp-title">OTP Verification</h2>
              <p className="ca-otp-sub">
                Enter the 4-digit code sent to <strong>{email}</strong>.
              </p>

              <p className="ca-otp-step">Step 1 of 1: Verify your account</p>

              <OtpInput4 value={otpValue} onChange={setOtpValue} />

              <p className="ca-otp-countdown">
                You can resend OTP in <strong>{fmt(countdown)}</strong>
              </p>

              <button
                className={`ca-otp-verify-btn ${otpValue.length === 4 ? 'ca-otp-verify-active' : ''}`}
                disabled={otpValue.length !== 4}
                onClick={handleVerifyOtp}
              >
                Verify OTP
              </button>

              <div className="ca-otp-resend-row">
                <span>Resend OTP</span>
                <span>{fmt(countdown)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
