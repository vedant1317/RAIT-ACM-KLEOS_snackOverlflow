import { useState, useEffect } from 'react';

export default function Typewriter({ text, speed = 40, delay = 0, onComplete }) {
  const [displayedText, setDisplayedText] = useState('');
  const [isDone, setIsDone] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    let i = 0;
    setDisplayedText('');
    setIsDone(false);
    setHasStarted(false);

    let timer;
    const startTimeout = setTimeout(() => {
      setHasStarted(true);
      timer = setInterval(() => {
        if (i < text.length) {
          setDisplayedText(text.slice(0, i + 1));
          i++;
        } else {
          clearInterval(timer);
          setIsDone(true);
          if (onComplete) onComplete();
        }
      }, speed);
    }, delay);

    return () => {
      clearTimeout(startTimeout);
      clearInterval(timer);
    };
  }, [text, speed, delay]);

  return (
    <span className="typewriter-text" style={{ opacity: hasStarted || delay === 0 ? 1 : 0 }}>
      {displayedText}
      {!isDone && <span className="typewriter-cursor">|</span>}
    </span>
  );
}
