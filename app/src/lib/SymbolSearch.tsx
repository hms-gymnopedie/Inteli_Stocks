// Global ⌘K / Ctrl+K symbol search modal. Mounted once at the App shell so
// the keyboard shortcut is always live. Pressing ⌘K (Cmd+K on macOS,
// Ctrl+K elsewhere) toggles the overlay; the input takes focus on open
// and Esc closes.
//
// On query change the input debounces 200 ms then calls getSearch(q). Up
// to MAX_RESULTS results are listed; Up/Down moves the highlight, Enter
// (or click) navigates to /detail/<symbol> and closes the modal.
//
// Step 4 will land the matching `/detail/:symbol?` route.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSearch } from '../data/market';
import type { SearchResult } from '../data/types';
import { useFocusTrap } from './useFocusTrap';

const DEBOUNCE_MS = 200;
const MAX_RESULTS = 8;

export function SymbolSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  // Trap Tab/Shift+Tab inside the dialog while open. Esc is handled below
  // (window listener + onInputKeyDown). Focus restore on close is automatic.
  useFocusTrap(dialogRef, open);

  // Global ⌘K / Ctrl+K toggle — always live (regardless of `open`) so the
  // shortcut works from any page. preventDefault stops the browser's
  // default behaviour (Firefox: address bar focus).
  useEffect(() => {
    const onShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  // Reset transient state whenever the modal closes — opening fresh next
  // time avoids stale highlights and stale results flashing in.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setActive(0);
      setLoading(false);
    }
  }, [open]);

  // Focus the input when the modal opens.
  useEffect(() => {
    if (open) {
      const id = window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(id);
    }
  }, [open]);

  // Debounced search. Empty query → no fetch, just clear. We track an
  // in-flight token so a slow earlier response can't clobber a faster
  // later one (race condition when typing quickly).
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        const rows = await getSearch(trimmed);
        if (cancelled) return;
        setResults(rows.slice(0, MAX_RESULTS));
        setActive(0);
      } catch {
        if (cancelled) return;
        setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query, open]);

  const close = () => setOpen(false);

  const navigateToSymbol = (symbol: string) => {
    navigate('/detail/' + encodeURIComponent(symbol));
    close();
  };

  // Key handling on the input itself: Esc + arrows + Enter. Esc on the
  // window is also wired (below) so the modal closes even if the input
  // somehow loses focus.
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length === 0) return;
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length === 0) return;
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = results[active];
      if (row) navigateToSymbol(row.symbol);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  // Backstop Esc listener (window-scoped) — covers the case where focus
  // somehow escaped the input. Only mounted while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Click outside the panel closes the overlay.
  const onOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) close();
  };

  if (!open) return null;

  const trimmed = query.trim();
  const showResults = trimmed.length > 0;

  return (
    <div
      ref={overlayRef}
      className="symsearch-overlay"
      onClick={onOverlayClick}
      role="presentation"
    >
      <div
        ref={dialogRef}
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            aria-label="Symbol search input"
            aria-autocomplete="list"
            aria-controls="symsearch-listbox"
            aria-activedescendant={
              showResults && results[active]
                ? `symsearch-row-${results[active].symbol}`
                : undefined
            }
          />
          <button
            type="button"
            className="symsearch-esc"
            onClick={close}
            aria-label="Close search"
          >
            Esc
          </button>
        </div>

        {showResults ? (
          loading && results.length === 0 ? (
            <div className="symsearch-loading">
              Searching<span className="symsearch-loading-dots" />
            </div>
          ) : results.length === 0 ? (
            <div className="symsearch-empty">No results for “{trimmed}”.</div>
          ) : (
            <ul
              id="symsearch-listbox"
              className="symsearch-results"
              role="listbox"
              aria-label="Search results"
            >
              {results.map((r, i) => (
                <li key={r.symbol} role="presentation">
                  <button
                    type="button"
                    id={`symsearch-row-${r.symbol}`}
                    className={
                      'symsearch-result' + (i === active ? ' is-active' : '')
                    }
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => navigateToSymbol(r.symbol)}
                  >
                    <span className="symsearch-result-symbol">{r.symbol}</span>
                    <span className="symsearch-result-name">{r.name}</span>
                    <span className="symsearch-result-exchange">
                      {r.exchange}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="symsearch-hint">
            Type a symbol or company name. <kbd>↑</kbd>/<kbd>↓</kbd> to
            navigate, <kbd>Enter</kbd> to open, <kbd>Esc</kbd> to close.
          </div>
        )}
      </div>
    </div>
  );
}
