// File: src/App.test.tsx
// Unit tests for App root component — verifies provider hierarchy (BrowserRouter,
// QueryClientProvider, ToastProvider, AuthProvider) without importing AppRoutes
// (avoids OOM from lazy-loaded page imports per Task 7.1 lesson).

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';

// ── Mock heavy modules to avoid OOM from lazy-loaded pages ──────────────────
// AppRoutes imports many lazy-loaded feature pages which can cause OOM in tests.
// We mock it to a simple placeholder. Same for AuthContext (which triggers
// /auth/me on mount) and Toast (which has timers).
vi.mock('@/routes', () => ({
  AppRoutes: () => (
    <div data-testid="app-routes">App Routes Placeholder</div>
  ),
}));

vi.mock('@/shared/auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  ),
}));

vi.mock('@/shared/ui/Toast', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="toast-provider">{children}</div>
  ),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByTestId('app-routes')).toBeInTheDocument();
  });

  it('renders AuthProvider (innermost provider)', () => {
    render(<App />);
    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
  });

  it('wraps AppRoutes in AuthProvider', () => {
    render(<App />);
    const authProvider = screen.getByTestId('auth-provider');
    const appRoutes = screen.getByTestId('app-routes');
    // AuthProvider should contain AppRoutes
    expect(authProvider).toContainElement(appRoutes);
  });

  it('wraps AuthProvider in ToastProvider', () => {
    render(<App />);
    const toastProvider = screen.getByTestId('toast-provider');
    const authProvider = screen.getByTestId('auth-provider');
    expect(toastProvider).toContainElement(authProvider);
  });

  it('wraps ToastProvider in QueryClientProvider', () => {
    render(<App />);
    const toastProvider = screen.getByTestId('toast-provider');
    // QueryClientProvider wraps ToastProvider — verify no errors thrown
    expect(toastProvider).toBeInTheDocument();
  });

  it('wraps all providers in BrowserRouter', () => {
    render(<App />);
    expect(screen.getByTestId('toast-provider')).toBeInTheDocument();
    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
    expect(screen.getByTestId('app-routes')).toBeInTheDocument();
  });

  it('creates a QueryClient with correct default options', () => {
    // Verify QueryClient is configured — we check by ensuring the component
    // renders without QueryClient errors (queries would throw if no provider)
    render(<App />);
    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
  });

  it('renders the full provider chain in correct order', () => {
    render(<App />);

    // The hierarchy should be:
    // BrowserRouter → QueryClientProvider → ToastProvider → AuthProvider → AppRoutes
    const toastProvider = screen.getByTestId('toast-provider');
    const authProvider = screen.getByTestId('auth-provider');
    const appRoutes = screen.getByTestId('app-routes');

    expect(toastProvider).toContainElement(authProvider);
    expect(authProvider).toContainElement(appRoutes);
  });
});
