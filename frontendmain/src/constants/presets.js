// Predefined color and animation presets for the DataGridHero background
const PRESETS = [
  {
    name: 'Emerald Green',
    rows: 18, cols: 32, spacing: 6, duration: 4,
    color: '#10b981', animationType: 'wave',
    pulseEffect: true, mouseGlow: true,
    opacityMin: 0.05, opacityMax: 0.35,
    background: '#090d16',
  },
  {
    name: 'Cyberpunk Rose',
    rows: 16, cols: 28, spacing: 8, duration: 3,
    color: '#f43f5e', animationType: 'random',
    pulseEffect: true, mouseGlow: true,
    opacityMin: 0.08, opacityMax: 0.45,
    background: '#0c0a0f',
  },
  {
    name: 'Amethyst Violet',
    rows: 20, cols: 30, spacing: 4, duration: 5,
    color: '#a855f7', animationType: 'pulse',
    pulseEffect: true, mouseGlow: true,
    opacityMin: 0.06, opacityMax: 0.3,
    background: '#0d0b14',
  },
];

export default PRESETS;
