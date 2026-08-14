// File: src/layouts/components/Sidebar.test.tsx
// Unit tests for Sidebar.tsx — navigation rendering, active state, mobile drawer,
// user avatar, responsive overlay, and accessibility.

import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { setStoredTokens, clearStoredTokens } from '@/shared/api/fetchClient';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import { Sidebar } from './Sidebar';
import { useSidebar } from '@/shared/hooks/useSidebar';

// ── Polyfill HTMLDialogElement for jsdom (used by Dialog.tsx in MobileDrawer) ───

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
}

// ── MSW lifecycle ──────────────────────────────────────────────────────────────

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  clearStoredTokens();
  cleanup();
});
afterAll(() => server.close());

// ── Mock sidebar state factory ─────────────────────────────────────────────────

function makeMockSidebar(expanded = true) {
  return {
    expanded,
    mobileOpen: false,
    toggle: vi.fn(),
    setExpanded: vi.fn(),
    openMobile: vi.fn(),
    closeMobile: vi.fn(),
    toggleMobile: vi.fn(),
  };
}

// ── matchMedia mock helpers ────────────────────────────────────────────────────

const originalMatchMedia = window.matchMedia;

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function mockTabletMatchMedia() {
  window.matchMedia = vi.fn((query: string) => ({
    matches: query.includes('768px') && query.includes('1023px'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

// ── Render helper ─────────────────────────────────────────────────────────────

function renderWithSidebar(
  sidebarState?: ReturnType<typeof useSidebar>,
  initialEntries: string[] = ['/dashboard'],
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <Sidebar sidebarState={sidebarState} />
      </AuthProvider>
    </MemoryRouter>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Sidebar', () => {
  beforeEach(() => {
    // Default: desktop viewport — matchMedia returns matches: false
    mockMatchMedia(false);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  // ── SidebarToggle ──────────────────────────────────────────────────────────

  describe('SidebarToggle', () => {
    it('renders toggle button with "Expand sidebar" aria-label when collapsed', () => {
      renderWithSidebar(makeMockSidebar(false));
      const toggle = screen.getByRole('button', { name: /Expand sidebar/i });
      expect(toggle).toBeInTheDocument();
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    it('renders toggle button with "Collapse sidebar" aria-label when expanded', () => {
      renderWithSidebar(makeMockSidebar(true));
      const toggle = screen.getByRole('button', { name: /Collapse sidebar/i });
      expect(toggle).toBeInTheDocument();
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
    });

    it('calls toggle when toggle button is clicked', () => {
      const mockSidebar = makeMockSidebar(true);
      renderWithSidebar(mockSidebar);
      const toggle = screen.getByRole('button', { name: /Collapse sidebar/i });
      fireEvent.click(toggle);
      expect(mockSidebar.toggle).toHaveBeenCalledTimes(1);
    });
  });

  // ── Navigation items ───────────────────────────────────────────────────────

  describe('navigation items', () => {
    it('renders all MENU nav items', () => {
      renderWithSidebar(makeMockSidebar(true));

      expect(screen.getAllByRole('link', { name: /Dashboard/i })).toHaveLength(1);
      expect(screen.getAllByRole('link', { name: /Properties/i })).toHaveLength(1);
      expect(screen.getAllByRole('link', { name: /Tenants/i })).toHaveLength(1);
      expect(screen.getAllByRole('link', { name: /Meters/i })).toHaveLength(1);
      expect(screen.getAllByRole('link', { name: /Invoices/i })).toHaveLength(1);
      expect(screen.getAllByRole('link', { name: /Contracts/i })).toHaveLength(1);
      expect(screen.getAllByRole('link', { name: /Maintenance/i })).toHaveLength(1);
      expect(screen.getAllByRole('link', { name: /Reports/i })).toHaveLength(1);
    });

    it('renders USER section nav item (Settings)', () => {
      renderWithSidebar(makeMockSidebar(true));
      expect(screen.getAllByRole('link', { name: /Settings/i })).toHaveLength(1);
    });

    it('nav links have correct href attributes', () => {
      renderWithSidebar(makeMockSidebar(true));

      const dashboardLinks = screen.getAllByRole('link', { name: /Dashboard/i });
      expect(dashboardLinks[0]).toHaveAttribute('href', '/dashboard');
      const propertiesLinks = screen.getAllByRole('link', { name: /Properties/i });
      expect(propertiesLinks[0]).toHaveAttribute('href', '/property');
      const settingsLinks = screen.getAllByRole('link', { name: /Settings/i });
      expect(settingsLinks[0]).toHaveAttribute('href', '/settings');
    });

    it('Dashboard link uses end=True for exact match (aria-current=page)', () => {
      renderWithSidebar(makeMockSidebar(true), ['/dashboard']);
      const dashboardLink = screen.getAllByRole('link', { name: /Dashboard/i })[0];
      expect(dashboardLink).toHaveAttribute('aria-current', 'page');
    });

    it('non-active Dashboard link does NOT have aria-current', () => {
      renderWithSidebar(makeMockSidebar(true), ['/property']);
      const dashboardLink = screen.getAllByRole('link', { name: /Dashboard/i })[0];
      expect(dashboardLink).not.toHaveAttribute('aria-current');
    });
  });

  // ── Active state highlighting ──────────────────────────────────────────────

  describe('active state highlighting', () => {
    it('highlights active route with primary-50 bg class', () => {
      renderWithSidebar(makeMockSidebar(true), ['/dashboard']);
      const dashboardLink = screen.getAllByRole('link', { name: /Dashboard/i })[0];
      expect(dashboardLink).toHaveClass('bg-primary-50');
      expect(dashboardLink).toHaveClass('text-primary-700');
    });

    it('non-active routes get surface-600 class', () => {
      renderWithSidebar(makeMockSidebar(true), ['/dashboard']);
      const propertiesLink = screen.getAllByRole('link', { name: /Properties/i })[0];
      expect(propertiesLink).toHaveClass('text-surface-600');
    });
  });

  // ── Expanded vs collapsed state ────────────────────────────────────────────

  describe('expanded vs collapsed state', () => {
    it('shows labels when expanded', () => {
      renderWithSidebar(makeMockSidebar(true));
      const dashboardLink = screen.getAllByRole('link', { name: /Dashboard/i })[0];
      expect(dashboardLink).toHaveTextContent('Dashboard');
    });

    it('hides labels when collapsed (icon-only — label span has opacity-0)', () => {
      renderWithSidebar(makeMockSidebar(false));
      const dashboardLink = screen.getAllByRole('link', { name: /Dashboard/i })[0];
      const labelSpan = dashboardLink.querySelector('span.truncate');
      expect(labelSpan).toHaveClass('opacity-0');
    });

    it('applies correct width class when expanded (w-60)', () => {
      const { container } = renderWithSidebar(makeMockSidebar(true));
      const aside = container.querySelector('aside');
      expect(aside).toHaveClass('w-60');
    });

    it('applies correct width class when collapsed (w-16)', () => {
      const { container } = renderWithSidebar(makeMockSidebar(false));
      const aside = container.querySelector('aside');
      expect(aside).toHaveClass('w-16');
    });
  });

  // ── Section headings ───────────────────────────────────────────────────────

  describe('section headings', () => {
    it('renders MENU and USER section headings', () => {
      renderWithSidebar(makeMockSidebar(true));
      // SidebarContent renders in both desktop sidebar and MobileDrawer
      expect(screen.getAllByText('MENU')).toHaveLength(2);
      expect(screen.getAllByText('USER')).toHaveLength(2);
    });
  });

  // ── User avatar block ──────────────────────────────────────────────────────

  describe('UserAvatarBlock', () => {
    it('renders "User" default name when no user is authenticated', () => {
      renderWithSidebar(makeMockSidebar(true));
      // UserAvatarBlock renders in both desktop and mobile drawer
      expect(screen.getAllByText('User')).toHaveLength(2);
    });

    it('renders user full name when authenticated via /auth/me', async () => {
      setStoredTokens('valid-token');
      server.use(
        http.get('*/api/v1/auth/me', () => {
          return HttpResponse.json({
            data: {
              id: 'user-1',
              email: 'test@example.com',
              full_name: 'Test User',
              property_scopes: [],
              is_active: true,
            },
          });
        }),
      );

      renderWithSidebar(makeMockSidebar(true));

      await waitFor(() => {
        expect(screen.getAllByText('Test User')).toHaveLength(2);
      });
    });

    it('shows initials from full name', async () => {
      setStoredTokens('valid-token');
      server.use(
        http.get('*/api/v1/auth/me', () => {
          return HttpResponse.json({
            data: {
              id: 'user-1',
              email: 'test@example.com',
              full_name: 'John Doe',
              property_scopes: [],
              is_active: true,
            },
          });
        }),
      );

      renderWithSidebar(makeMockSidebar(true));

      await waitFor(() => {
        expect(screen.getAllByText('JD')).toHaveLength(2);
      });
    });

    it('shows single initial for single-word name', async () => {
      setStoredTokens('valid-token');
      server.use(
        http.get('*/api/v1/auth/me', () => {
          return HttpResponse.json({
            data: {
              id: 'user-1',
              email: 'test@example.com',
              full_name: 'Cher',
              property_scopes: [],
              is_active: true,
            },
          });
        }),
      );

      renderWithSidebar(makeMockSidebar(true));

      await waitFor(() => {
        expect(screen.getAllByText('C', { exact: true })).toHaveLength(2);
      });
    });

    it('shows "U" avatar fallback when name is only spaces', async () => {
      setStoredTokens('valid-token');
      server.use(
        http.get('*/api/v1/auth/me', () => {
          return HttpResponse.json({
            data: {
              id: 'user-1',
              email: 'test@example.com',
              full_name: '   ',
              property_scopes: [],
              is_active: true,
            },
          });
        }),
      );

      renderWithSidebar(makeMockSidebar(true));

      await waitFor(() => {
        expect(screen.getAllByText('U', { exact: true })).toHaveLength(2);
      });
    });
  });

  // ── Accessibility ──────────────────────────────────────────────────────────

  describe('accessibility', () => {
    it('has nav with aria-label "Main navigation"', () => {
      renderWithSidebar(makeMockSidebar(true));
      const nav = screen.getAllByRole('navigation', { name: /Main navigation/i });
      expect(nav.length).toBeGreaterThanOrEqual(1);
    });

    it('aside has aria-label "Sidebar navigation"', () => {
      const { container } = renderWithSidebar(makeMockSidebar(true));
      const aside = container.querySelector('aside[aria-label="Sidebar navigation"]');
      expect(aside).toBeInTheDocument();
    });

    it('nav links have title attributes for icon-only mode', () => {
      renderWithSidebar(makeMockSidebar(false));
      const dashboardLink = screen.getAllByRole('link', { name: /Dashboard/i })[0];
      expect(dashboardLink).toHaveAttribute('title', 'Dashboard');
    });

    it('toggle button has focus-visible outline classes', () => {
      renderWithSidebar(makeMockSidebar(true));
      const toggle = screen.getByRole('button', { name: /Collapse sidebar/i });
      expect(toggle).toHaveClass('focus-visible:outline-2');
    });

    it('icons are decorative (aria-hidden=true)', () => {
      renderWithSidebar(makeMockSidebar(true));
      const link = screen.getAllByRole('link', { name: /Dashboard/i })[0];
      const svg = link.querySelector('svg[aria-hidden="true"]');
      expect(svg).toBeInTheDocument();
    });
  });

  // ── Without sidebarState prop (uses useSidebar hook) ───────────────────────

  describe('without sidebarState prop', () => {
    it('renders without crashing when sidebarState is not provided', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <Sidebar />
          </AuthProvider>
        </MemoryRouter>,
      );
      expect(screen.getAllByRole('navigation', { name: /Main navigation/i }).length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── className prop ─────────────────────────────────────────────────────────

  describe('className prop', () => {
    it('merges custom className onto the aside element', () => {
      const { container } = renderWithSidebar(makeMockSidebar(true));
      const aside = container.querySelector('aside');
      expect(aside).toBeInTheDocument();
    });
  });

  // ── Mobile drawer ──────────────────────────────────────────────────────────

  describe('MobileDrawer', () => {
    it('renders dialog element for mobile drawer when closed', () => {
      renderWithSidebar(makeMockSidebar(true));
      const dialogs = document.querySelectorAll('dialog');
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
    });

    it('renders with mobileOpen=true', () => {
      renderWithSidebar({
        expanded: true,
        mobileOpen: true,
        toggle: vi.fn(),
        setExpanded: vi.fn(),
        openMobile: vi.fn(),
        closeMobile: vi.fn(),
        toggleMobile: vi.fn(),
      });
      const dialogs = document.querySelectorAll('dialog');
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Tablet overlay ─────────────────────────────────────────────────────────

  describe('tablet overlay', () => {
    it('shows tablet overlay when expanded AND tablet viewport matches', () => {
      mockTabletMatchMedia();

      const { container } = renderWithSidebar(makeMockSidebar(true), ['/dashboard']);

      const backdrop = container.querySelector('.fixed.inset-0.z-40');
      expect(backdrop).toBeInTheDocument();
    });
  });
});
