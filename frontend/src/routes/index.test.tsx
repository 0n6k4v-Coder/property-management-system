// File: src/routes/index.test.tsx
// Unit tests for route guards (ProtectedRoute, GuestRoute).

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { setStoredTokens, clearStoredTokens } from '@/shared/api/fetchClient';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import { ProtectedRoute } from './ProtectedRoute';
import { GuestRoute } from './GuestRoute';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
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
    // No token set — AuthProvider immediately resolves to unauthenticated
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
});

describe('route module exports', () => {
  it('ProtectedRoute is exported', () => {
    expect(ProtectedRoute).toBeDefined();
  });

  it('GuestRoute is exported', () => {
    expect(GuestRoute).toBeDefined();
  });
});
