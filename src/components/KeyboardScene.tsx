import { useEffect, useRef, useState } from 'react';
import type { KeyboardInput } from '../input/KeyboardInput';
import { Studio } from '../keyboard/Studio';
import type { KeyboardPreset } from '../keyboard/presets';

interface KeyboardSceneProps {
  input: KeyboardInput;
  reducedMotion: boolean;
  onVirtualKey: (code: string) => void;
  preset: KeyboardPreset;
}

export default function KeyboardScene({input, reducedMotion, onVirtualKey, preset}: KeyboardSceneProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const studio = useRef<Studio | null>(null);
  const virtualKey = useRef(onVirtualKey);
  const [unavailable, setUnavailable] = useState(false);
  virtualKey.current = onVirtualKey;

  useEffect(() => {
    if (!canvas.current || unavailable) return;
    try {
      studio.current = new Studio(canvas.current, input, code => virtualKey.current(code), () => setUnavailable(true));
      studio.current.setReducedMotion(reducedMotion);
      studio.current.setPreset(preset, true);
    } catch (error) {
      console.warn('The 3D keyboard could not start.', error);
      setUnavailable(true);
    }
    return () => {
      studio.current?.dispose();
      studio.current = null;
    };
    // Motion preference updates the existing scene in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, unavailable]);

  useEffect(() => studio.current?.setReducedMotion(reducedMotion), [reducedMotion]);
  useEffect(() => studio.current?.setPreset(preset), [preset]);

  return (
    <div className={`keyboard-scene${unavailable ? ' keyboard-scene--unavailable' : ''}`}>
      {unavailable ? (
        <div className="scene-fallback" role="status">
          <span className="scene-fallback-mark" aria-hidden="true">⌨</span>
          <p>A little more room for your thoughts.</p>
          <span>3D rendering is unavailable. You can still type above.</span>
        </div>
      ) : (
        <canvas ref={canvas} aria-label="Interactive 75 percent ANSI keyboard. Type on your keyboard or tap the 3D keys." role="img" />
      )}
    </div>
  );
}
