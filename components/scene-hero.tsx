import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion } from 'motion/react';
import { ArrowDown, MoveHorizontal } from 'lucide-react';
import SideBySideSlide from '@/components/ui/side-by-side-slide';
import { ScrollScene, type SceneCopy } from '@/components/scroll-scene';
import { SceneTabs } from '@/components/scene-tabs';
import { FrameStore, type FrameManifest } from '@/lib/frames';
import { publicAsset } from '@/lib/public-asset';

export type Scene = 'cars' | 'cafes';
const copies: Record<Scene, SceneCopy> = {
  cars: { id: 'cars', label: 'Cars', headline: 'Cars, shot like they mean it.', support: 'Photography and cinematic films for cars. Scroll to run the film.', button: 'Book a car shoot', accent: '#c6ad7c' },
  cafes: { id: 'cafe', label: 'Cafés', headline: "Cafés, shot like you'd want to visit.", support: 'Food, drinks and interiors photographed to bring people through the door.', button: 'Book a café shoot', accent: '#d7a878' },
};

export function SceneHero({ active, onChange }: { active: Scene; onChange: (scene: Scene) => void }) {
  const region = useRef<HTMLDivElement>(null);
  const carProgress = useMotionValue(0), cafeProgress = useMotionValue(0);
  const physicalProgress = useMotionValue(0);
  const values = useRef({ cars: 0, cafes: 0 });
  const current = useRef(active);
  const previousScroll = useRef<number | null>(null);
  const [stores, setStores] = useState<{ cars: FrameStore; cafe: FrameStore }>();
  const [dragging, setDragging] = useState(false);
  const reduced = useReducedMotion();
  current.current = active;

  useEffect(() => {
    let disposed = false;
    let loaded: typeof stores;
    const abort = new AbortController();
    fetch(publicAsset('frames/manifest.json'), { signal: abort.signal }).then(response => {
      if (!response.ok) throw new Error('Manifest unavailable');
      return response.json() as Promise<FrameManifest>;
    }).then(async manifest => {
      if (disposed) return;
      const resolveFrames = (frames: FrameManifest['cars']['frames']) => frames.map(frame => ({ ...frame, src: publicAsset(frame.src) }));
      loaded = { cars: new FrameStore(resolveFrames(manifest.cars.frames)), cafe: new FrameStore(resolveFrames(manifest.cafe.frames)) };
      await loaded.cars.prime();
      if (disposed) return;
      setStores(loaded);
      await loaded.cafe.prime();
      if (disposed) return;
      if (!reduced) {
        await loaded.cars.warm();
        if (!disposed) await loaded.cafe.warm();
      }
    }).catch(() => { /* Labelled fallbacks remain readable if media cannot load. */ });
    return () => { disposed = true; abort.abort(); loaded?.cars.dispose(); loaded?.cafe.dispose(); };
  }, [reduced]);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      if (!region.current) return;
      const rect = region.current.getBoundingClientRect();
      const travel = Math.max(1, region.current.offsetHeight - window.innerHeight);
      const physical = Math.max(0, Math.min(travel, -rect.top));
      physicalProgress.set(physical / travel);
      if (previousScroll.current !== null && !dragging) {
        const scene = current.current;
        values.current[scene] = Math.max(0, Math.min(1, values.current[scene] + (physical - previousScroll.current) / travel));
        (scene === 'cars' ? carProgress : cafeProgress).set(values.current[scene]);
      }
      previousScroll.current = physical;
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => { window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); cancelAnimationFrame(raf); };
  }, [carProgress, cafeProgress, physicalProgress, dragging]);

  const finish = useCallback((side: 'before' | 'after') => {
    setDragging(false);
    onChange(side === 'before' ? 'cars' : 'cafes');
  }, [onChange]);
  const onPosition = useCallback((value: number) => { setDragging(value > 0.5 && value < 99.5); }, []);
  return (
    <div className="hero-region" ref={region} id="top">
      <div className="hero-pin">
        <div className="hero-topline"><span className="micro">A DIFFERENT KIND OF STILL.</span><SceneTabs value={active} onChange={onChange} id="hero-scenes" /><span className="micro hero-edition">CARS & CAFÉS</span></div>
        <SideBySideSlide className="hero-switch" initialPosition={100} controlledPosition={active === 'cars' ? 100 : 0} beforeNode={<ScrollScene store={stores?.cars} copy={copies.cars} progress={carProgress} active={active === 'cars'} />} afterNode={<ScrollScene store={stores?.cafe} copy={copies.cafes} progress={cafeProgress} active={active === 'cafes'} />} orientation="horizontal" snap followHover={false} cursor="col-resize" springOptions={{ stiffness: 260, damping: 30 }} dividerColor="rgba(232,236,220,.25)" dividerWidth={1} handleSize={52} handleColor={active === 'cars' ? '#c6ad7c' : '#d7a878'} onSnap={finish} onPositionChange={onPosition} />
        <div className="hero-bottom"><a href="#work" className="scroll-cue"><ArrowDown size={16} /><span>SCROLL TO EXPLORE</span></a><div className="swipe-hint"><MoveHorizontal size={18} /><span>{active === 'cars' ? 'Swipe for cafés' : 'Swipe for cars'}</span></div><div className="scene-dots" aria-label="Scene selection"><button aria-label="Show Cars scene" aria-pressed={active === 'cars'} onClick={() => onChange('cars')} /><button aria-label="Show Cafés scene" aria-pressed={active === 'cafes'} onClick={() => onChange('cafes')} /></div></div>
        <motion.div className="film-progress" style={{ scaleX: physicalProgress, originX: 0 }} />
        {!reduced && <span className="film-corner" aria-hidden="true">REC <span /></span>}
      </div>
    </div>
  );
}
