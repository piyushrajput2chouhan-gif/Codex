"use client";

import * as React from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  type SpringOptions,
} from "motion/react";

import { cn } from "@/lib/utils";

export type SideBySideSlideProps = {
  /** Source URL for the "before" image (left / top). */
  beforeImage?: string;
  /** Source URL for the "after" image (right / bottom). */
  afterImage?: string;
  /** Alt text for the before image. */
  beforeAlt?: string;
  /** Alt text for the after image. */
  afterAlt?: string;
  /** Divider direction. */
  orientation?: "horizontal" | "vertical";
  /** Initial divider position as a percentage (0–100). */
  initialPosition?: number;
  /** CSS color of the divider line. */
  dividerColor?: string;
  /** Width (or height for vertical) of the divider in px. */
  dividerWidth?: number;
  /** Box-shadow applied to the divider. */
  dividerShadow?: string;
  /** Whether to show the circular handle on the divider. */
  showHandle?: boolean;
  /** Diameter of the handle circle in px. */
  handleSize?: number;
  /** Background color of the handle. */
  handleColor?: string;
  /** Cursor style when hovering over the component. */
  cursor?: "none" | "col-resize" | "row-resize" | "pointer";
  /** Spring configuration for the divider animation. */
  springOptions?: SpringOptions;
  /** Optional: render any React content (for example a live scroll scene) instead of the before image. */
  beforeNode?: React.ReactNode;
  /** Optional: render any React content instead of the after image. Give the root a height (className) when using nodes. */
  afterNode?: React.ReactNode;
  /** Extra CSS classes on the root container. */
  className?: string;
  /** Mouse: follow the pointer while hovering, like the original. Touch always drags. Default true. */
  followHover?: boolean;
  /** On release, snap the divider to 0 or 100 (whichever is nearer). Default false. */
  snap?: boolean;
  /** Called after a snap with the side now fully showing: "before" (position 100) or "after" (position 0). */
  onSnap?: (side: "before" | "after") => void;
  /** Called with the divider position (0-100) while it moves. */
  onPositionChange?: (percent: number) => void;
  /** Controlled endpoint, used by scene tabs. */
  controlledPosition?: number;
};

export function SideBySideSlide({
  beforeImage,
  afterImage,
  beforeNode,
  afterNode,
  beforeAlt = "Before",
  afterAlt = "After",
  orientation = "horizontal",
  initialPosition = 50,
  dividerColor = "white",
  dividerWidth = 2,
  dividerShadow = "0 0 8px rgba(0,0,0,0.3)",
  showHandle = true,
  handleSize = 40,
  handleColor = "white",
  cursor = "none",
  springOptions = { stiffness: 300, damping: 30 },
  className,
  followHover = true,
  snap = false,
  onSnap,
  onPositionChange,
  controlledPosition,
}: SideBySideSlideProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const isHorizontal = orientation === "horizontal";

  const raw = useMotionValue(initialPosition);
  const position = useSpring(raw, springOptions);
  const reduced = useReducedMotion();
  const displayedPosition = reduced ? raw : position;
  const [announced, setAnnounced] = React.useState(initialPosition);
  const origin = React.useRef<{ x: number; y: number; value: number; vertical: boolean } | null>(null);
  const suppressClick = React.useRef(false);

  React.useEffect(() => {
    if (controlledPosition === undefined) return;
    raw.set(controlledPosition);
    setAnnounced(controlledPosition);
  }, [controlledPosition, raw]);

  const clipPath = useTransform(displayedPosition, (v) =>
    isHorizontal ? `inset(0 ${100 - v}% 0 0)` : `inset(0 0 ${100 - v}% 0)`,
  );

  const dividerPos = useTransform(displayedPosition, (v) => `clamp(28px, ${v}%, calc(100% - 28px))`);

  const dragging = React.useRef(false);

  React.useEffect(() => {
    if (!onPositionChange) return;
    return displayedPosition.on("change", (v) => onPositionChange(v));
  }, [displayedPosition, onPositionChange]);

  const setFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const pct = isHorizontal
      ? ((e.clientX - rect.left) / rect.width) * 100
      : ((e.clientY - rect.top) / rect.height) * 100;
    raw.set(Math.max(0, Math.min(100, pct)));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    suppressClick.current = false;
    if (e.button !== 0 || !e.isPrimary) return;
    if ((e.target as HTMLElement).closest('a, button, input, select, textarea')) return;
    origin.current = { x: e.clientX, y: e.clientY, value: raw.get(), vertical: false };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = origin.current;
    if (!start) {
      if (followHover && e.pointerType === 'mouse') setFromEvent(e);
      return;
    }
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const primary = isHorizontal ? dx : dy;
    const cross = isHorizontal ? dy : dx;
    if (!dragging.current) {
      if (Math.abs(cross) > 12 && Math.abs(cross) > Math.abs(primary)) start.vertical = true;
      if (start.vertical || Math.abs(primary) < 12 || Math.abs(primary) < Math.abs(cross) * 1.2) return;
      dragging.current = true;
      ref.current?.setPointerCapture(e.pointerId);
      suppressClick.current = true;
    }
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const value = Math.max(0, Math.min(100, start.value + primary / (isHorizontal ? rect.width : rect.height) * 100));
    raw.set(value);
    setAnnounced(value);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    origin.current = null;
    if (!dragging.current) return;
    dragging.current = false;
    if (ref.current?.hasPointerCapture(e.pointerId)) ref.current.releasePointerCapture(e.pointerId);
    if (snap) {
      const side = raw.get() > 50 ? "before" : "after";
      raw.set(side === "before" ? 100 : 0);
      setAnnounced(side === "before" ? 100 : 0);
      onSnap?.(side);
    }
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) origin.current = null;
    if (e.pointerType !== "mouse" || dragging.current || snap || !followHover) return;
    raw.set(initialPosition);
  };

  return (
    <div
      ref={ref}
      className={cn("relative select-none overflow-hidden", className)}
      style={{ cursor, touchAction: isHorizontal ? "pan-y" : "pan-x" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={handlePointerLeave}
      onClickCapture={(e) => { if (suppressClick.current) { e.preventDefault(); e.stopPropagation(); suppressClick.current = false; } }}
    >
      {/* After image (bottom layer — in flow to give the container intrinsic height) */}
      {afterNode !== undefined ? (
        <div className="h-full w-full">{afterNode}</div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={afterImage}
          alt={afterAlt}
          draggable={false}
          className="block h-full w-full object-cover"
        />
      )}

      {/* Before image (clipped top layer) */}
      <motion.div className="absolute inset-0" style={{ clipPath }}>
        {beforeNode !== undefined ? (
          <div className="h-full w-full">{beforeNode}</div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={beforeImage}
            alt={beforeAlt}
            draggable={false}
            className="block h-full w-full object-cover"
          />
        )}
      </motion.div>

      {/* Divider line */}
      <motion.div
        className="absolute"
        style={
          isHorizontal
            ? {
                left: dividerPos,
                top: 0,
                bottom: 0,
                width: dividerWidth,
                x: "-50%",
                backgroundColor: dividerColor,
                boxShadow: dividerShadow,
              }
            : {
                top: dividerPos,
                left: 0,
                right: 0,
                height: dividerWidth,
                y: "-50%",
                backgroundColor: dividerColor,
                boxShadow: dividerShadow,
              }
        }
      >
        {/* Handle */}
        {showHandle && (
          <div
            className="scene-handle absolute rounded-full flex items-center justify-center"
            role="slider"
            tabIndex={0}
            aria-label="Switch between Cars and Cafés"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={announced}
            aria-valuetext={announced === 100 ? 'Cars' : announced === 0 ? 'Cafés' : `${Math.round(announced)}% Cars, ${Math.round(100 - announced)}% Cafés`}
            aria-orientation={orientation}
            onKeyDown={(e) => {
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
              e.preventDefault();
              const value = ['ArrowLeft', 'ArrowDown', 'Home'].includes(e.key) ? 0 : 100;
              raw.set(value);
              setAnnounced(value);
              onSnap?.(value === 100 ? 'before' : 'after');
            }}
            style={
              isHorizontal
                ? {
                    width: handleSize,
                    height: handleSize,
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    backgroundColor: handleColor,
                    boxShadow: dividerShadow,
                  }
                : {
                    width: handleSize,
                    height: handleSize,
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    backgroundColor: handleColor,
                    boxShadow: dividerShadow,
                  }
            }
          >
            <span aria-hidden="true">↔</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default SideBySideSlide;
