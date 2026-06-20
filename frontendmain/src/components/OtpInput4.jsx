import { useRef } from 'react';

/**
 * OtpInput4 — 4-digit OTP input used in the Create Account signup flow.
 * Each digit is an individual input box with auto-advance and backspace handling.
 */
export default function OtpInput4({ value, onChange }) {
  const inputs = useRef([]);
  const digits = value.split('');

  const handleKey = (e, idx) => {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        const next = [...digits]; next[idx] = ''; onChange(next.join(''));
      } else if (idx > 0) {
        inputs.current[idx - 1]?.focus();
      }
    }
  };

  const handleChange = (e, idx) => {
    const val = e.target.value.replace(/\D/g, '').slice(-1);
    const next = [...digits]; next[idx] = val; onChange(next.join(''));
    if (val && idx < 3) inputs.current[idx + 1]?.focus();
  };

  return (
    <div className="ca-otp-boxes">
      {Array.from({ length: 4 }).map((_, i) => (
        <input
          key={i}
          ref={el => inputs.current[i] = el}
          className="ca-otp-box"
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] || ''}
          onChange={e => handleChange(e, i)}
          onKeyDown={e => handleKey(e, i)}
        />
      ))}
    </div>
  );
}
