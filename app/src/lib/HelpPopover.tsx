/**
 * HelpPopover — click-to-open help panel triggered by a "?" icon. (B11-5)
 *
 * Replaces `title=` browser tooltips, which have a long browser-controlled
 * hover delay. The popover opens immediately on click, uses our own
 * styling (matches the dashboard's matte-black/orange theme), and is
 * keyboard-accessible (Esc to close, focusable trigger).
 *
 * Usage:
 *   <HelpPopover label="RISK">
 *     The 1–5 scale measures volatility…
 *   </HelpPopover>
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  /** ARIA label for the trigger button. Defaults to "Help". */
  label?: string;
  /** Optional title shown bold at the top of the panel. */
  title?: string;
  /** Panel body content — text or arbitrary JSX (lists, definitions, etc.). */
  children: ReactNode;
  /** Override anchor placement. Default: 'bottom-end'. */
  placement?: 'bottom-end' | 'bottom-start' | 'top-end' | 'top-start';
}

export function HelpPopover({
  label = 'Help',
  title,
  children,
  placement = 'bottom-end',
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  // Close on outside click + Esc.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span
      ref={wrapRef}
      className={'help-popover-wrap ' + ('help-pos-' + placement)}
    >
      <button
        type="button"
        className="help-popover-btn"
        aria-label={label}
        aria-expanded={open}
        title={open ? '' : `Show ${label}`}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      >
        ?
      </button>
      {open && (
        <div className="help-popover-panel" role="dialog">
          {title && <div className="help-popover-title">{title}</div>}
          <div className="help-popover-body">{children}</div>
        </div>
      )}
    </span>
  );
}
