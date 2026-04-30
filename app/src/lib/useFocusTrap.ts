/**
 * useFocusTrap — keep keyboard focus inside a container while it is open.
 *
 * Used by modal-style overlays (SymbolSearch, TweaksPanel) so that Tab /
 * Shift+Tab cycle through focusable children without leaking out into the
 * page underneath. Esc handling is intentionally left to the caller — each
 * overlay has its own close semantics.
 *
 * Usage:
 *   const ref = useRef<HTMLDivElement>(null);
 *   useFocusTrap(ref, open);
 *   return open ? <div ref={ref} role="dialog">…</div> : null;
 *
 * Behaviour:
 *   - On activate: focus the first focusable inside the container if focus
 *     isn't already there. Remembers the previously-focused element.
 *   - On Tab at the last focusable: wrap to the first.
 *   - On Shift+Tab at the first focusable: wrap to the last.
 *   - On deactivate: restore focus to whatever had it before activation.
 */

import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'audio[controls]',
  'video[controls]',
  'iframe',
  '[contenteditable=""]',
  '[contenteditable="true"]',
].join(',');

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => {
    // Skip elements that are visually hidden — display:none / visibility:hidden
    // / disabled. `offsetParent === null` is a quick "is it laid out" check
    // (cheap proxy that excludes display:none and detached subtrees).
    if (el.hasAttribute('disabled')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    if (el.offsetParent === null && el.tagName !== 'BODY') return false;
    return true;
  });
}

export function useFocusTrap(
  ref: RefObject<HTMLElement>,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    // Remember whoever had focus before so we can restore on deactivate.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // If focus isn't already inside the container, move it there. We don't
    // overwrite focus when the caller has already set it (e.g. SymbolSearch
    // focuses its input on open).
    if (!container.contains(document.activeElement)) {
      const focusables = getFocusable(container);
      focusables[0]?.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = getFocusable(container);
      if (focusables.length === 0) {
        // Nothing focusable inside — keep focus on the container itself.
        e.preventDefault();
        container.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        // Shift+Tab on first → wrap to last.
        if (activeEl === first || !container.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab on last → wrap to first.
        if (activeEl === last || !container.contains(activeEl)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // Restore focus to whatever had it before, if it's still in the DOM
      // and focusable. Wrap in a microtask so React's own focus side-effects
      // don't fight us during unmount.
      if (
        previouslyFocused &&
        document.body.contains(previouslyFocused) &&
        typeof previouslyFocused.focus === 'function'
      ) {
        previouslyFocused.focus();
      }
    };
  }, [active, ref]);
}
