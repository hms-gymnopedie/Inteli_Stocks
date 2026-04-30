// Global ⌘K / Ctrl+K symbol search modal. Mounted once at the App shell so
// the keyboard shortcut is always live. Pressing the shortcut toggles the
// overlay; the input takes focus on open and Esc closes.
//
// Future steps in B4-RT will:
//  - debounce the query and call getSearch() (step 3)
//  - render the results list with up/down highlight + Enter to navigate (step 3)
//
// For now (skeleton — step 1) the modal shows the input + a placeholder hint
// so the visual + keyboard plumbing can be verified in isolation.

import { useEffect, useRef, useState } from 'react';

export function SymbolSearch() {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Esc to close. Listener is attached only while open so we don't leak a
  // global handler across the rest of the app's keyboard interactions.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Focus the input when the modal opens.
  useEffect(() => {
    if (open) {
      // Defer one frame so the element exists when we focus.
      const id = window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(id);
    }
  }, [open]);

  // Click outside the panel closes the overlay.
  const onOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="symsearch-overlay"
      onClick={onOverlayClick}
      role="presentation"
    >
      <div
        className="symsearch"
        role="dialog"
        aria-modal="true"
        aria-label="Symbol search"
      >
        <div className="symsearch-input-wrap">
          <span className="symsearch-prefix" aria-hidden>⌘K</span>
          <input
            ref={inputRef}
            type="text"
            className="symsearch-input"
            placeholder="Search a symbol or company…"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="symsearch-esc"
            onClick={() => setOpen(false)}
            aria-label="Close search"
          >
            Esc
          </button>
        </div>
        <div className="symsearch-hint">
          Press <kbd>Esc</kbd> to close.
        </div>
      </div>
    </div>
  );
}
