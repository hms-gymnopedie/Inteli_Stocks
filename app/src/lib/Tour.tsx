/**
 * Interactive guided tour overlay (B25).
 *
 * Walks the user through a list of steps; each step:
 *   1. (optional) navigates to a route via useNavigate
 *   2. waits for the target element (matched by `selector`) to mount
 *   3. scrolls it into view + measures its bounding rect
 *   4. dims the rest of the page via an SVG mask cutout
 *   5. shows a popover near the target with the title + body
 *
 * Next / Prev / Skip controls; Esc to close.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export interface TourStep {
  /** CSS selector for the target. Must resolve to a single element. */
  selector: string;
  title: string;
  body: ReactNode;
  /** When set + different from current path, the tour navigates here first. */
  route?: string;
  /** Manual placement hint. Auto picks the side with the most viewport space. */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
}

interface Props {
  steps: TourStep[];
  onClose: () => void;
}

const PADDING = 8;          // halo around the spotlight
const POPOVER_GAP = 14;
const POPOVER_W = 360;

export function Tour({ steps, onClose }: Props) {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [missing, setMissing] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const step = steps[idx];
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Find + measure target after route changes settle.
  useEffect(() => {
    setRect(null);
    setMissing(false);
    if (!step) return;

    const navIfNeeded = (): boolean => {
      if (step.route && location.pathname !== step.route) {
        navigate(step.route);
        return true;
      }
      return false;
    };
    const navigated = navIfNeeded();

    let cancelled = false;
    let attempts = 0;
    const tick = (): void => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(step.selector);
      attempts++;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Let the scroll settle before measuring.
        setTimeout(() => {
          if (cancelled) return;
          const r = el.getBoundingClientRect();
          setRect(r);
        }, 280);
      } else if (attempts < 30) {
        setTimeout(tick, 100);
      } else {
        setMissing(true);
      }
    };
    setTimeout(tick, navigated ? 240 : 60);
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, step?.selector, step?.route]);

  // Track viewport scroll/resize so the spotlight follows.
  useEffect(() => {
    if (!step) return;
    const update = (): void => {
      const el = document.querySelector<HTMLElement>(step.selector);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [step?.selector]);

  // Esc closes; arrow keys advance.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, onClose]);

  const goNext = useCallback(() => {
    if (idx >= steps.length - 1) onClose();
    else setIdx((n) => n + 1);
  }, [idx, steps.length, onClose]);

  const goPrev = useCallback(() => {
    setIdx((n) => Math.max(0, n - 1));
  }, []);

  const popoverPos = useMemo(() => computePopoverPos(rect, step?.placement ?? 'auto'), [rect, step?.placement]);

  if (!step) return null;
  const isFirst = idx === 0;
  const isLast  = idx === steps.length - 1;

  return (
    <div className="tour-root" role="dialog" aria-label="Guided tour">
      <SpotlightMask rect={rect} />
      {rect && (
        <div
          className="tour-spotlight-ring"
          style={{
            top:    rect.top - PADDING,
            left:   rect.left - PADDING,
            width:  rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
          }}
        />
      )}
      {rect && popoverPos && (
        <div
          ref={popoverRef}
          className="tour-popover"
          style={{
            top:  popoverPos.top,
            left: popoverPos.left,
            width: POPOVER_W,
          }}
          // Stop wheel events from scrolling the page while the popover is hovered.
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="tour-popover-h">
            <span className="tour-step-counter">
              {idx + 1} / {steps.length}
            </span>
            <button
              type="button"
              className="tour-skip"
              onClick={onClose}
              title="Close tour (Esc)"
            >
              ✕
            </button>
          </div>
          <div className="tour-title">{step.title}</div>
          <div className="tour-body">{step.body}</div>
          <div className="tour-actions">
            <button
              type="button"
              className="tour-btn tour-btn-ghost"
              onClick={onClose}
            >
              Skip tour
            </button>
            <div className="row gap-1">
              <button
                type="button"
                className="tour-btn tour-btn-ghost"
                onClick={goPrev}
                disabled={isFirst}
              >
                ← Prev
              </button>
              <button
                type="button"
                className="tour-btn tour-btn-primary"
                onClick={goNext}
              >
                {isLast ? 'Finish' : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      )}
      {!rect && missing && (
        <div className="tour-missing" role="alert">
          <p>Couldn't find <code>{step.selector}</code> on this page.</p>
          <p>This is usually fine for new dashboards — the section may not be
          rendered yet (e.g. AI panels need to be Generated first).</p>
          <div className="row gap-1" style={{ marginTop: 12 }}>
            <button type="button" className="tour-btn tour-btn-ghost" onClick={onClose}>
              Close
            </button>
            <button type="button" className="tour-btn tour-btn-primary" onClick={goNext}>
              Skip this step
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Spotlight mask (SVG) ────────────────────────────────────────────────────

function SpotlightMask({ rect }: { rect: DOMRect | null }) {
  // Always render the full backdrop; the cutout disappears (rect=0) until the
  // target is measured, so the user sees a brief full dim before the spotlight
  // materialises.
  const r = rect ?? { top: -100, left: -100, width: 0, height: 0 } as DOMRect;
  return (
    <svg className="tour-mask">
      <defs>
        <mask id="tour-cutout">
          <rect width="100%" height="100%" fill="white" />
          <rect
            x={r.left - PADDING}
            y={r.top - PADDING}
            width={r.width + PADDING * 2}
            height={r.height + PADDING * 2}
            rx={6}
            fill="black"
          />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.72)"
        mask="url(#tour-cutout)"
      />
    </svg>
  );
}

// ─── Popover positioning ─────────────────────────────────────────────────────

interface Placement { top: number; left: number }

function computePopoverPos(
  rect: DOMRect | null,
  prefer: 'top' | 'bottom' | 'left' | 'right' | 'auto',
): Placement | null {
  if (!rect) return null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const POP_H_GUESS = 200;

  // Score each side by available space; pick the largest unless `prefer` set.
  const sides = {
    bottom: vh - rect.bottom,
    top:    rect.top,
    right:  vw - rect.right,
    left:   rect.left,
  };
  const placement = prefer !== 'auto'
    ? prefer
    : (Object.entries(sides).sort((a, b) => b[1] - a[1])[0][0] as 'top' | 'bottom' | 'left' | 'right');

  let top  = 0;
  let left = 0;
  switch (placement) {
    case 'bottom':
      top  = rect.bottom + POPOVER_GAP;
      left = clamp(rect.left + rect.width / 2 - POPOVER_W / 2, 12, vw - POPOVER_W - 12);
      break;
    case 'top':
      top  = rect.top - POPOVER_GAP - POP_H_GUESS;
      left = clamp(rect.left + rect.width / 2 - POPOVER_W / 2, 12, vw - POPOVER_W - 12);
      break;
    case 'right':
      left = rect.right + POPOVER_GAP;
      top  = clamp(rect.top + rect.height / 2 - POP_H_GUESS / 2, 12, vh - POP_H_GUESS - 12);
      break;
    case 'left':
      left = rect.left - POPOVER_GAP - POPOVER_W;
      top  = clamp(rect.top + rect.height / 2 - POP_H_GUESS / 2, 12, vh - POP_H_GUESS - 12);
      break;
  }
  // Final sanity clamp — keep the popover in the viewport.
  top  = clamp(top,  12, vh - 60);
  left = clamp(left, 12, vw - POPOVER_W - 12);
  return { top, left };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
