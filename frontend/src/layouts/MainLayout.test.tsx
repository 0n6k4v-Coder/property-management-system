// File: src/layouts/MainLayout.test.tsx
// Unit tests for MainLayout — renders top header, content area with Outlet.
// Uses a lightweight mock for the heavy Sidebar component (OOM-safe per Task 7.1 lessons).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MainLayout } from './MainLayout';
import { useAuth } from '@/shared/auth/AuthContext';

// ── Mock useSidebar ─────────────────────────────────────────────────────────
const mockSidebar = {
  expanded: true,
  mobileOpen: false,
  toggle: vi.fn(),
  setExpanded: vi.fn(),
  openMobile: vi.fn(),
  closeMobile: vi.fn(),
  toggleMobile: vi.fn(),
};

vi.mock('@/shared/hooks/useSidebar', () => ({
  useSidebar: vi.fn(() => mockSidebar),
}));

// ── Mock Sidebar (heavy component, avoid OOM) ────────────────────────────────
// MainLayout imports Sidebar from ./components/Sidebar which is 16KB with many
// sub-imports. We mock it to render a lightweight placeholder instead.
vi.mock('@/layouts/components/Sidebar', () => ({
  Sidebar: ({ sidebarState }: { sidebarState: unknown }) => (
    <div data-testid="sidebar-mock" data-expanded={String((sidebarState as { expanded: boolean }).expanded)}>
      Sidebar
    </div>
  ),
}));

// ── Mock AuthContext ────────────────────────────────────────────────────────
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
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: vi.fn(() => mockAuthValue),
}));

describe('MainLayout', () => {
  beforeEach(() => {
    mockAuthValue.login.mockClear();
    mockAuthValue.logout.mockClear();
    mockAuthValue.register.mockClear();
    mockAuthValue.refreshToken.mockClear();
    mockSidebar.toggleMobile.mockClear();
    vi.mocked(useAuth).mockReturnValue(mockAuthValue);
    mockSidebar.expanded = true;
    mockSidebar.mobileOpen = false;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function renderLayout(initialEntries: string[] = ['/']) {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route index element={<div data-testid="content">Dashboard Content</div>} />
            <Route path="dashboard" element={<div data-testid="content">Dashboard Content</div>} />
            <Route path="property" element={<div data-testid="content">Property Content</div>} />
            <Route path="invoices" element={<div data-testid="content">Invoices Content</div>} />
            <Route path="settings" element={<div data-testid="content">Settings Content</div>} />
            <Route path="*" element={<div data-testid="content">Unknown Route</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  }

  it('renders TopHeader component', () => {
    renderLayout();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('renders the page content via Outlet', () => {
    renderLayout(['/']);
    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  });

  it('renders greeting with user first name', () => {
    renderLayout();
    expect(screen.getByText(/Welcome back, Test!/i)).toBeInTheDocument();
  });

  it('renders breadcrumb title based on route', () => {
    renderLayout(['/property']);
    // "Properties" appears in both mobile h2 and breadcrumb span
    expect(screen.getAllByText('Properties').length).toBeGreaterThanOrEqual(1);
  });

  it('renders sidebar toggle button (mobile)', () => {
    renderLayout();
    expect(screen.getByLabelText('Toggle navigation menu')).toBeInTheDocument();
  });

  it('renders user avatar with initials', () => {
    renderLayout();
    expect(screen.getByRole('button', { name: 'TU' })).toBeInTheDocument();
  });

  it('renders search button', () => {
    renderLayout();
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });

  it('renders CTA button on supported routes (/invoices)', () => {
    renderLayout(['/invoices']);
    expect(screen.getAllByRole('button', { name: /\+ New Invoice/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('does not render CTA on unsupported routes (/dashboard)', () => {
    renderLayout(['/dashboard']);
    expect(screen.queryByRole('button', { name: /^\+ /i })).not.toBeInTheDocument();
  });

  it('renders logout button in user menu dropdown when opened', async () => {
    renderLayout();
    const avatarBtn = screen.getByRole('button', { name: 'TU' });
    fireEvent.click(avatarBtn);
    expect(screen.getByRole('menuitem', { name: /log out/i })).toBeInTheDocument();
  });

  it('calls onToggleSidebar when mobile toggle clicked', async () => {
    renderLayout();
    const toggleBtn = screen.getByLabelText('Toggle navigation menu');
    await toggleBtn.click();
    expect(mockSidebar.toggleMobile).toHaveBeenCalledTimes(1);
  });

  it('does not render CTA on /settings (not in CTA_MAP)', () => {
    renderLayout(['/settings']);
    expect(screen.queryByRole('button', { name: /^\+ /i })).not.toBeInTheDocument();
  });

  it('shows default breadcrumb "Dashboard" for unknown routes', () => {
    renderLayout(['/unknown-route']);
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThanOrEqual(1);
  });

  it('renders mocked Sidebar placeholder', () => {
    renderLayout();
    expect(screen.getByTestId('sidebar-mock')).toBeInTheDocument();
  });
});
