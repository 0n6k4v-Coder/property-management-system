// File: src/shared/hooks/useFocusTrap.ts
// Reusable focus trap hook for accessible modals/drawers.
// Encapsulates imperative DOM focus management to avoid eslint-disable.

import { useEffect, useRef, type RefObject } from 'react';

type FocusableElement =
  | HTMLAnchorElement
  | HTMLButtonElement
  | HTMLTextAreaElement
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLElement;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * useFocusTrap — restricts keyboard focus to elements within a container ref.
 * Activated when `active` is true. Restores focus to the previously focused
 * element on cleanup.
 *
 * @param active - Whether the focus trap is active
 * @returns A ref to attach to the container element
 */
export function useFocusTrap<T extends HTMLElement = HTMLDialogElement>(
  active: boolean
): RefObject<T | null> {
  const containerRef = useRef<T>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;

    // Store previously focused element
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    // Move focus into the container on activation
    const firstFocusable = container.querySelector<FocusableElement>(FOCUSABLE_SELECTOR);
    if (firstFocusable) firstFocusable.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusables = Array.from(
        container.querySelectorAll<FocusableElement>(FOCUSABLE_SELECTOR)
      );
      if (focusables.length === 0) return;

      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocusedRef.current) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [active]);

  return containerRef;
}