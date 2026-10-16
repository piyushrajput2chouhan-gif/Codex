import { useEffect, useRef, useState } from 'react';
import { useReducedMotion, type MotionValue } from 'motion/react';
import { ArrowUpRight, MessageCircle } from 'lucide-react';
import { FrameStore } from '@/lib/frames';
import { waLink } from '@/data/apex-content';
import { publicAsset } from '@/lib/public-asset';

export type SceneCopy = {
  id: 'cars' | 'cafe'; label: string; headline: string; support: string; button: string; accent: string;
};

export function ScrollScene({ store, copy, progress, active }: {
  store?: FrameStore; copy: SceneCopy; progress: MotionValue<number>; active: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const [hasFrame, setHasFrame] = useState(false);
  const reduced = useReducedMotion();
  const current = useRef(0);
  const text = useRef<HTMLDivElement>(null);
  const beat = useRef<HTMLDivElement>(null);
  const [chapter, setChapter] = useState(0);

  useEffect(() => {
    if (!store?.frames.length || !box.current) return;
    const draw = () => {
      if (!canvas.current || !box.current) return;
      const target = reduced ? 0 : progress.get() * (store.frames.length - 1);
      // Preserve VELOUR's exact interpolation and settling threshold.
      if (activeRef.current) {
        current.current = reduced ? 0 : current.current + (target - current.current) * .14;
        if (Math.abs(target - current.current) < .03) current.current = target;
      }
      const index = Math.round(current.current);
      const p = current.current / Math.max(1, store.frames.length - 1);
      if (text.current) {
        const opacity = reduced ? 1 : Math.max(0, 1 - p * 6);
        text.current.style.opacity = String(opacity);
        text.current.style.transform = reduced ? 'none' : `translateY(${-p * 80}px)`;
        // Invisible buttons must not remain in the keyboard focus order.
        text.current.inert = !activeRef.current || opacity < .01;
      }
      if (beat.current) beat.current.style.opacity = String(!reduced && p > .24 ? Math.min(1, (p - .24) * 8) : 0);
      setChapter(p < .65 ? 0 : 1);
      canvas.current.dataset.frame = String(index);
      canvas.current.dataset.progress = String(progress.get());
      const bitmap = store.get(index);
      if (!bitmap) { if (activeRef.current && current.current !== target && !reduced) schedule(); return; }
      const { width, height } = box.current.getBoundingClientRect();
      const ratio = Math.min(devicePixelRatio || 1, 1.5);
      const output = canvas.current;
      const w = Math.round(width * ratio), h = Math.round(height * ratio);
      if (output.width !== w || output.height !== h) { output.width = w; output.height = h; }
      const context = output.getContext('2d');
      if (!context) return;
      // Cars retain their original contain fit; cafés use the requested cover fit.
      const scale = (copy.id === 'cars' ? Math.min : Math.max)(w / bitmap.width, h / bitmap.height);
      context.fillStyle = '#080705';
      context.fillRect(0, 0, w, h);
      context.drawImage(bitmap, (w - bitmap.width * scale) / 2, (h - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
      setHasFrame(true);
      if (activeRef.current && current.current !== target && !reduced) schedule();
    };
    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; draw(); });
    };
    const unsubscribe = progress.on('change', () => { if (activeRef.current) schedule(); });
    const unsubscribeStore = store.subscribe(() => { if (activeRef.current) schedule(); });
    const observer = new ResizeObserver(schedule);
    observer.observe(box.current);
    schedule();
    return () => { observer.disconnect(); unsubscribe(); unsubscribeStore(); cancelAnimationFrame(raf); };
  }, [store, progress, reduced, active, copy.id]);

  const pending = !store?.frames.length || !hasFrame;
  return (
    <section ref={box} className={`scroll-scene ${copy.id}`} aria-label={`${copy.label} scroll scene`} aria-hidden={!active} inert={!active} style={{ '--scene-accent': copy.accent } as React.CSSProperties}>
      {copy.id === 'cars' && pending && <img className="scene-poster" src={publicAsset('frames/cars/frame_0001.webp')} alt="Gold sports car in a dark studio" width="1280" height="720" fetchPriority="high" onError={e => { e.currentTarget.style.opacity = '0'; }} />}
      <canvas className="scene-canvas" ref={canvas} role="img" aria-label={copy.id === 'cars' ? 'Car frame sequence controlled by scrolling' : 'Coffee cup splash frame sequence controlled by scrolling'} style={{ opacity: hasFrame ? 1 : 0 }} />
      {copy.id === 'cafe' && pending && <div className="cafe-placeholder"><span className="placeholder-orbit" aria-hidden="true" /><span>Café animation coming</span><small>COFFEE FRAME SEQUENCE PENDING</small></div>}
      <div className="scene-shade" />
      <div className="hero-copy" ref={text}>
        <p className="eyebrow"><span className="live-dot" /> PHOTOGRAPHY & CINEMATIC FILMS</p>
        <h1 aria-label={copy.headline}>{copy.id === 'cars' ? <>Cars, shot<br />like they <em>mean it.</em></> : <>Cafés, shot<br />like you'd want<br /><em>to visit.</em></>}</h1>
        <p className="hero-support">{copy.support}</p>
        <div className="hero-actions"><a className="button button-accent" href="#book">{copy.button}<ArrowUpRight size={18} /></a><a className="button button-ghost" href={waLink()} target="_blank" rel="noreferrer"><MessageCircle size={16} />WhatsApp</a></div>
      </div>
      <div className="scene-beat" ref={beat} aria-hidden="true" style={{ opacity:0 }}><span>{chapter === 0 ? '02 / THE PERSPECTIVE' : '03 / THE PRESENCE'}</span><p>{copy.id === 'cars' ? (chapter === 0 ? 'Every angle. A new perspective.' : 'An unmistakable impression.') : (chapter === 0 ? 'Food. Drinks. A different perspective.' : 'The room, the light, the mood.')}</p></div>
      <div className="scene-caption"><span>{copy.id === 'cars' ? 'AUTOMOTIVE / APEX AUTO CAPTURES' : 'FOOD · DRINKS · INTERIORS'}</span><span>{pending ? (copy.id === 'cars' ? 'PREPARING THE EXPERIENCE' : 'CAFÉ ANIMATION COMING') : `${store?.frames.length} FRAMES / SCROLL TO PLAY`}</span></div>
    </section>
  );
}
