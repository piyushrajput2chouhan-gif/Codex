export type Frame = { src: string; width: number; height: number };
export type FrameManifest = Record<'cars' | 'cafe', { frames: Frame[]; count: number }>;

/** Breadth-first sampling makes long sequences usable before every image arrives. */
export function coarseOrder(count: number) {
  if (!count) return [];
  const order = [0];
  if (count > 1) order.push(count - 1);
  const ranges: [number, number][] = [[0, count - 1]];
  for (let cursor = 0; cursor < ranges.length; cursor++) {
    const [a, b] = ranges[cursor];
    if (b - a < 2) continue;
    const middle = Math.floor((a + b) / 2);
    order.push(middle);
    ranges.push([a, middle], [middle, b]);
  }
  return order;
}

export class FrameStore {
  private decoded = new Map<number, ImageBitmap>();
  private pending = new Set<number>();
  private failed = new Set<number>();
  private listeners = new Set<() => void>();
  private abort = new AbortController();
  private desired = 0;
  private disposed = false;
  readonly capacity: number;

  constructor(readonly frames: Frame[]) {
    const mobile = matchMedia('(max-width: 768px)').matches;
    const maxPixels = Math.max(1, ...frames.map(f => f.width * f.height));
    // Both scenes together retain at most ~48 MiB of decoded pixels on phones.
    this.capacity = Math.max(1, Math.min(mobile ? 8 : 24, Math.floor((mobile ? 24 : 96) * 1024 * 1024 / (maxPixels * 4))));
  }
  subscribe(callback: () => void) { this.listeners.add(callback); return () => { this.listeners.delete(callback); }; }
  get(index: number) {
    this.desired = index;
    if (!this.decoded.has(index)) void this.load(index);
    let closest: [number, ImageBitmap] | undefined;
    for (const entry of this.decoded) if (!closest || Math.abs(entry[0] - index) < Math.abs(closest[0] - index)) closest = entry;
    return closest?.[1];
  }
  private async load(index: number) {
    if (!this.frames[index] || this.disposed || this.failed.has(index) || this.pending.has(index) || this.decoded.has(index)) return;
    // Bounded decode concurrency; the newest scroll target is queued after these finish.
    if (this.pending.size >= 2) return;
    this.pending.add(index);
    try {
      const response = await fetch(this.frames[index].src, { signal: this.abort.signal, cache: 'force-cache' });
      if (!response.ok) throw new Error('Frame unavailable');
      const bitmap = await createImageBitmap(await response.blob());
      if (this.disposed) { bitmap.close(); return; }
      this.decoded.set(index, bitmap);
      while (this.decoded.size > this.capacity) {
        const farthest = [...this.decoded.keys()].sort((a, b) => Math.abs(b - this.desired) - Math.abs(a - this.desired))[0];
        this.decoded.get(farthest)?.close();
        this.decoded.delete(farthest);
      }
      this.listeners.forEach(callback => callback());
    } catch { if (!this.disposed) this.failed.add(index); }
    finally {
      this.pending.delete(index);
      if (!this.disposed && this.desired !== index) void this.load(this.desired);
    }
  }
  async prime() {
    await this.load(0);
  }
  async warm() {
    // Cache compressed files through the browser HTTP cache; never decode the entire sequence.
    for (const index of coarseOrder(this.frames.length)) {
      if (this.disposed) return;
      try {
        const response = await fetch(this.frames[index].src, { signal: this.abort.signal, cache: 'force-cache' });
        if (response.ok) await response.arrayBuffer();
      } catch { if (this.disposed) return; }
    }
  }
  dispose() {
    this.disposed = true;
    this.abort.abort();
    this.decoded.forEach(bitmap => bitmap.close());
    this.decoded.clear();
    this.listeners.clear();
  }
}
