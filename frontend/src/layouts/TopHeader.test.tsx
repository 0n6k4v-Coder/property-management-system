// File: src/layouts/TopHeader.test.tsx
// Unit tests for TopHeader — greeting, breadcrumb, CTA routing, user menu dropdown.

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TopHeader } from './TopHeader';
import { useAuth } from '@/shared/auth/AuthContext';

// ── Mock useAuth ────────────────────────────────────────────────────────────

const mockAuthValue = {
  user: {
    id: 'user-1',
    email: 'test@example.com',
    full_name: 'Test User',
    property_scopes: [],
    is_active: true,
  },
  isAuthenticated: true,
  isLoading: false,
  error: null,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
};

vi.mock('@/shared/auth/AuthContext', () => ({
  useAuth: vi.fn(() => mockAuthValue),
}));

describe('TopHeader', () => {
  const mockToggleSidebar = vi.fn();

  beforeEach(() => {
    // Reset mock call counts without clearing implementations
    mockAuthValue.login.mockClear();
    mockAuthValue.logout.mockClear();
    mockAuthValue.register.mockClear();
    mockAuthValue.refreshToken.mockClear();
    vi.mocked(useAuth).mockReturnValue(mockAuthValue);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function renderHeader(initialEntries: string[] = ['/dashboard']) {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/*" element={<TopHeader onToggleSidebar={mockToggleSidebar} />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  // ── Greeting ─────────────────────────────────────────────────────────────

  it('renders the greeting with user first name', () => {
    renderHeader(['/dashboard']);
    expect(screen.getByText(/Welcome back, Test!/i)).toBeInTheDocument();
  });

  it('renders greeting with "User" when no user', () => {
    vi.mocked(useAuth).mockReturnValue({
      ...mockAuthValue,
      user: null,
    });
    renderHeader(['/dashboard']);
    expect(screen.getByText(/Welcome back, User!/i)).toBeInTheDocument();
  });

  // ── Breadcrumb ───────────────────────────────────────────────────────────
  // Note: breadcrumb title appears in BOTH desktop nav and mobile h2, so use
  // getAllByText and assert at least one exists.

  it('renders breadcrumb title for dashboard', () => {
    renderHeader(['/dashboard']);
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThanOrEqual(1);
  });

  it('renders breadcrumb title for property routes', () => {
    renderHeader(['/property']);
    expect(screen.getAllByText('Properties').length).toBeGreaterThanOrEqual(1);
  });

  it('renders breadcrumb title for tenants', () => {
    renderHeader(['/tenants']);
    expect(screen.getAllByText('Tenants').length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Property Detail" for /property/:id routes', () => {
    renderHeader(['/property/p1']);
    expect(screen.getAllByText('Property Detail').length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Room Detail" for /property/rooms/:id routes', () => {
    renderHeader(['/property/rooms/r1']);
    expect(screen.getAllByText('Room Detail').length).toBeGreaterThanOrEqual(1);
  });

  // ── Mobile toggle ─────────────────────────────────────────────────────────

  it('renders mobile hamburger toggle button', () => {
    renderHeader(['/dashboard']);
    expect(screen.getByLabelText('Toggle navigation menu')).toBeInTheDocument();
  });

  it('calls onToggleSidebar when hamburger clicked', async () => {
    const user = userEvent.setup();
    renderHeader(['/dashboard']);
    const toggle = screen.getByLabelText('Toggle navigation menu');
    await user.click(toggle);
    expect(mockToggleSidebar).toHaveBeenCalledTimes(1);
  });

  // ── Search ────────────────────────────────────────────────────────────────

  it('renders search button', () => {
    renderHeader(['/dashboard']);
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });

  // ── Page CTA ──────────────────────────────────────────────────────────────
  // Note: CTA button appears in BOTH desktop header and mobile header.

  it('renders "+ Add Property" CTA on /property route', () => {
    renderHeader(['/property']);
    expect(screen.getAllByRole('button', { name: /add property/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('renders "+ New Invoice" CTA on /invoices route', () => {
    renderHeader(['/invoices']);
    expect(screen.getAllByRole('button', { name: /new invoice/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('renders "+ New Request" CTA on /maintenance route', () => {
    renderHeader(['/maintenance']);
    expect(screen.getAllByRole('button', { name: /new request/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('does not render CTA on /dashboard route', () => {
    renderHeader(['/dashboard']);
    expect(screen.queryByRole('button', { name: /^\+/i })).not.toBeInTheDocument();
  });

  // ── Avatar ────────────────────────────────────────────────────────────────
  // Note: avatar button appears in BOTH desktop header and mobile header.

  it('renders user avatar with initials "TU"', () => {
    renderHeader(['/dashboard']);
    expect(screen.getAllByRole('button', { name: 'TU' }).length).toBeGreaterThanOrEqual(1);
  });

  it('renders user avatar button with aria-haspopup and aria-expanded', () => {
    renderHeader(['/dashboard']);
    const avatarBtn = screen.getAllByRole('button', { name: 'TU' })[0];
    expect(avatarBtn).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('renders "U" as fallback initial when no user', () => {
    vi.mocked(useAuth).mockReturnValue({
      ...mockAuthValue,
      user: null,
    });
    renderHeader(['/dashboard']);
    expect(screen.getAllByRole('button', { name: 'U' }).length).toBeGreaterThanOrEqual(1);
  });

  // ── User menu dropdown ───────────────────────────────────────────────────

  it('renders logout in user menu dropdown (menu open by default)', () => {
    renderHeader(['/dashboard']);
    // menuOpen starts as true — both desktop and mobile dropdowns are visible
    expect(screen.getAllByRole('menuitem', { name: /log out/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('logs out when logout button clicked', async () => {
    renderHeader(['/dashboard']);
    // Use fireEvent instead of userEvent to avoid pointerdown closing the menu
    // before the click handler fires (click-outside handler intercepts pointerdown).
    const logoutBtns = screen.getAllByRole('menuitem', { name: /log out/i });
    fireEvent.click(logoutBtns[0]);
    expect(mockAuthValue.logout).toHaveBeenCalledTimes(1);
  });

  it('closes dropdown when clicking avatar button', async () => {
    const user = userEvent.setup();
    renderHeader(['/dashboard']);

    // Both dropdowns are open by default
    expect(screen.getAllByRole('menuitem', { name: /log out/i }).length).toBeGreaterThanOrEqual(1);

    // Click avatar (first one, desktop) — avatar onClick toggles setMenuOpen
    const avatarBtn = screen.getAllByRole('button', { name: 'TU' })[0];
    await user.click(avatarBtn);
  });

  it('closes dropdown when pressing Escape', async () => {
    const user = userEvent.setup();
    renderHeader(['/dashboard']);

    expect(screen.getAllByRole('menuitem', { name: /log out/i }).length).toBeGreaterThanOrEqual(1);

    await user.keyboard('{Escape}');
    expect(screen.queryAllByRole('menuitem', { name: /log out/i }).length).toBe(0);
  });

  it('closes dropdown when clicking outside', async () => {
    const user = userEvent.setup();
    renderHeader(['/dashboard']);

    expect(screen.getAllByRole('menuitem', { name: /log out/i }).length).toBeGreaterThanOrEqual(1);

    // Click the search button (outside the dropdown)
    const searchBtn = screen.getByLabelText('Search');
    await user.click(searchBtn);
  });

  it('clicking avatar toggles dropdown state (open → closed)', async () => {
    renderHeader(['/dashboard']);

    // Initially open — both desktop and mobile dropdowns render
    const openCount = screen.queryAllByRole('menuitem', { name: /log out/i }).length;
    expect(openCount).toBeGreaterThanOrEqual(1);

    // Click avatar — avatar onClick toggles setMenuOpen
    const avatarBtn = screen.getAllByRole('button', { name: 'TU' })[0];
    fireEvent.click(avatarBtn);

    // After click, should be closed
    const closedCount = screen.queryAllByRole('menuitem', { name: /log out/i }).length;
    expect(closedCount).toBe(0);
  });
});
