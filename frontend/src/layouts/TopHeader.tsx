// File: src/layouts/TopHeader.tsx
// Top header bar for the authenticated app shell — greeting, breadcrumb, search, page CTA.
// SDD SCR-APP-SHELL §3 — Top Header Bar.
// Receives onToggleSidebar (wired by MainLayout) — does NOT use useSidebar directly.

import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthContext';

// ── Types ───────────────────────────────────────────────────────────

interface TopHeaderProps {
  /** Callback to toggle mobile sidebar drawer. */
  onToggleSidebar: () => void;
}

/** CTA descriptor for the current route. */
interface PageCta {
  /** Human-readable CTA label (e.g. "+ Add Property"). */
  label: string;
  /** Target route to navigate to on click. */
  to: string;
}

// ── CTA Route Map ────────────────────────────────────────────────────

const CTA_MAP: Record<string, PageCta> = {
  '/property': { label: '+ Add Property', to: '/property' },
  '/tenants': { label: '+ Add Tenant', to: '/tenants' },
  '/invoices': { label: '+ New Invoice', to: '/invoices' },
  '/contracts': { label: '+ New Contract', to: '/contracts/new' },
  '/maintenance': { label: '+ New Request', to: '/maintenance/new' },
};

/**
 * Maps a pathname to its page-specific Primary CTA.
 *
 * Matches the longest route prefix so detail routes (e.g. `/property/:id`)
 * inherit the CTA from their list page.
 *
 * @param pathname - Current location pathname from useLocation().
 * @returns CTA descriptor, or null when no CTA applies.
 */
function getCtaForRoute(pathname: string): PageCta | null {
  // Sort prefixes longest-first so `/property/rooms/:id` matches `/property`
  // before a shorter prefix would, and detail routes inherit list CTAs.
  const sortedPrefixes = Object.keys(CTA_MAP).sort(
    (a, b) => b.length - a.length,
  );

  for (const prefix of sortedPrefixes) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      const cta = CTA_MAP[prefix];
      if (cta) return cta;
    }
  }

  // No CTA for dashboard, meter-reading, reports, settings, or unknown routes.
  return null;
}

// ── Breadcrumb Helper ────────────────────────────────────────────────

const BREADCRUMB_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/property': 'Properties',
  '/tenants': 'Tenants',
  '/meter-reading': 'Meter Reading',
  '/invoices': 'Invoices',
  '/contracts': 'Contracts',
  '/contracts/new': 'New Contract',
  '/maintenance': 'Maintenance',
  '/maintenance/new': 'New Request',
  '/reports': 'Reports',
  '/settings': 'Settings',
};

/**
 * Derives a human-readable page title from the current pathname.
 *
 * @param pathname - Current location pathname.
 * @returns Page title for breadcrumb display.
 */
function getBreadcrumbTitle(pathname: string): string {
  const title = BREADCRUMB_TITLES[pathname];
  if (title) return title;

  // Detail routes — derive from parent
  if (pathname.startsWith('/property/rooms/')) return 'Room Detail';
  if (pathname.startsWith('/property/')) return 'Property Detail';
  if (pathname.startsWith('/invoices/')) return 'Invoice Detail';
  if (pathname.startsWith('/contracts/')) return 'Contract Detail';

  return 'Dashboard';
}

// ── Inline SVG Icons ─────────────────────────────────────────────────

interface IconProps {
  className?: string;
}

/** Search (magnifier) icon — 24×24 stroke icon matching Heroicons outline. */
function SearchIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
      />
    </svg>
  );
}

/** Plus icon for mobile icon-only CTA. */
function PlusIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

/** Hamburger menu icon for mobile sidebar toggle. */
function MenuIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
      />
    </svg>
  );
}

// ── Component ────────────────────────────────────────────────────────

/**
 * TopHeader — global toolbar with user context and page-specific CTA.
 *
 * Desktop (≥1024px): greeting + breadcrumb (left), search + primary CTA (right).
 * Mobile (<768px):   hamburger (left), page title (center-left), CTA icon + avatar (right).
 */
export function TopHeader({ onToggleSidebar }: TopHeaderProps) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const pathname = location.pathname;
  const userName = user?.full_name ?? 'User';
  // Use first name for tablet/mobile brevity per SDD §5.2.
  const firstName = userName.split(' ')[0];
  const pageTitle = getBreadcrumbTitle(pathname);
  const cta = getCtaForRoute(pathname);

  // Initials for avatar fallback
  const initials = userName
    .split(' ')
    .flatMap((part) => (part[0] ? [part[0]] : []))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="shrink-0 z-30 border-b border-surface-200 bg-white">
      {/* ── Desktop / Tablet Header ── */}
      <div className="hidden h-20 items-center justify-between px-4 sm:flex sm:px-6 lg:px-8">
        {/* Left: Greeting + Breadcrumb */}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-surface-900 lg:text-2xl">
            Welcome back, {firstName}!
          </h1>
          <nav aria-label="Breadcrumb" className="mt-0.5">
            <span className="text-sm text-surface-500">{pageTitle}</span>
          </nav>
        </div>

        {/* Right: Search + Primary CTA */}
        <div className="flex items-center gap-2 lg:gap-3">
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-lg text-surface-600 hover:bg-surface-100 active:bg-surface-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            aria-label="Search"
          >
            <SearchIcon />
          </button>

          {cta && (
            <button
              type="button"
              onClick={() => navigate(cta.to, { viewTransition: true })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 active:bg-primary-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            >
              <PlusIcon className="size-4" />
              <span className="hidden lg:inline">{cta.label}</span>
              <span className="lg:hidden">{cta.label.replace('+ ', '')}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Mobile Header ── */}
      <div className="flex h-16 items-center justify-between px-4 sm:hidden">
        {/* Left: Hamburger toggle */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex size-10 items-center justify-center rounded-lg text-surface-600 hover:bg-surface-100 active:bg-surface-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
          aria-label="Toggle navigation menu"
          aria-expanded="false"
        >
          <MenuIcon />
        </button>

        {/* Center-left: Page title */}
        <h1 className="flex-1 truncate pl-2 text-base font-semibold text-surface-900">
          {pageTitle}
        </h1>

        {/* Right: CTA icon-only + Avatar */}
        <div className="flex items-center gap-1.5">
          {cta && (
            <button
              type="button"
              onClick={() => navigate(cta.to, { viewTransition: true })}
              className="inline-flex size-10 items-center justify-center rounded-lg bg-primary-700 text-white hover:bg-primary-800 active:bg-primary-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              aria-label={cta.label}
            >
              <PlusIcon />
            </button>
          )}

          {/* Avatar */}
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700 ring-1 ring-primary-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            aria-label="User menu"
          >
            {initials || '?'}
          </button>
        </div>
      </div>
    </header>
  );
}
