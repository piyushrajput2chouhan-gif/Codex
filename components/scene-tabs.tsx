import { motion, useReducedMotion } from 'motion/react';
import { useRef } from 'react';
import type { Scene } from '@/components/scene-hero';

export function SceneTabs({ value, onChange, id }: { value: Scene; onChange: (value: Scene) => void; id: string }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const reduced = useReducedMotion();
  return <div className="scene-tabs" role="tablist" aria-label={id === 'hero-scenes' ? 'Hero scenes' : 'Work categories'}>
    {(['cars', 'cafes'] as const).map((scene, index) => <button key={scene} id={`${id}-${scene}`} ref={el => { buttons.current[index] = el; }} type="button" role="tab" aria-selected={value === scene} aria-controls={id === 'hero-scenes' ? 'hero-panel' : 'work-panel'} tabIndex={value === scene ? 0 : -1} onClick={() => onChange(scene)} onKeyDown={e => {
      let next = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') next = 1 - index;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = 1;
      if (next < 0) return;
      e.preventDefault();
      onChange(next === 0 ? 'cars' : 'cafes');
      buttons.current[next]?.focus();
    }}>{value === scene && <motion.span layoutId={`${id}-indicator`} className="tab-indicator" transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 350, damping: 32 }} />}<span>{scene === 'cars' ? 'Cars' : 'Cafés'}</span><span className="tab-count">{index === 0 ? '01' : '02'}</span></button>)}
  </div>;
}
