export function getCriteria(pw) {
  return [
    { label: 'At least 8 characters',       ok: pw.length >= 8 },
    { label: 'At least 1 number',            ok: /\d/.test(pw) },
    { label: 'At least 1 lowercase letter',  ok: /[a-z]/.test(pw) },
    { label: 'At least 1 uppercase letter',  ok: /[A-Z]/.test(pw) },
    { label: 'At least 1 special character', ok: /[^A-Za-z0-9]/.test(pw) },
  ];
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
