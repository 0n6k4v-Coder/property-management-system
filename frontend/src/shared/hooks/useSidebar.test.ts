// File: src/shared/hooks/useSidebar.test.ts
// Unit tests for useSidebar hook — reducer actions, localStorage persistence,
// media query behavior, and callback stability.

import { renderHook, act } from '@testing-library/react';
import { useSidebar } from './useSidebar';

describe('useSidebar', () => {
  const originalLocalStorage = window.localStorage;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    // Fresh localStorage mock per test
    const store: Record<string, string> = {};
    const mockLocalStorage = {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach((k) => delete store[k]);
      }),
    };
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });

    // Default matchMedia: desktop (no mobile/tablet matches)
    window.matchMedia = vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    window.localStorage = originalLocalStorage;
    window.matchMedia = originalMatchMedia;
  });

  describe('initial state', () => {
    it('defaults expanded to true when localStorage has no value', () => {
      const { result } = renderHook(() => useSidebar());
      expect(result.current.expanded).toBe(true);
    });

    it('defaults mobileOpen to false', () => {
      const { result } = renderHook(() => useSidebar());
      expect(result.current.mobileOpen).toBe(false);
    });

    it('reads persisted expanded=false from localStorage', () => {
      window.localStorage.setItem('pms-sidebar-expanded', 'false');
      const { result } = renderHook(() => useSidebar());
      expect(result.current.expanded).toBe(false);
    });

    it('reads persisted expanded=true from localStorage', () => {
      window.localStorage.setItem('pms-sidebar-expanded', 'true');
      const { result } = renderHook(() => useSidebar());
      expect(result.current.expanded).toBe(true);
    });

    it('defaults to collapsed on tablet viewport (768–1023px)', () => {
      window.matchMedia = vi.fn((query: string) => ({
        matches: query.includes('768px') && query.includes('1023px'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      window.localStorage.setItem('pms-sidebar-expanded', 'true');
      const { result } = renderHook(() => useSidebar());
      // Tablet overrides persisted to collapsed
      expect(result.current.expanded).toBe(false);
    });
  });

  describe('desktop actions (toggle, setExpanded)', () => {
    it('toggle flips expanded on desktop viewport', () => {
      // Desktop: max-width: 767px does NOT match
      const { result } = renderHook(() => useSidebar());
      expect(result.current.expanded).toBe(true);

      act(() => result.current.toggle());
      expect(result.current.expanded).toBe(false);

      act(() => result.current.toggle());
      expect(result.current.expanded).toBe(true);
    });

    it('toggle toggles mobileOpen on mobile viewport (<768px)', () => {
      window.matchMedia = vi.fn((query: string) => ({
        matches: query.includes('767px'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      const { result } = renderHook(() => useSidebar());
      expect(result.current.mobileOpen).toBe(false);

      act(() => result.current.toggle());
      expect(result.current.mobileOpen).toBe(true);

      act(() => result.current.toggle());
      expect(result.current.mobileOpen).toBe(false);
    });

    it('setExpanded sets expanded explicitly to false', () => {
      const { result } = renderHook(() => useSidebar());
      act(() => result.current.setExpanded(false));
      expect(result.current.expanded).toBe(false);
    });

    it('setExpanded sets expanded explicitly to true', () => {
      window.localStorage.setItem('pms-sidebar-expanded', 'false');
      const { result } = renderHook(() => useSidebar());
      act(() => result.current.setExpanded(true));
      expect(result.current.expanded).toBe(true);
    });
  });

  describe('mobile actions (openMobile, closeMobile, toggleMobile)', () => {
    it('openMobile sets mobileOpen to true', () => {
      const { result } = renderHook(() => useSidebar());
      act(() => result.current.openMobile());
      expect(result.current.mobileOpen).toBe(true);
    });

    it('closeMobile sets mobileOpen to false', () => {
      const { result } = renderHook(() => useSidebar());
      act(() => result.current.openMobile());
      expect(result.current.mobileOpen).toBe(true);
      act(() => result.current.closeMobile());
      expect(result.current.mobileOpen).toBe(false);
    });

    it('toggleMobile flips mobileOpen', () => {
      const { result } = renderHook(() => useSidebar());
      act(() => result.current.toggleMobile());
      expect(result.current.mobileOpen).toBe(true);
      act(() => result.current.toggleMobile());
      expect(result.current.mobileOpen).toBe(false);
    });
  });

  describe('localStorage persistence', () => {
    it('persists expanded to localStorage on state change', () => {
      const { result } = renderHook(() => useSidebar());
      act(() => result.current.toggle());
      // expanded went from true → false
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'pms-sidebar-expanded',
        'false',
      );
    });

    it('does not persist mobileOpen to localStorage', () => {
      const { result } = renderHook(() => useSidebar());
      act(() => result.current.openMobile());
      // Only expanded (true) should be persisted, not mobileOpen
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'pms-sidebar-expanded',
        'true',
      );
    });
  });

  describe('media query listener', () => {
    it('registers a change listener for desktop breakpoint and tablet breakpoint', () => {
      const addEventListenerSpy = vi.fn();
      window.matchMedia = vi.fn(() => ({
        matches: false,
        media: '(min-width: 1024px)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: addEventListenerSpy,
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      renderHook(() => useSidebar());
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      );
      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
    });

    it('closes mobile drawer when viewport grows to desktop', () => {
      const changeHandlers: Record<string, Array<(e: MediaQueryListEvent) => void>> = {};
      window.matchMedia = vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
          if (event === 'change') {
            if (!changeHandlers[query]) changeHandlers[query] = [];
            changeHandlers[query].push(handler);
          }
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useSidebar());
      act(() => result.current.openMobile());
      expect(result.current.mobileOpen).toBe(true);

      // Simulate the media query change event firing with matches=true
      act(() => {
        changeHandlers['(min-width: 1024px)']?.forEach((h) =>
          h({ matches: true } as MediaQueryListEvent),
        );
      });
      expect(result.current.mobileOpen).toBe(false);
    });

    it('reactively updates isTabletOverlay when viewport crosses tablet breakpoint', () => {
      const changeHandlers: Record<string, Array<(e: MediaQueryListEvent) => void>> = {};
      window.matchMedia = vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
          if (event === 'change') {
            if (!changeHandlers[query]) changeHandlers[query] = [];
            changeHandlers[query].push(handler);
          }
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useSidebar());
      expect(result.current.isTabletOverlay).toBe(false);

      // Transition: Desktop → Tablet (768px - 1023px matches true)
      act(() => {
        changeHandlers['(min-width: 768px) and (max-width: 1023px)']?.forEach((h) =>
          h({ matches: true } as MediaQueryListEvent),
        );
      });
      expect(result.current.isTabletOverlay).toBe(true);

      // Transition: Tablet → Desktop (768px - 1023px matches false)
      act(() => {
        changeHandlers['(min-width: 768px) and (max-width: 1023px)']?.forEach((h) =>
          h({ matches: false } as MediaQueryListEvent),
        );
      });
      expect(result.current.isTabletOverlay).toBe(false);
    });

    it('unsubscribes listeners on unmount without leaking', () => {
      const removeEventListenerSpy = vi.fn();
      window.matchMedia = vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: removeEventListenerSpy,
        dispatchEvent: vi.fn(),
      }));

      const { unmount } = renderHook(() => useSidebar());
      unmount();
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      );
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('return value', () => {
    it('returns all expected functions', () => {
      const { result } = renderHook(() => useSidebar());
      expect(typeof result.current.toggle).toBe('function');
      expect(typeof result.current.setExpanded).toBe('function');
      expect(typeof result.current.openMobile).toBe('function');
      expect(typeof result.current.closeMobile).toBe('function');
      expect(typeof result.current.toggleMobile).toBe('function');
    });

    it('returns expanded, mobileOpen, and isTabletOverlay as boolean state', () => {
      const { result } = renderHook(() => useSidebar());
      expect(typeof result.current.expanded).toBe('boolean');
      expect(typeof result.current.mobileOpen).toBe('boolean');
      expect(typeof result.current.isTabletOverlay).toBe('boolean');
    });
  });
});
