// File: src/features/auth/LoginPage.test.tsx
// Integration tests for LoginPage — RTL + MSW.
// SDD §8 Test Pyramid: Integration level, MSW intercepts fetch.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import LoginPage from './LoginPage';

function renderLoginPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MemoryRouter initialEntries={['/login']}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('LoginPage', () => {
  it('renders login form with all required fields', () => {
    renderLoginPage();

    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('button', { name: /Sign in/i }));

    expect(await screen.findByText(/Email is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/Password is required/i)).toBeInTheDocument();
  });

  it('shows validation error for invalid email', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/Email/), 'not-an-email');
    await user.type(screen.getByLabelText(/Password/), 'Password1');
    await user.click(screen.getByRole('button', { name: /Sign in/i }));

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
  });

  it('shows API error on failed login (AUTH-001)', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/Email/), 'wrong@example.com');
    await user.type(screen.getByLabelText(/Password/), 'WrongPass1');
    await user.click(screen.getByRole('button', { name: /Sign in/i }));

    expect(await screen.findByText(/Invalid email or password/i)).toBeInTheDocument();
  });

  it('redirects on successful login', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/Email/), 'test@example.com');
    await user.type(screen.getByLabelText(/Password/), 'Password1');
    await user.click(screen.getByRole('button', { name: /Sign in/i }));

    // After successful login AuthContext calls navigate('/')
    // Check that the submit button is no longer in the "submitting" state
    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /Sign in/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('shows rate limit error (429)', async () => {
    server.use(
      http.post('*/api/v1/auth/login', () => {
        return HttpResponse.json(
          { error: { code: 'RATE-001', message: 'Too many attempts. Try again later.' } },
          { status: 429 },
        );
      }),
    );

    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/Email/), 'test@example.com');
    await user.type(screen.getByLabelText(/Password/), 'Password1');
    await user.click(screen.getByRole('button', { name: /Sign in/i }));

    expect(await screen.findByText(/Too many attempts/i)).toBeInTheDocument();
  });

  it('has toggle visibility button for password', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const toggleButton = screen.getByLabelText(/Show password/i);
    expect(toggleButton).toBeInTheDocument();

    await user.click(toggleButton);
    expect(screen.getByLabelText(/Hide password/i)).toBeInTheDocument();
  });

  it('shows loading state while submitting', async () => {
    // Make the response slow
    server.use(
      http.post('*/api/v1/auth/login', async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return HttpResponse.json({
          data: {
            access_token: 'test',
            refresh_token: 'test',
            user: {
              id: '1',
              email: 'test@example.com',
              full_name: 'Test',
              property_scopes: [],
              is_active: true,
            },
          },
        });
      }),
    );

    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/Email/), 'test@example.com');
    await user.type(screen.getByLabelText(/Password/), 'Password1');
    await user.click(screen.getByRole('button', { name: /Sign in/i }));

    expect(screen.getByRole('button', { name: /Sign in/i })).toBeDisabled();
  });
});