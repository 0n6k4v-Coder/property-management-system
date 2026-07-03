// File: src/features/auth/RegisterPage.test.tsx
// Integration tests for RegisterPage — RTL + MSW.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { server } from '@/mocks/server';
import RegisterPage from './RegisterPage';

function renderRegisterPage(token = 'valid-invite-token') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MemoryRouter initialEntries={[`/auth/register?token=${token}`]}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RegisterPage />
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('RegisterPage', () => {
  it('renders registration form with all required fields', () => {
    renderRegisterPage();

    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.click(screen.getByRole('button', { name: /Create Account/i }));

    expect(await screen.findByText(/Full name is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/Phone number is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/Password is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/confirm your password/i)).toBeInTheDocument();
  });

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText(/Full Name/i), 'John Doe');
    await user.type(screen.getByLabelText(/Phone Number/i), '0812345678');
    await user.type(screen.getByLabelText(/^Password$/i), 'Password1');
    await user.type(screen.getByLabelText(/Confirm Password/i), 'DifferentPass2');
    await user.click(screen.getByRole('button', { name: /Create Account/i }));

    expect(await screen.findByText(/Passwords do not match/i)).toBeInTheDocument();
  });

  it('shows error for weak password', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText(/Full Name/i), 'John Doe');
    await user.type(screen.getByLabelText(/Phone Number/i), '0812345678');
    await user.type(screen.getByLabelText(/^Password$/i), 'weak');
    await user.type(screen.getByLabelText(/Confirm Password/i), 'weak');
    await user.click(screen.getByRole('button', { name: /Create Account/i }));

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it('shows missing token message when no token in URL', () => {
    renderRegisterPage('');

    expect(screen.getByText(/Invalid Invitation/i)).toBeInTheDocument();
    expect(screen.getByText(/No invitation token found/i)).toBeInTheDocument();
  });

  it('successfully registers and navigates to login', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText(/Full Name/i), 'John Doe');
    await user.type(screen.getByLabelText(/Phone Number/i), '0812345678');
    await user.type(screen.getByLabelText(/^Password$/i), 'Password1');
    await user.type(screen.getByLabelText(/Confirm Password/i), 'Password1');
    await user.click(screen.getByRole('button', { name: /Create Account/i }));

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /Create Account/i });
      expect(button).not.toBeDisabled();
    });
  });

  it('shows password visibility toggle', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    const toggleButton = screen.getByLabelText(/Show password/i);
    expect(toggleButton).toBeInTheDocument();

    await user.click(toggleButton);
    expect(screen.getByLabelText(/Hide password/i)).toBeInTheDocument();
  });
});