import { useState, useEffect } from 'react'
import './App.css'
import PRESETS from './constants/presets'
import DataGridHero from './components/DataGridHero'
import LoginModal from './components/LoginModal'
import ForgotPassword from './components/ForgotPassword'
import CanvasPage from './components/CanvasPage'
import Typewriter from './components/Typewriter'
import IntroSequence from './components/IntroSequence'

const FAQ_QUESTIONS = [
  "How does MUNSHI invoicing software help small businesses?",
  "Is MUNSHI billing software free?",
  "Can I create e-invoices using MUNSHI?",
  "How to create a GST invoice in MUNSHI?",
  "Is my data safe with MUNSHI?"
];

const INTEGRATIONS = [
  "QuickBooks", "Xero", "FreshBooks", "Wave Accounting",
  "Sage Accounting", "Busy Accounting Software", "Marg ERP",
  "Vyapar", "ProfitBooks", "Kashoo"
];
const MARQUEE_ITEMS_1 = [...INTEGRATIONS, ...INTEGRATIONS];
const MARQUEE_ITEMS_2 = [...INTEGRATIONS].reverse();
const MARQUEE_ITEMS_2_DUP = [...MARQUEE_ITEMS_2, ...MARQUEE_ITEMS_2];

function App() {
  const [presetIndex, setPresetIndex] = useState(0)
  const [showControls, setShowControls] = useState(false)
  const [started, setStarted] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [showCanvasPage, setShowCanvasPage] = useState(false)
  const [canvasView] = useState('vertical')
  const [dashboardMode, setDashboardMode] = useState('client')
  const [showIntro, setShowIntro] = useState(true)

  // DataGridHero states — initialized from first preset
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

  // Toggle control panel with 'H' key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'h' || e.key === 'H') setShowControls(prev => !prev)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Track mouse ratio for hero title stretch animation
  useEffect(() => {
    const handleMouseMove = (e) => {
      const ratio = e.clientX / window.innerWidth
      document.documentElement.style.setProperty('--mouse-ratio', ratio.toFixed(3))
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const applyPreset = (index) => {
    const p = PRESETS[index]
    setPresetIndex(index)
    setRows(p.rows); setCols(p.cols); setSpacing(p.spacing); setDuration(p.duration)
    setColor(p.color); setAnimationType(p.animationType)
    setPulseEffect(p.pulseEffect); setMouseGlow(p.mouseGlow)
    setOpacityMin(p.opacityMin); setOpacityMax(p.opacityMax)
    setBackground(p.background)
  }

  const handlePrevPreset = () => applyPreset(presetIndex === 0 ? PRESETS.length - 1 : presetIndex - 1)
  const handleNextPreset = () => applyPreset(presetIndex === PRESETS.length - 1 ? 0 : presetIndex + 1)

  return (
    <>
      {showIntro && <IntroSequence onComplete={() => setShowIntro(false)} />}
      <div style={{ '--glow-color': color }} className={started ? 'started-mode' : 'hero-mode'}>
        <DataGridHero
        rows={rows} cols={cols} spacing={spacing} duration={duration}
        color={color} animationType={animationType}
        pulseEffect={pulseEffect} mouseGlow={mouseGlow}
        opacityMin={opacityMin} opacityMax={opacityMax}
        background={background}
      >
        {showIntro ? null : !started ? (
          <div className="landing-scroll-container" style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="hero-section" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <h1 className="hero-title">
                <span>M</span><span>U</span><span>N</span>
                <span>S</span><span>H</span><span>I</span>
              </h1>
              <button
                type="button"
                className="get-started-btn"
                onClick={() => setStarted(true)}
              >
                Let's get started! &rarr;
              </button>
              <div className="hero-subtitle-pop">
                <Typewriter 
                  text="The CA in Your Pocket That Does Not Exist" 
                  speed={50} 
                  delay={2300} 
                />
              </div>
            </div>

            <div className="integration-banners">
              <div className="marquee-track-container left-to-right">
                <div className="marquee-track">
                  {MARQUEE_ITEMS_1.map((name, idx) => (
                    <div className="marquee-item" key={idx}>{name}</div>
                  ))}
                </div>
              </div>
              <div className="marquee-track-container right-to-left">
                <div className="marquee-track">
                  {MARQUEE_ITEMS_2_DUP.map((name, idx) => (
                    <div className="marquee-item" key={idx}>{name}</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="faq-page-container" style={{ position: 'relative', inset: 'auto', minHeight: '100vh', padding: '60px', display: 'flex', flexDirection: 'column' }}>
              <h1 className="faq-page-heading">
                <span className="faq-text">FAQ</span>
                <span className="faq-punctuation">?!</span>
              </h1>
              <div className="faq-list">
                {FAQ_QUESTIONS.map((question, idx) => (
                  <div className="faq-item" key={idx}>
                    <span className="faq-question">{question}</span>
                    <button className="faq-plus-btn">+</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="modes-container">
            <div className="user-mode-wrapper">
              <div
                className="mode-card user-mode"
                onClick={() => { setDashboardMode('client'); setShowLoginModal(true); }}
              >
                <h2 className="mode-title">Vendor</h2>
              </div>
            </div>

            <div className="admin-mode-wrapper">
              <div
                className="mode-card admin-mode"
                onClick={() => { setDashboardMode('admin'); setShowLoginModal(true); }}
              >
                <h2 className="mode-title">CA Firms</h2>
              </div>
            </div>
          </div>
        )}
      </DataGridHero>

      {/* Slider Navigation Arrows */}
      {!started && (
        <>
          <button type="button" className="nav-arrow left" onClick={handlePrevPreset} aria-label="Previous preset">
            &lt;
          </button>
          <button type="button" className="nav-arrow right" onClick={handleNextPreset} aria-label="Next preset">
            &gt;
          </button>
        </>
      )}

      {/* Toggleable Control Panel Drawer */}
      {!started && (
        <section className={`controls-container ${showControls ? '' : 'hidden'}`}>
          <div className="controls-header">
            <h3>Grid Configurator <span>(Preset: {PRESETS[presetIndex].name})</span></h3>
            <button type="button" className="controls-close-btn" onClick={() => setShowControls(false)}>
              Hide (H)
            </button>
          </div>

          <div className="control-group">
            <label>Rows <span>{rows}</span></label>
            <input type="range" min="4" max="30" value={rows} onChange={e => setRows(Number(e.target.value))} />
          </div>
          <div className="control-group">
            <label>Columns <span>{cols}</span></label>
            <input type="range" min="4" max="40" value={cols} onChange={e => setCols(Number(e.target.value))} />
          </div>
          <div className="control-group">
            <label>Spacing <span>{spacing}px</span></label>
            <input type="range" min="0" max="20" value={spacing} onChange={e => setSpacing(Number(e.target.value))} />
          </div>
          <div className="control-group">
            <label>Duration <span>{duration}s</span></label>
            <input type="range" min="1" max="10" step="0.5" value={duration} onChange={e => setDuration(Number(e.target.value))} />
          </div>
          <div className="control-group">
            <label>Min Opacity <span>{opacityMin}</span></label>
            <input type="range" min="0" max="0.5" step="0.05" value={opacityMin} onChange={e => setOpacityMin(Number(e.target.value))} />
          </div>
          <div className="control-group">
            <label>Max Opacity <span>{opacityMax}</span></label>
            <input type="range" min="0.5" max="1" step="0.05" value={opacityMax} onChange={e => setOpacityMax(Number(e.target.value))} />
          </div>
          <div className="control-group">
            <label>Cell Color</label>
            <input type="color" value={color.startsWith('#') ? color : '#10b981'} onChange={e => setColor(e.target.value)} />
          </div>
          <div className="control-group">
            <label>Background</label>
            <input type="color" value={background.startsWith('#') ? background : '#090d16'} onChange={e => setBackground(e.target.value)} />
          </div>
          <div className="control-group">
            <label>Animation Type</label>
            <select value={animationType} onChange={e => setAnimationType(e.target.value)}>
              <option value="pulse">Pulse (Center outward)</option>
              <option value="wave">Wave (Diagonal)</option>
              <option value="random">Random</option>
            </select>
          </div>
          <div className="control-group-row">
            <input type="checkbox" id="pulseEffect" checked={pulseEffect} onChange={e => setPulseEffect(e.target.checked)} />
            <label htmlFor="pulseEffect">Pulse Effect</label>
          </div>
          <div className="control-group-row">
            <input type="checkbox" id="mouseGlow" checked={mouseGlow} onChange={e => setMouseGlow(e.target.checked)} />
            <label htmlFor="mouseGlow">Mouse Glow</label>
          </div>
        </section>
      )}

      {/* Login Modal */}
      {showLoginModal && !showCanvasPage && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onSuccess={() => { setShowLoginModal(false); setShowCanvasPage(true); }}
          onForgotPassword={() => { setShowLoginModal(false); setShowForgotPassword(true); }}
        />
      )}

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <ForgotPassword
          onClose={() => setShowForgotPassword(false)}
          onBackToLogin={() => { setShowForgotPassword(false); setShowLoginModal(true); }}
        />
      )}

      {/* Full-Screen Canvas / Dashboard Page */}
      {showCanvasPage && (
        <CanvasPage canvasView={canvasView} mode={dashboardMode} />
      )}
    </div>
    </>
  )
}

export default App
