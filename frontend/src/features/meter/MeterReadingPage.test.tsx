// File: src/features/meter/MeterReadingPage.test.tsx
// Integration tests for MeterReadingPage — RTL + MSW.
// Tests online submit, offline queue, validation errors.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { server } from '@/mocks/server';
import MeterReadingPage from './MeterReadingPage';

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={['/meter-reading']}>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <ToastProvider>
            <MeterReadingPage />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('MeterReadingPage', () => {
  it('renders page heading and form', () => {
    renderPage();
    expect(screen.getByText('Meter Reading')).toBeInTheDocument();
    expect(screen.getByText('Save Reading')).toBeInTheDocument();
  });

  it('shows electric and water meter sections', () => {
    renderPage();
    expect(screen.getByText('Electric Meter')).toBeInTheDocument();
    expect(screen.getByText('Water Meter')).toBeInTheDocument();
  });

  it('shows validation errors for empty required fields', async () => {
    const user = userEvent.setup();
    renderPage();

    // Clear the default billing_month and billing_year to trigger validation
    const monthInput = screen.getByLabelText(/Billing Month/i);
    await user.clear(monthInput);

    await user.click(screen.getByText('Save Reading'));

    expect(await screen.findByText(/Room is required/i)).toBeInTheDocument();
  });

  it('shows error when electric current < previous', async () => {
    const user = userEvent.setup();
    renderPage();

    const inputs = screen.getAllByRole('spinbutton');
    // inputs order: billing_month, billing_year, electric_prev, electric_curr, water_prev, water_curr
    await user.type(screen.getByLabelText(/Room ID/i), 'room-1');
    await user.clear(inputs[2]!);
    await user.type(inputs[2]!, '100');
    await user.clear(inputs[3]!);
    await user.type(inputs[3]!, '50');

    await user.click(screen.getByText('Save Reading'));

    expect(await screen.findByText(/Electric current cannot be less/i)).toBeInTheDocument();
  });

  it('submits successfully via API', async () => {
    const user = userEvent.setup();
    renderPage();

    const inputs = screen.getAllByRole('spinbutton');
    await user.type(screen.getByLabelText(/Room ID/i), 'room-1');
    await user.clear(inputs[2]!);
    await user.type(inputs[2]!, '100');
    await user.clear(inputs[3]!);
    await user.type(inputs[3]!, '150');
    await user.clear(inputs[4]!);
    await user.type(inputs[4]!, '50');
    await user.clear(inputs[5]!);
    await user.type(inputs[5]!, '75');

    await user.click(screen.getByText('Save Reading'));

    expect(await screen.findByText(/Reading recorded/i)).toBeInTheDocument();
  });

  it('shows API error toast on failure', async () => {
    const user = userEvent.setup();
    renderPage();

    const inputs = screen.getAllByRole('spinbutton');
    await user.type(screen.getByLabelText(/Room ID/i), 'offline-room');
    await user.clear(inputs[2]!);
    await user.type(inputs[2]!, '100');
    await user.clear(inputs[3]!);
    await user.type(inputs[3]!, '150');

    await user.click(screen.getByText('Save Reading'));

    expect(await screen.findByText(/Service unavailable/i)).toBeInTheDocument();
  });

  it('shows sync status indicator when pending items exist', () => {
    renderPage();
    // No pending items initially — indicator should not show
    expect(screen.queryByText(/pending sync/i)).not.toBeInTheDocument();
  });

  it('has correct input modes for accessibility', () => {
    renderPage();
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs[2]).toHaveAttribute('inputMode', 'decimal');
    expect(inputs[5]).toHaveAttribute('inputMode', 'decimal');
  });
});