import { useState, useEffect } from 'react'
import { Mail, Lock, Eye, X, ChevronLeft, ChevronRight } from 'lucide-react'
import './App.css'
import DataGridHero from './components/DataGridHero'
import VerticalBarsNoise from './components/ui/vertical-bars'
import HorizontalFlowBars from './components/ui/horizontal-bars'
import Dashboard from './components/ui/Dashboard'

// Beautiful predefined color and animation presets
const PRESETS = [
  {
    name: "Emerald Green",
    rows: 18,
    cols: 32,
    spacing: 6,
    duration: 4,
    color: "#10b981",
    animationType: "wave",
    pulseEffect: true,
    mouseGlow: true,
    opacityMin: 0.05,
    opacityMax: 0.35,
    background: "#090d16"
  },
  {
    name: "Cyberpunk Rose",
    rows: 16,
    cols: 28,
    spacing: 8,
    duration: 3,
    color: "#f43f5e",
    animationType: "random",
    pulseEffect: true,
    mouseGlow: true,
    opacityMin: 0.08,
    opacityMax: 0.45,
    background: "#0c0a0f"
  },
  {
    name: "Amethyst Violet",
    rows: 20,
    cols: 30,
    spacing: 4,
    duration: 5,
    color: "#a855f7",
    animationType: "pulse",
    pulseEffect: true,
    mouseGlow: true,
    opacityMin: 0.06,
    opacityMax: 0.3,
    background: "#0d0b14"
  }
]

function Typewriter({ text, speed = 40 }) {
  const [displayedText, setDisplayedText] = useState('');
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    let i = 0;
    setDisplayedText('');
    setIsDone(false);
    
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayedText(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(timer);
        setIsDone(true);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <span className="typewriter-text">
      {displayedText}
      {!isDone && <span className="typewriter-cursor">|</span>}
    </span>
  );
}

function App() {
  const [presetIndex, setPresetIndex] = useState(0)
  const [showControls, setShowControls] = useState(false)
  const [started, setStarted] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showWelcomeCard, setShowWelcomeCard] = useState(false)
  const [showCanvasPage, setShowCanvasPage] = useState(false)
  const [canvasView, setCanvasView] = useState('vertical')

  // DataGridHero States (initialized with first preset)
  const [rows, setRows] = useState(PRESETS[0].rows)
  const [cols, setCols] = useState(PRESETS[0].cols)
  const [spacing, setSpacing] = useState(PRESETS[0].spacing)
  const [duration, setDuration] = useState(PRESETS[0].duration)
  const [color, setColor] = useState(PRESETS[0].color)
  const [animationType, setAnimationType] = useState(PRESETS[0].animationType)
  const [pulseEffect, setPulseEffect] = useState(PRESETS[0].pulseEffect)
  const [mouseGlow, setMouseGlow] = useState(PRESETS[0].mouseGlow)
  const [opacityMin, setOpacityMin] = useState(PRESETS[0].opacityMin)
  const [opacityMax, setOpacityMax] = useState(PRESETS[0].opacityMax)
  const [background, setBackground] = useState(PRESETS[0].background)

  // Listen for the 'H' key to toggle the control panel
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'h' || e.key === 'H') {
        setShowControls((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Track mouse horizontal position ratio for high-performance title stretch animation
  useEffect(() => {
    const handleMouseMove = (e) => {
      const ratio = e.clientX / window.innerWidth
      document.documentElement.style.setProperty('--mouse-ratio', ratio.toFixed(3))
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // Apply a selected preset's values to the states
  const applyPreset = (index) => {
    const preset = PRESETS[index]
    setPresetIndex(index)
    setRows(preset.rows)
    setCols(preset.cols)
    setSpacing(preset.spacing)
    setDuration(preset.duration)
    setColor(preset.color)
    setAnimationType(preset.animationType)
    setPulseEffect(preset.pulseEffect)
    setMouseGlow(preset.mouseGlow)
    setOpacityMin(preset.opacityMin)
    setOpacityMax(preset.opacityMax)
    setBackground(preset.background)
  }

  const handlePrevPreset = () => {
    const newIndex = presetIndex === 0 ? PRESETS.length - 1 : presetIndex - 1
    applyPreset(newIndex)
  }

  const handleNextPreset = () => {
    const newIndex = presetIndex === PRESETS.length - 1 ? 0 : presetIndex + 1
    applyPreset(newIndex)
  }

  return (
    <div style={{ '--glow-color': color }} className={started ? "started-mode" : "hero-mode"}>
      <DataGridHero
        rows={rows}
        cols={cols}
        spacing={spacing}
        duration={duration}
        color={color}
        animationType={animationType}
        pulseEffect={pulseEffect}
        mouseGlow={mouseGlow}
        opacityMin={opacityMin}
        opacityMax={opacityMax}
        background={background}
      >
        {!started ? (
          <>
            <h1 className="hero-title">
              <span>M</span>
              <span>U</span>
              <span>N</span>
              <span>S</span>
              <span>H</span>
              <span>I</span>
            </h1>
            <button 
              type="button" 
              className="get-started-btn"
              onClick={() => setStarted(true)}
            >
              Let's get started! &rarr;
            </button>
          </>
        ) : (
          <div className="modes-container">
            <div className="user-mode-wrapper">
              <div className="mode-card user-mode" onClick={() => setShowLoginModal(true)}>
                <h2 className="mode-title">User Mode</h2>
              </div>
            </div>

            <div className="admin-mode-wrapper">
              <div className="mode-card admin-mode" onClick={() => alert("Entering Office...")}>
                <h2 className="mode-title">Admin Mode</h2>
              </div>
            </div>
          </div>
        )}
      </DataGridHero>

      {/* Slider Navigation Arrows */}
      {!started && (
        <>
          <button 
            type="button" 
            className="nav-arrow left" 
            onClick={handlePrevPreset}
            aria-label="Previous preset"
          >
            &lt;
          </button>
          <button 
            type="button" 
            className="nav-arrow right" 
            onClick={handleNextPreset}
            aria-label="Next preset"
          >
            &gt;
          </button>
        </>
      )}

      {/* Toggleable Control Panel Drawer */}
      {!started && (
        <section className={`controls-container ${showControls ? '' : 'hidden'}`}>
          <div className="controls-header">
            <h3>Grid Configurator <span>(Preset: {PRESETS[presetIndex].name})</span></h3>
            <button 
              type="button" 
              className="controls-close-btn" 
              onClick={() => setShowControls(false)}
            >
              Hide (H)
            </button>
          </div>

          <div className="control-group">
            <label>Rows <span>{rows}</span></label>
            <input
              type="range"
              min="4"
              max="30"
              value={rows}
              onChange={(e) => setRows(Number(e.target.value))}
            />
          </div>

          <div className="control-group">
            <label>Columns <span>{cols}</span></label>
            <input
              type="range"
              min="4"
              max="40"
              value={cols}
              onChange={(e) => setCols(Number(e.target.value))}
            />
          </div>

          <div className="control-group">
            <label>Spacing <span>{spacing}px</span></label>
            <input
              type="range"
              min="0"
              max="20"
              value={spacing}
              onChange={(e) => setSpacing(Number(e.target.value))}
            />
          </div>

          <div className="control-group">
            <label>Duration <span>{duration}s</span></label>
            <input
              type="range"
              min="1"
              max="10"
              step="0.5"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </div>

          <div className="control-group">
            <label>Min Opacity <span>{opacityMin}</span></label>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.05"
              value={opacityMin}
              onChange={(e) => setOpacityMin(Number(e.target.value))}
            />
          </div>

          <div className="control-group">
            <label>Max Opacity <span>{opacityMax}</span></label>
            <input
              type="range"
              min="0.5"
              max="1"
              step="0.05"
              value={opacityMax}
              onChange={(e) => setOpacityMax(Number(e.target.value))}
            />
          </div>

          <div className="control-group">
            <label>Cell Color</label>
            <input
              type="color"
              value={color.startsWith('#') ? color : '#10b981'}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>

          <div className="control-group">
            <label>Background</label>
            <input
              type="color"
              value={background.startsWith('#') ? background : '#090d16'}
              onChange={(e) => setBackground(e.target.value)}
            />
          </div>

          <div className="control-group">
            <label>Animation Type</label>
            <select
              value={animationType}
              onChange={(e) => setAnimationType(e.target.value)}
            >
              <option value="pulse">Pulse (Center outward)</option>
              <option value="wave">Wave (Diagonal)</option>
              <option value="random">Random</option>
            </select>
          </div>

          <div className="control-group-row">
            <input
              type="checkbox"
              id="pulseEffect"
              checked={pulseEffect}
              onChange={(e) => setPulseEffect(e.target.checked)}
            />
            <label htmlFor="pulseEffect">Pulse Effect</label>
          </div>

          <div className="control-group-row">
            <input
              type="checkbox"
              id="mouseGlow"
              checked={mouseGlow}
              onChange={(e) => setMouseGlow(e.target.checked)}
            />
            <label htmlFor="mouseGlow">Mouse Glow</label>
          </div>
        </section>
      )}

      {/* Login Modal Overlay */}
      {showLoginModal && !showCanvasPage && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (showWelcomeCard) {
              setShowLoginModal(false);
              setShowWelcomeCard(false);
              setShowCanvasPage(true);
            } else {
              setShowLoginModal(false);
              setShowWelcomeCard(false);
            }
          }}
        >
          <div className={`login-modal ${showWelcomeCard ? 'welcome-zoom' : ''}`} onClick={(e) => e.stopPropagation()}>
            {!showWelcomeCard ? (
              <>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => { setShowLoginModal(false); setShowWelcomeCard(false); }}
                  aria-label="Close modal"
                >
                  <X />
                </button>

                <h2 className="modal-title-text">Log in to your account</h2>

                <form onSubmit={(e) => { e.preventDefault(); setShowWelcomeCard(true); }}>
                  <div className="input-group">
                    <Mail className="input-icon" />
                    <input type="email" placeholder="Email address" required />
                  </div>

                  <div className="input-group">
                    <Lock className="input-icon" />
                    <input type="password" placeholder="Password" required />
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
                    <a href="#" className="forgot-password" onClick={(e) => { e.preventDefault(); alert('Forgot password clicked'); }}>
                      Forgot password?
                    </a>
                  </div>

                  <button type="submit" className="login-btn">Log In</button>
                </form>

                <div className="modal-footer">
                  Don't have an account? <a href="#" onClick={(e) => { e.preventDefault(); alert('Create Account clicked'); }}>Create Account</a>
                </div>
              </>
            ) : (
              <div
                className="welcome-content"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}
                onClick={(e) => { e.stopPropagation(); setShowLoginModal(false); setShowWelcomeCard(false); setShowCanvasPage(true); }}
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
      )}

      {/* Full-Screen Canvas Page — canvas is background, dashboard is overlay */}
      {showCanvasPage && (
        <div className="canvas-page">
          {/* Translucent animated background */}
          <div className="canvas-bg-layer">
            {canvasView === 'vertical' ? (
              <VerticalBarsNoise
                backgroundColor="#0d0f1a"
                lineColor="#1e2233"
                barColor="#3b4a6b"
                lineWidth={1}
                animationSpeed={0.0004}
                removeWaveLine={true}
              />
            ) : (
              <HorizontalFlowBars
                backgroundColor="#0d0f1a"
                lineColor="#1e2233"
                barColor="#3b4a6b"
                lineWidth={1}
                animationSpeed={0.0004}
                removeWaveLine={true}
              />
            )}
          </div>

          {/* Dark translucent overlay to dim the canvas */}
          <div className="canvas-dim-overlay" />

          {/* Dashboard content */}
          <Dashboard />

          {/* View toggle arrows */}
          <button
            type="button"
            className="canvas-nav-btn canvas-nav-left"
            onClick={() => setCanvasView(canvasView === 'vertical' ? 'horizontal' : 'vertical')}
            aria-label="Previous view"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            className="canvas-nav-btn canvas-nav-right"
            onClick={() => setCanvasView(canvasView === 'vertical' ? 'horizontal' : 'vertical')}
            aria-label="Next view"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  )
}

export default App
