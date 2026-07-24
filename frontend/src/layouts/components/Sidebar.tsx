// File: src/layouts/components/Sidebar.tsx
// Collapsible application sidebar — 2 sections (MENU + USER), pill active highlight,
// toggle button, bottom user avatar, mobile drawer with backdrop + focus trap.
// SDD §SCR-APP-SHELL §2 (Sidebar) + §5 (Responsive Behavior).

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthContext';
import { useSidebar } from '@/shared/hooks/useSidebar';

// ── Types ───────────────────────────────────────────────────────────

interface NavItemDef {
  /** Route path for NavLink `to`. */
  to: string;
  /** Display label shown when expanded. */
  label: string;
  /** Inline SVG icon element (24×24 viewBox). */
  icon: ReactNode;
  /** `end` prop for NavLink — true for index/root routes only. */
  end?: boolean;
}

interface SidebarSectionDef {
  /** Section heading label (e.g. "MENU", "USER"). */
  heading: string;
  items: NavItemDef[];
}

interface SidebarProps {
  /** Optional className to merge onto the desktop sidebar <aside>. */
  className?: string;
  /** Override the default hook instance (e.g. from a context provider). */
  sidebarState?: ReturnType<typeof useSidebar>;
}

// ── Icons (inline SVG, no external library) ──────────────────────────
// All icons: 24×24 viewBox, stroke=currentColor, stroke-width 1.75,
// aria-hidden — decorative; labels come from nav link text.

const iconClass = 'size-5 shrink-0';

const DashboardIcon = () => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);

const PropertyIcon = () => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 10.5L12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M9 21v-6h6v6" />
  </svg>
);

const TenantIcon = () => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="8" r="3.25" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 6.5a2.75 2.75 0 0 1 0 5.5" />
    <path d="M17 14a5.5 5.5 0 0 1 3.5 5.5" />
  </svg>
);

const MeterIcon = () => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v2" />
    <path d="M5.5 6.5l1.4 1.4" />
    <path d="M3 13h2" />
    <path d="M19 13h2" />
    <path d="M17.1 7.9l1.4-1.4" />
    <circle cx="12" cy="14" r="5" />
    <path d="M12 14l2.5-2.5" />
  </svg>
);

const InvoiceIcon = () => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 3h9l3 3v15l-2-1.2L14 21l-2-1.2L10 21l-2-1.2L6 21z" />
    <path d="M9 8h6" />
    <path d="M9 12h6" />
    <path d="M9 16h3" />
  </svg>
);

const ContractIcon = () => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 3h7l4 4v14H7z" />
    <path d="M14 3v4h4" />
    <path d="M9.5 12l1.5 1.5L14 10.5" />
    <path d="M9.5 17l1.5 1.5L14 15.5" />
  </svg>
);

const MaintenanceIcon = () => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14.5 4.5a3.5 3.5 0 0 0-4.9 4.4L3.2 15.3a1.8 1.8 0 0 0 2.5 2.5l6.4-6.4a3.5 3.5 0 0 0 4.4-4.9l-2.1 2.1-2.1-.4-.4-2.1z" />
  </svg>
);

const ReportIcon = () => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 4v16h16" />
    <path d="M8 14v3" />
    <path d="M12 9v8" />
    <path d="M16 5v12" />
  </svg>
);

const SettingsIcon = () => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

// ── Nav Definitions ─────────────────────────────────────────────────

const NAV_SECTIONS: SidebarSectionDef[] = [
  {
    heading: 'MENU',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: <DashboardIcon />, end: true },
      { to: '/property', label: 'Properties', icon: <PropertyIcon /> },
      { to: '/tenants', label: 'Tenants', icon: <TenantIcon /> },
      { to: '/meter-reading', label: 'Meters', icon: <MeterIcon /> },
      { to: '/invoices', label: 'Invoices', icon: <InvoiceIcon /> },
      { to: '/contracts', label: 'Contracts', icon: <ContractIcon /> },
      { to: '/maintenance', label: 'Maintenance', icon: <MaintenanceIcon /> },
      { to: '/reports', label: 'Reports', icon: <ReportIcon /> },
    ],
  },
  {
    heading: 'USER',
    items: [
      { to: '/settings', label: 'Settings', icon: <SettingsIcon />, end: true },
    ],
  },
];

// ── Shared class strings ────────────────────────────────────────────

/** Width tokens: collapsed = 64px (w-16), expanded = 240px (w-60). */
const SIDEBAR_WIDTH_COLLAPSED = 'w-16';
const SIDEBAR_WIDTH_EXPANDED = 'w-60';

// ── Sub-components ──────────────────────────────────────────────────

/** Sidebar toggle button — arrow icon at top-left. Rotates with expanded. */
function SidebarToggle({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
      aria-expanded={expanded}
      className="flex size-9 items-center justify-center rounded-lg text-surface-500 transition-colors hover:bg-surface-100 hover:text-surface-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
    >
      <svg
        className={`size-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}

/**
 * NavItem — renders a single navigation link with pill-shaped active highlight.
 * When collapsed (icon-only), label is hidden visually but available via title attr.
 */
function NavItem({
  item,
  expanded,
  onNavigate,
}: {
  item: NavItemDef;
  expanded: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={item.label}
      onClick={onNavigate}
      className={({ isActive }: { isActive: boolean }) => {
        const base = expanded
          ? 'group flex items-center justify-start flex-1 w-full block rounded-xl px-2.5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500'
          : 'group flex items-center justify-center flex-1 w-full block rounded-xl px-0 py-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';
        const activeCls =
          'bg-primary-50 text-primary-700';
        const inactiveCls =
          'text-surface-600 hover:bg-surface-100 hover:text-surface-900';
        return `${base} ${isActive ? activeCls : inactiveCls}`;
      }}
    >
      {({ isActive }: { isActive: boolean }) => (
        <>
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isActive ? 'text-primary-600' : 'text-surface-500 group-hover:text-surface-700'}`}>
            {item.icon}
          </div>
          <span
            className={`truncate transition-all duration-150 ${
              expanded ? 'ml-3 opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden pointer-events-none'
            }`}
          >
            {item.label}
          </span>
        </>
      )}
    </NavLink>
  );
}

/** Section heading label — hidden when collapsed to preserve icon-only density. */
function SectionLabel({ label, expanded }: { label: string; expanded: boolean }) {
  return (
    <p
      className={`px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-surface-400 transition-opacity duration-150 ${
        expanded ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {label}
    </p>
  );
}

/** Bottom user avatar block — shows initials + full name when expanded. */
function UserAvatarBlock({ expanded }: { expanded: boolean }) {
  const { user } = useAuth();
  const fullName = user?.full_name ?? 'User';
  const initials = fullName
    .split(' ')
    .flatMap((s) => (s[0] ? [s[0]] : []))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="border-t border-surface-200 p-2">
      <div className="flex items-center gap-3 rounded-lg p-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
          {initials || 'U'}
        </span>
        <span
          className={`truncate text-sm font-medium text-surface-700 transition-opacity duration-150 ${
            expanded ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {fullName}
        </span>
      </div>
    </div>
  );
}

// ── Sidebar content (shared between desktop + mobile) ────────────────

interface SidebarContentProps {
  expanded: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}

function SidebarContent({ expanded, onToggle, onNavigate }: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col bg-white">
      {/* Toggle row */}
      <div className="flex h-14 items-center justify-center border-b border-surface-200">
        <SidebarToggle expanded={expanded} onToggle={onToggle} />
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto" aria-label="Main navigation">
        {NAV_SECTIONS.map((section) => (
          <div key={section.heading}>
            <SectionLabel label={section.heading} expanded={expanded} />
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavItem
                  key={item.to}
                  item={item}
                  expanded={expanded}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User avatar */}
      <UserAvatarBlock expanded={expanded} />
    </div>
  );
}

// ── Focus Trap ──────────────────────────────────────────────────────
// Trap Tab/Shift+Tab within the mobile drawer while open.

/**
 * useFocusTrap — restricts keyboard focus to elements within a container ref.
 * Activated when `active` is true. Restores focus to the previously focused
 * element on cleanup. Elements are discovered via querySelectorAll on focusable selectors.
 */
function useFocusTrap(active: boolean) {
  const containerRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    /* eslint-disable react-doctor/no-event-handler -- focus trap requires imperative DOM focus management */
    if (!active || !containerRef.current) return;
    const container = containerRef.current;

    const focusableSelector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Move focus into the container on activation.
    const firstFocusable = container.querySelector<HTMLElement>(focusableSelector);
    if (firstFocusable) firstFocusable.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelector),
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
      if (previouslyFocused) previouslyFocused.focus();
    };
  }, [active]);

  return containerRef;
}

// ── Mobile Drawer (overlay) ─────────────────────────────────────────

function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const drawerRef = useFocusTrap(open);
  const drawerLabelId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Close on Escape key — native <dialog> fires 'cancel' event on Escape.
  useEffect(() => {
    if (!open) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onCloseRef.current();
    };
    const dialog = drawerRef.current;
    dialog?.addEventListener('cancel', onCancel);
    return () => dialog?.removeEventListener('cancel', onCancel);
  }, [open]); // eslint-disable-line react-doctor/exhaustive-deps -- drawerRef is a stable ref

  // Prevent body scroll while drawer open.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Swipe-to-close (left swipe).
  const touchStartX = useRef(0);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? 0;
  }, []);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const endX = e.changedTouches[0]?.clientX ?? 0;
    if (touchStartX.current - endX > 60) onCloseRef.current();
  }, []);

  // Show/hide via the native <dialog> API.
  useEffect(() => {
    /* eslint-disable react-doctor/no-pass-data-to-parent, react-doctor/no-event-handler -- native dialog showModal/close is imperative */
    const dialog = drawerRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, drawerRef]);

  const handleClose = useCallback(() => onCloseRef.current(), []);

  return (
    <dialog
      ref={drawerRef}
      aria-labelledby={drawerLabelId}
      className="m-0 h-full w-60 max-h-full max-w-full animate-[slide-in-left_200ms_ease-out] border-0 bg-transparent p-0 shadow-xl md:hidden backdrop:bg-black/50"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClose={handleClose}
    >
      <span id={drawerLabelId} className="sr-only">
        Navigation menu
      </span>
      <SidebarContent expanded onToggle={handleClose} onNavigate={handleClose} />
    </dialog>
  );
}

// ── Main Sidebar Component ───────────────────────────────────────────

/**
 * Sidebar — the collapsible application sidebar.
 *
 * Desktop (≥1024px): fixed left sidebar, icon-only (collapsed, ~64px) or
 * icon+label (expanded, ~240px). State persisted via useSidebar → localStorage.
 *
 * Tablet (768–1023px): collapsed icon-only by default; expanding opens as
 * overlay drawer with backdrop (does not push content).
 *
 * Mobile (<768px): hidden; use `openMobile`/`toggleMobile` from useSidebar
 * to open as an overlay drawer with backdrop + focus trap.
 *
 * @example
 * ```tsx
 * const sidebar = useSidebar();
 * <Sidebar sidebarState={sidebar} />
 * ```
 */
export function Sidebar({ className = '', sidebarState }: SidebarProps) {
  const localSidebar = useSidebar();
  const {
    expanded,
    mobileOpen,
    toggle,
    closeMobile,
  } = sidebarState ?? localSidebar;

  const widthClass = expanded ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED;

  // On tablet, "expanded" opens as overlay drawer (not push).
  const isTabletOverlay =
    typeof window !== 'undefined' &&
    window.matchMedia('(min-width: 768px) and (max-width: 1023px)').matches &&
    expanded;

  return (
    <>
      {/* Desktop / Tablet collapsed sidebar */}
      {!isTabletOverlay && (
        <aside
          className={`hidden md:flex md:flex-col md:shrink-0 h-screen transition-[width] duration-200 ease-out border-r border-surface-200 ${widthClass} ${className}`}
          aria-label="Sidebar navigation"
        >
          <SidebarContent expanded={expanded} onToggle={toggle} />
        </aside>
      )}

      {/* Tablet overlay (expanded on tablet) */}
      {isTabletOverlay && (
        <div className="hidden md:block" role="presentation">
          <div
            className="fixed inset-0 z-40 bg-black/40"
            aria-hidden="true"
            onClick={toggle}
          />
          <aside
            className={`fixed left-0 top-0 z-40 h-full w-60 shadow-xl transition-transform duration-200 ease-out ${className}`}
            aria-label="Sidebar navigation (overlay)"
          >
            <SidebarContent expanded onToggle={toggle} />
          </aside>
        </div>
      )}

      {/* Mobile drawer */}
      <MobileDrawer open={mobileOpen} onClose={closeMobile} />
    </>
  );
}

// Re-export the hook for consumer convenience.
export { useSidebar } from '@/shared/hooks/useSidebar';
export type { SidebarProps, NavItemDef, SidebarSectionDef };
