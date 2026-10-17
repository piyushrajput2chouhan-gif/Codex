import { assetURL } from './asset-url.js';

// 192 supplied 1280×720 WebP frames. Scroll events schedule a single paint;
// there is no continuous animation loop or interception of wheel/touch input.
const FRAME_COUNT = 192;
const MAX_REQUESTS = 3;
const MAX_DECODED = 10;

function progressiveOrder(first, last) {
  if (first > last) return [];
  const queue = [[first, last]];
  const result = [first, last];
  while (queue.length) {
    const [start, end] = queue.shift();
    if (end - start < 2) continue;
    const mid = Math.floor((start + end) / 2);
    result.push(mid);
    queue.push([start, mid], [mid, end]);
  }
  return [...new Set(result)];
}

export class FrameSequence {
  constructor(section) {
    this.section = section;
    this.track = section.querySelector('.motion-track');
    this.canvas = section.querySelector('canvas');
    this.context = this.canvas.getContext('2d', { alpha: false });
    this.poster = section.querySelector('.sequence-poster');
    this.blobs = new Map();
    this.decoded = new Map();
    this.decoding = new Set();
    this.requests = new Map();
    this.failures = new Set();
    this.order = progressiveOrder(0, FRAME_COUNT - 1);
    this.desired = 0;
    this.visible = false;
    this.active = false;
    this.raf = 0;
    this.motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
    this.dataSaver = Boolean(navigator.connection?.saveData);
    this.poster.addEventListener('error', () => {
      if (!this.poster.src.endsWith('car-orange-front.webp')) {
        this.poster.src = assetURL('work/car-orange-front.webp');
        this.poster.alt = 'An orange Lamborghini photographed from above.';
      }
    });
    this.onScroll = () => {
      if (this.active && !this.raf) this.raf = requestAnimationFrame(() => {
        this.raf = 0;
        this.update();
      });
    };
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onScroll, { passive: true });
    document.addEventListener('visibilitychange', () => this.setActive());
    this.motionPreference.addEventListener('change', () => this.setActive());
    new IntersectionObserver(entries => {
      this.visible = entries[0].isIntersecting;
      this.setActive();
    }).observe(this.section);
    this.setActive();
  }

  setActive() {
    const still = this.motionPreference.matches || this.dataSaver || !this.context;
    this.section.classList.toggle('is-still', still);
    this.active = this.visible && !document.hidden && !still;
    this.section.dataset.animationState = still ? 'still' : this.active ? 'active' : 'paused';
    if (!this.active) {
      for (const controller of this.requests.values()) controller.abort();
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      return;
    }
    this.update();
  }

  update() {
    const rect = this.track.getBoundingClientRect();
    const distance = Math.max(1, rect.height - window.innerHeight);
    const progress = Math.max(0, Math.min(1, -rect.top / distance));
    this.desired = Math.round(progress * (FRAME_COUNT - 1));
    this.section.dataset.frame = String(this.desired + 1);
    this.decode(this.desired);
    this.paintNearest();
    this.pump();
  }

  priorities() {
    const local = [this.desired, this.desired + 1, this.desired - 1, this.desired + 2, this.desired - 2];
    return [...new Set([...local.filter(i => i >= 0 && i < FRAME_COUNT), ...this.order])];
  }

  pump() {
    if (!this.active) return;
    for (const index of this.priorities()) {
      if (this.requests.size >= MAX_REQUESTS) break;
      if (this.blobs.has(index) || this.requests.has(index) || this.failures.has(index)) continue;
      const controller = new AbortController();
      this.requests.set(index, controller);
      const file = `frame_${String(index + 1).padStart(4, '0')}.webp`;
      fetch(assetURL(`frames/cars/${file}`), { signal: controller.signal })
        .then(response => {
          if (!response.ok) throw new Error(`Frame ${index + 1}: HTTP ${response.status}`);
          return response.blob();
        })
        .then(blob => {
          this.blobs.set(index, blob);
          if (this.active && (Math.abs(index - this.desired) < 3 || this.decoded.size < 3)) this.decode(index);
        })
        .catch(error => { if (error.name !== 'AbortError') this.failures.add(index); })
        .finally(() => {
          this.requests.delete(index);
          this.section.dataset.framesLoaded = String(this.blobs.size);
          this.pump();
        });
    }
  }

  async decode(index) {
    if (!this.active || !this.blobs.has(index) || this.decoded.has(index) || this.decoding.has(index)) return;
    this.decoding.add(index);
    try {
      const bitmap = await createImageBitmap(this.blobs.get(index));
      if (!this.active) { bitmap.close(); return; }
      this.decoded.set(index, bitmap);
      // Keep compressed frames, but cap decoded memory (~37 MB at ten frames).
      if (this.decoded.size > MAX_DECODED) {
        const farthest = [...this.decoded.keys()].sort((a, b) => Math.abs(b - this.desired) - Math.abs(a - this.desired))[0];
        this.decoded.get(farthest).close();
        this.decoded.delete(farthest);
      }
      this.paintNearest();
    } catch {
      // The supplied still remains visible if a frame cannot be decoded.
    } finally {
      this.decoding.delete(index);
    }
  }

  paintNearest() {
    if (!this.active || !this.decoded.size) return;
    const nearest = [...this.decoded.keys()].sort((a, b) => Math.abs(a - this.desired) - Math.abs(b - this.desired))[0];
    this.context.drawImage(this.decoded.get(nearest), 0, 0, this.canvas.width, this.canvas.height);
    this.canvas.classList.add('has-frame');
    this.canvas.dataset.paintedFrame = String(nearest + 1);
  }
}
