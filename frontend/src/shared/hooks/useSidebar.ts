// File: src/shared/hooks/useSidebar.ts
// Sidebar state management hook — expanded (desktop, persisted) + mobileOpen (transient).
// SDD §SCR-APP-SHELL §5 — Responsive sidebar with localStorage persistence.

import { useCallback, useEffect, useReducer } from 'react';

// ── Constants ───────────────────────────────────────────────────────

const STORAGE_KEY = 'pms-sidebar-expanded';

// ── Types ───────────────────────────────────────────────────────────

interface SidebarState {
  /** Desktop expanded/collapsed (icon-only vs icon+label). */
  expanded: boolean;
  /** Mobile drawer open/closed (transient — never persisted). */
  mobileOpen: boolean;
  /** Whether the viewport is in tablet range (768–1023px). */
  isTabletOverlay: boolean;
}

interface SidebarActions {
  /** Flip expanded on desktop / mobileOpen on mobile. */
  toggle: () => void;
  /** Open the mobile drawer. */
  openMobile: () => void;
  /** Close the mobile drawer. */
  closeMobile: () => void;
  /** Flip mobile drawer state. */
  toggleMobile: () => void;
  /** Set desktop expanded explicitly. */
  setExpanded: (expanded: boolean) => void;
}

export type UseSidebarReturn = SidebarState & SidebarActions;

type SidebarAction =
  | { type: 'TOGGLE_DESKTOP' }
  | { type: 'SET_EXPANDED'; expanded: boolean }
  | { type: 'OPEN_MOBILE' }
  | { type: 'CLOSE_MOBILE' }
  | { type: 'TOGGLE_MOBILE' }
  | { type: 'SET_TABLET_OVERLAY'; isTabletOverlay: boolean };

// ── Initial State ───────────────────────────────────────────────────

function getInitialState(): SidebarState {
  // SSR / unavailable guard
  if (typeof window === 'undefined' || !window.localStorage) {
    return { expanded: true, mobileOpen: false, isTabletOverlay: false };
  }
  let persisted = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== null) persisted = raw !== 'false';
  } catch {
    // localStorage access may throw (private mode / quota); default expanded.
    persisted = true;
  }
  // Tablet (768–1023px) defaults to collapsed per spec §5.2.
  const isTablet = window.matchMedia(
    '(min-width: 768px) and (max-width: 1023px)',
  ).matches;
  if (isTablet) persisted = false;
  return { expanded: persisted, mobileOpen: false, isTabletOverlay: isTablet };
}

// ── Reducer ─────────────────────────────────────────────────────────

function sidebarReducer(
  state: SidebarState,
  action: SidebarAction,
): SidebarState {
  switch (action.type) {
    case 'TOGGLE_DESKTOP':
      return { ...state, expanded: !state.expanded };
    case 'SET_EXPANDED':
      return { ...state, expanded: action.expanded };
    case 'OPEN_MOBILE':
      return { ...state, mobileOpen: true };
    case 'CLOSE_MOBILE':
      return { ...state, mobileOpen: false };
    case 'TOGGLE_MOBILE':
      return { ...state, mobileOpen: !state.mobileOpen };
    case 'SET_TABLET_OVERLAY':
      return { ...state, isTabletOverlay: action.isTabletOverlay };
    default:
      return state;
  }
}

// ── Hook ────────────────────────────────────────────────────────────

/**
 * useSidebar — manages desktop expanded state (persisted to localStorage),
 * transient mobile drawer open state, and reactive tablet overlay state. Per SDD §5:
 * - Desktop (≥1024px): expanded persisted across sessions.
 * - Tablet (768–1023px): collapsed by default; expand is overlay, transient.
 * - Mobile (<768px): hidden; mobileOpen opens overlay drawer, transient.
 */
export function useSidebar(): UseSidebarReturn {
  const [state, dispatch] = useReducer(
    sidebarReducer,
    undefined,
    getInitialState,
  );

  // Persist desktop expanded state (localStorage). Mobile drawer is never persisted.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(state.expanded));
    } catch {
      // Ignore write failures (private mode, quota, disabled).
    }
  }, [state.expanded]);

  // Close mobile drawer when viewport grows to desktop (avoid stuck-open drawer).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) dispatch({ type: 'CLOSE_MOBILE' });
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Track tablet overlay viewport (768–1023px) reactively.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');
    const onChange = (e: MediaQueryListEvent) => {
      dispatch({ type: 'SET_TABLET_OVERLAY', isTabletOverlay: e.matches });
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => {
    const isMobile =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(max-width: 767px)').matches;
    if (isMobile) {
      dispatch({ type: 'TOGGLE_MOBILE' });
    } else {
      dispatch({ type: 'TOGGLE_DESKTOP' });
    }
  }, []);

  const setExpanded = useCallback((expanded: boolean) => {
    dispatch({ type: 'SET_EXPANDED', expanded });
  }, []);

  const openMobile = useCallback(() => dispatch({ type: 'OPEN_MOBILE' }), []);
  const closeMobile = useCallback(() => dispatch({ type: 'CLOSE_MOBILE' }), []);
  const toggleMobile = useCallback(
    () => dispatch({ type: 'TOGGLE_MOBILE' }),
    [],
  );

  return {
    expanded: state.expanded,
    mobileOpen: state.mobileOpen,
    isTabletOverlay: state.isTabletOverlay,
    toggle,
    setExpanded,
    openMobile,
    closeMobile,
    toggleMobile,
  };
}
