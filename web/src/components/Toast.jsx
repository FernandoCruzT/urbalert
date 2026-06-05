import { useState, useEffect } from 'react';

const DURATION = 2500;

export default function Toast({ message, visible }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!visible || !message) return;
    setShown(true);
    const t = setTimeout(() => setShown(false), DURATION);
    return () => clearTimeout(t);
  }, [message, visible]);

  return (
    <div style={{
      position:      'fixed',
      top:           20,
      right:         20,
      background:    'rgba(22, 22, 26, 0.93)',
      color:         '#fff',
      padding:       '0.5rem 1rem',
      borderRadius:  8,
      fontSize:      '0.82rem',
      fontFamily:    'inherit',
      fontWeight:    500,
      boxShadow:     '0 4px 18px rgba(0,0,0,0.28)',
      zIndex:        9999,
      pointerEvents: 'none',
      userSelect:    'none',
      transition:    'opacity 0.22s ease, transform 0.22s ease',
      opacity:       shown ? 1 : 0,
      transform:     shown ? 'translateY(0)' : 'translateY(-10px)',
    }}>
      {message}
    </div>
  );
}
