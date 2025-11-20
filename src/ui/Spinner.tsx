import { useEffect, useState } from 'react';
import { Text } from 'ink';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const INTERVAL = 80;
const CYCLE = FRAMES.length * INTERVAL;

function getFrame() {
  return Math.floor((Date.now() % CYCLE) / INTERVAL);
}

export function Spinner() {
  const [frame, setFrame] = useState(getFrame);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => {
        const next = getFrame();
        return next !== prev ? next : prev;
      });
    }, INTERVAL);

    return () => clearInterval(timer);
  }, []);

  return <Text color="blueBright">{FRAMES[frame]}</Text>;
}
