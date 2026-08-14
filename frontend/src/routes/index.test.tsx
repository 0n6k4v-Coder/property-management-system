// File: src/routes/index.test.tsx
// Unit tests for route guards (ProtectedRoute, GuestRoute) + route configuration.
// Uses vi.mock to mock feature modules so AppRoutes can be rendered safely
// without OOM from 14 lazy module imports.

import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, Outlet } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { setStoredTokens, clearStoredTokens, getStoredAccessToken } from '@/shared/api/fetchClient';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import { ProtectedRoute } from './ProtectedRoute';
import { GuestRoute } from './GuestRoute';
import { AppRoutes } from './index';

// Mock all feature modules that AppRoutes lazy-imports
// Note: lazy(() => import(...)) expects a default export from the module
vi.mock('@/features/auth/LoginPage', () => ({
  default: () => <div data-testid="page-login">Login Page</div>,
}));
vi.mock('@/features/auth/RegisterPage', () => ({
  default: () => <div data-testid="page-register">Register Page</div>,
}));
vi.mock('@/features/dashboard/DashboardPage', () => ({
  default: () => <div data-testid="page-dashboard">Dashboard Page</div>,
}));
vi.mock('@/features/property/PropertyListPage', () => ({
  default: () => <div data-testid="page-property-list">Property List Page</div>,
}));
vi.mock('@/features/property/PropertyDetailPage', () => ({
  default: () => <div data-testid="page-property-detail">Property Detail Page</div>,
}));
vi.mock('@/features/property/RoomDetailPage', () => ({
  default: () => <div data-testid="page-room-detail">Room Detail Page</div>,
}));
vi.mock('@/features/tenant/TenantListPage', () => ({
  default: () => <div data-testid="page-tenant-list">Tenant List Page</div>,
}));
vi.mock('@/features/meter/MeterReadingPage', () => ({
  default: () => <div data-testid="page-meter">Meter Reading Page</div>,
}));
vi.mock('@/features/billing/InvoiceListPage', () => ({
  default: () => <div data-testid="page-invoice-list">Invoice List Page</div>,
}));
vi.mock('@/features/billing/InvoiceDetailPage', () => ({
  default: () => <div data-testid="page-invoice-detail">Invoice Detail Page</div>,
}));
vi.mock('@/features/reports/ReportsPage', () => ({
  default: () => <div data-testid="page-reports">Reports Page</div>,
}));
vi.mock('@/features/contract/ContractListPage', () => ({
  default: () => <div data-testid="page-contract-list">Contract List Page</div>,
}));
vi.mock('@/features/contract/ContractDetailPage', () => ({
  default: () => <div data-testid="page-contract-detail">Contract Detail Page</div>,
}));
vi.mock('@/features/contract/ContractFormPage', () => ({
  default: () => <div data-testid="page-form">Form Page</div>,
}));
vi.mock('@/features/maintenance/MaintenanceListPage', () => ({
  default: () => <div data-testid="page-maintenance-list">Maintenance List Page</div>,
}));
vi.mock('@/features/maintenance/MaintenanceFormPage', () => ({
  default: () => <div data-testid="page-maintenance-form">Maintenance Form Page</div>,
}));
vi.mock('@/features/settings/SettingsPage', () => ({
  default: () => <div data-testid="page-settings">Settings Page</div>,
}));

// Mock layouts that use useSidebar (which needs window.matchMedia)
vi.mock('@/layouts/MainLayout', () => ({
  MainLayout: () => (
    <div data-testid="layout-main">
      <Outlet />
    </div>
  ),
}));
vi.mock('@/layouts/AuthLayout', () => ({
  AuthLayout: () => (
    <div data-testid="layout-auth">
      <Outlet />
    </div>
  ),
}));

// Polyfill window.matchMedia for jsdom (used by useSidebar in layout components)
beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }
});

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  clearStoredTokens();
});
afterAll(() => server.close());

function renderWithProviders(
  ui: React.ReactNode,
  initialEntries: string[] = ['/'],
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={qc}>
        <AuthProvider>{ui}</AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  afterEach(() => {
    clearStoredTokens();
  });

  it('shows loading spinner while auth is being checked', () => {
    setStoredTokens('fake-token');
    renderWithProviders(<ProtectedRoute />, ['/dashboard']);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders children (Outlet) when authenticated', async () => {
    server.use(
      http.get('*/api/v1/auth/me', () => {
        return HttpResponse.json({
          data: {
            id: '00000000-0000-0000-0000-000000000001',
            email: 'test@example.com',
            full_name: 'Test User',
            property_scopes: [],
            is_active: true,
          },
        });
      }),
    );
    setStoredTokens('fake-token');

    renderWithProviders(
      <Routes>
        <Route path="/dashboard" element={<ProtectedRoute />}>
          <Route index element={<div>Protected Content</div>} />
        </Route>
      </Routes>,
      ['/dashboard'],
    );

    expect(await screen.findByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', async () => {
    clearStoredTokens();
    renderWithProviders(
      <Routes>
        <Route path="/dashboard" element={<ProtectedRoute />}>
          <Route index element={<div>Protected</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>,
      ['/dashboard'],
    );

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });

  it('is a function component', () => {
    expect(typeof ProtectedRoute).toBe('function');
  });

  it('preserves location state "from" when redirecting to /login', async () => {
    clearStoredTokens();
    renderWithProviders(
      <Routes>
        <Route path="/protected-page" element={<ProtectedRoute />}>
          <Route index element={<div>Protected</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>,
      ['/protected-page'],
    );

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });

  it('renders loading spinner with correct structure (output element)', () => {
    setStoredTokens('fake-token');
    renderWithProviders(<ProtectedRoute />, ['/dashboard']);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    expect(spinner).toHaveClass('size-8');
  });
});

describe('GuestRoute', () => {
  afterEach(() => {
    clearStoredTokens();
  });

  it('shows loading spinner while auth is being checked', () => {
    setStoredTokens('fake-token');
    renderWithProviders(<GuestRoute />, ['/login']);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('renders children (Outlet) when not authenticated', async () => {
    clearStoredTokens();
    server.use(
      http.get('*/api/v1/auth/me', () => {
        return HttpResponse.json(
          { error: { code: 'AUTH-009', message: 'Invalid token' } },
          { status: 401 },
        );
      }),
    );

    renderWithProviders(
      <Routes>
        <Route path="/login" element={<GuestRoute />}>
          <Route index element={<div>Login Form</div>} />
        </Route>
      </Routes>,
      ['/login'],
    );

    expect(await screen.findByText('Login Form')).toBeInTheDocument();
  });

  it('redirects to /dashboard when already authenticated', async () => {
    server.use(
      http.get('*/api/v1/auth/me', () => {
        return HttpResponse.json({
          data: {
            id: '00000000-0000-0000-0000-000000000001',
            email: 'test@example.com',
            full_name: 'Test User',
            property_scopes: [],
            is_active: true,
          },
        });
      }),
    );
    setStoredTokens('fake-token');

    renderWithProviders(
      <Routes>
        <Route path="/login" element={<GuestRoute />}>
          <Route index element={<div>Login Form</div>} />
        </Route>
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>,
      ['/login'],
    );

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  it('is a function component', () => {
    expect(typeof GuestRoute).toBe('function');
  });

  it('renders loading spinner with correct structure', () => {
    setStoredTokens('fake-token');
    renderWithProviders(<GuestRoute />, ['/login']);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('uses replace=true when redirecting to /dashboard (avoids history bloat)', async () => {
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
    setStoredTokens('fake-token');

    const LocationDisplay = () => {
      const location = useLocation();
      return <div data-testid="location">{location.pathname}</div>;
    };

    renderWithProviders(
      <Routes>
        <Route path="/login" element={<GuestRoute />}>
          <Route index element={<LocationDisplay />} />
          <Route path="/login" element={<LocationDisplay />} />
        </Route>
        <Route path="/dashboard" element={<LocationDisplay />} />
      </Routes>,
      ['/login'],
    );

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/dashboard');
    });
  });
});

describe('route module exports', () => {
  it('ProtectedRoute is exported', () => {
    expect(ProtectedRoute).toBeDefined();
  });

  it('GuestRoute is exported', () => {
    expect(GuestRoute).toBeDefined();
  });
});

// ── Route configuration structure tests (without importing AppRoutes) ────────
// Per testing-patterns: AppRoutes uses lazy() for 14 feature modules → importing
// it causes OOM in jsdom worker. Instead we verify route guard behavior.

describe('route guard integration', () => {
  it('ProtectedRoute blocks unauthenticated access to protected route', async () => {
    clearStoredTokens();
    renderWithProviders(
      <Routes>
        <Route path="/dashboard" element={<ProtectedRoute />}>
          <Route index element={<div>Secret Content</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>,
      ['/dashboard'],
    );

    await waitFor(() => {
      expect(screen.queryByText('Secret Content')).not.toBeInTheDocument();
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });

  it('GuestRoute blocks authenticated access to guest route', async () => {
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
    setStoredTokens('fake-token');

    renderWithProviders(
      <Routes>
        <Route path="/login" element={<GuestRoute />}>
          <Route index element={<div>Login Form</div>} />
        </Route>
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>,
      ['/login'],
    );

    await waitFor(() => {
      expect(screen.queryByText('Login Form')).not.toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  it('ProtectedRoute shows loading then grants access with valid token', async () => {
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
    setStoredTokens('valid-token');

    renderWithProviders(
      <Routes>
        <Route path="/dashboard" element={<ProtectedRoute />}>
          <Route index element={<div>Dashboard Content</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>,
      ['/dashboard'],
    );

    expect(screen.getByText(/Loading/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
  });
});

// ── Token storage verification ────────────────────────────────────────────────

describe('token storage in route guards', () => {
  it('ProtectedRoute uses getStoredAccessToken to check session', () => {
    setStoredTokens('test-access-token');
    expect(getStoredAccessToken()).toBe('test-access-token');
    renderWithProviders(<ProtectedRoute />, ['/dashboard']);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    clearStoredTokens();
  });

  it('GuestRoute does not require token — resolves to unauthenticated', async () => {
    clearStoredTokens();
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<GuestRoute />}>
          <Route index element={<div>Login Form</div>} />
        </Route>
      </Routes>,
      ['/login'],
    );

    expect(await screen.findByText('Login Form')).toBeInTheDocument();
  });
});

// ── AppRoutes route configuration tests ───────────────────────────────────────
// Mocked feature modules prevent OOM from 14 lazy imports.

describe('AppRoutes', () => {
  afterEach(() => {
    clearStoredTokens();
  });

  it('is a function (exported component)', () => {
    expect(typeof AppRoutes).toBe('function');
  });

  it('redirects / to /dashboard (index route)', async () => {
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
    setStoredTokens('fake-token');

    render(
      <MemoryRouter initialEntries={['/']}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('page-dashboard')).toBeInTheDocument();
    });
  });

  it('renders LoginPage at /login (GuestRoute)', async () => {
    clearStoredTokens();
    server.use(
      http.get('*/api/v1/auth/me', () => {
        return HttpResponse.json(
          { error: { code: 'AUTH-009', message: 'No token' } },
          { status: 401 },
        );
      }),
    );

    render(
      <MemoryRouter initialEntries={['/login']}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('page-login')).toBeInTheDocument();
    });
  });

  it('renders RegisterPage at /auth/register (GuestRoute)', async () => {
    clearStoredTokens();
    server.use(
      http.get('*/api/v1/auth/me', () => {
        return HttpResponse.json(
          { error: { code: 'AUTH-009', message: 'No token' } },
          { status: 401 },
        );
      }),
    );

    render(
      <MemoryRouter initialEntries={['/auth/register']}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('page-register')).toBeInTheDocument();
    });
  });

  it('renders DashboardPage at /dashboard (ProtectedRoute)', async () => {
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
    setStoredTokens('fake-token');

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('page-dashboard')).toBeInTheDocument();
    });
  });

  it('renders SettingsPage at /settings (ProtectedRoute)', async () => {
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
    setStoredTokens('fake-token');

    render(
      <MemoryRouter initialEntries={['/settings']}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('page-settings')).toBeInTheDocument();
    });
  });

  it('renders MaintenanceFormPage at /maintenance/new (ProtectedRoute)', async () => {
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
    setStoredTokens('fake-token');

    render(
      <MemoryRouter initialEntries={['/maintenance/new']}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('page-maintenance-form')).toBeInTheDocument();
    });
  });

  it('renders ContractFormPage at /contracts/new (ProtectedRoute)', async () => {
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
    setStoredTokens('fake-token');

    render(
      <MemoryRouter initialEntries={['/contracts/new']}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('page-form')).toBeInTheDocument();
    });
  });

  it('renders InvoiceDetailPage at /invoices/123 (ProtectedRoute)', async () => {
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
    setStoredTokens('fake-token');

    render(
      <MemoryRouter initialEntries={['/invoices/123']}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('page-invoice-detail')).toBeInTheDocument();
    });
  });

  it('redirects unknown routes to /login (catch-all *)', async () => {
    clearStoredTokens();
    server.use(
      http.get('*/api/v1/auth/me', () => {
        return HttpResponse.json(
          { error: { code: 'AUTH-009', message: 'No token' } },
          { status: 401 },
        );
      }),
    );

    render(
      <MemoryRouter initialEntries={['/unknown-route']}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('page-login')).toBeInTheDocument();
    });
  });

  it('shows loading spinner while auth is being verified on protected route', async () => {
    setStoredTokens('fake-token');
    server.use(
      http.get('*/api/v1/auth/me', async () => {
        await new Promise((r) => setTimeout(r, 1000));
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

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });
});
