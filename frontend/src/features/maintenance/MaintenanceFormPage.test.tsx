// File: src/features/maintenance/MaintenanceFormPage.test.tsx
// Integration tests for MaintenanceFormPage — RTL + MSW.

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import MaintenanceFormPage from './MaintenanceFormPage';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderPage() {
  const qc = createQueryClient();
  return render(
    <MemoryRouter initialEntries={['/maintenance/new']}>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/maintenance/new" element={<MaintenanceFormPage />} />
              <Route path="/maintenance" element={<div>Maintenance List</div>} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('MaintenanceFormPage', () => {
  describe('static rendering', () => {
    it('renders page heading', async () => {
      renderPage();
      expect(await screen.findByText('New Maintenance Request')).toBeInTheDocument();
    });

    it('renders page description', async () => {
      renderPage();
      await screen.findByText('New Maintenance Request');
      expect(screen.getByText('Submit a maintenance request for a room')).toBeInTheDocument();
    });

    it('renders Cancel button', async () => {
      renderPage();
      await screen.findByText('New Maintenance Request');
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('renders Submit Request button', async () => {
      renderPage();
      await screen.findByText('New Maintenance Request');
      expect(screen.getByRole('button', { name: 'Submit Request' })).toBeInTheDocument();
    });

    it('renders Request Details card header', async () => {
      renderPage();
      await screen.findByText('New Maintenance Request');
      expect(screen.getByText('Request Details')).toBeInTheDocument();
    });
  });

  describe('property selection', () => {
    it('renders property selection field', async () => {
      renderPage();
      expect(await screen.findByLabelText(/^Property/)).toBeInTheDocument();
    });

    it('renders property options from API', async () => {
      renderPage();
      await screen.findByText('New Maintenance Request');
      expect(await screen.findByText('Sunset Tower')).toBeInTheDocument();
      expect(screen.getByText('Riverside Apartments')).toBeInTheDocument();
    });

    it('shows Select a property placeholder option', async () => {
      renderPage();
      await screen.findByText('New Maintenance Request');
      expect(screen.getByText('Select a property…')).toBeInTheDocument();
    });

    it('does not render room selection until a property is selected', async () => {
      renderPage();
      await screen.findByText('New Maintenance Request');
      expect(screen.queryByLabelText(/^Room/)).not.toBeInTheDocument();
    });

    it('shows room selection after property is selected', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Sunset Tower');
      await user.selectOptions(screen.getByLabelText(/^Property/), 'p1');

      await waitFor(() => {
        expect(screen.getByLabelText(/^Room/)).toBeInTheDocument();
      });
    });

    it('shows room options from selected property', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Sunset Tower');
      await user.selectOptions(screen.getByLabelText(/^Property/), 'p1');

      await waitFor(() => {
        expect(screen.getByText('101 (studio) - available')).toBeInTheDocument();
        expect(screen.getByText('102 (1br) - occupied')).toBeInTheDocument();
      });
    });

    it('shows "Select a room…" placeholder option', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Sunset Tower');
      await user.selectOptions(screen.getByLabelText(/^Property/), 'p1');

      await screen.findByText('Select a room…');
    });

    it('clears room selection when property changes', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Sunset Tower');
      await user.selectOptions(screen.getByLabelText(/^Property/), 'p1');

      await waitFor(() => screen.getByLabelText(/^Room/));
      await user.selectOptions(screen.getByLabelText(/^Room/), 'r1');

      // Change to different property
      await user.selectOptions(screen.getByLabelText(/^Property/), 'p2');

      await waitFor(() => {
        const roomSelect = screen.getByLabelText(/^Room/) as HTMLSelectElement;
        expect(roomSelect.value).toBe('');
      });
    });
  });

  describe('form fields', () => {
    it('renders Title input with required indicator', async () => {
      renderPage();
      await screen.findByText('New Maintenance Request');
      const titleInput = screen.getByLabelText(/^Title/) as HTMLInputElement;
      expect(titleInput).toBeInTheDocument();
      // Required indicator asterisk is aria-hidden (rendered by Input component)
      expect(titleInput.required).toBe(true);
    });

    it('renders Description textarea with required indicator', async () => {
      renderPage();
      await screen.findByText('New Maintenance Request');
      expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
    });

    it('renders description hint text', async () => {
      renderPage();
      await screen.findByText('New Maintenance Request');
      expect(screen.getByText('Describe the maintenance issue in detail')).toBeInTheDocument();
    });

    it('renders all four priority radio options', async () => {
      renderPage();
      await screen.findByText('New Maintenance Request');
      expect(screen.getByRole('radio', { name: 'low' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'medium' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'high' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'urgent' })).toBeInTheDocument();
    });

    it('defaults to medium priority', async () => {
      renderPage();
      await screen.findByText('New Maintenance Request');
      expect(screen.getByRole('radio', { name: 'medium' })).toBeChecked();
    });

    it('renders priority radio group with proper aria-label', async () => {
      renderPage();
      await screen.findByText('New Maintenance Request');
      expect(screen.getByRole('radiogroup', { name: /Priority level/i })).toBeInTheDocument();
    });
  });

  describe('form validation', () => {
    it('shows error toast when submitting without filling required fields', async () => {
      const { container } = renderPage();

      await screen.findByText('New Maintenance Request');

      const form = container.querySelector('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Please fill in all required fields')).toBeInTheDocument();
      });
    });

    it('shows error toast when only property and room are selected (no title/description)', async () => {
      const user = userEvent.setup();
      const { container } = renderPage();

      await screen.findByText('Sunset Tower');
      await user.selectOptions(screen.getByLabelText(/^Property/), 'p1');
      await waitFor(() => screen.getByLabelText(/^Room/));
      await user.selectOptions(screen.getByLabelText(/^Room/), 'r1');

      const form = container.querySelector('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Please fill in all required fields')).toBeInTheDocument();
      });
    });

    it('shows error toast when title is empty but other fields are filled', async () => {
      const user = userEvent.setup();
      const { container } = renderPage();

      await screen.findByText('Sunset Tower');
      await user.selectOptions(screen.getByLabelText(/^Property/), 'p1');
      await waitFor(() => screen.getByLabelText(/^Room/));
      await user.selectOptions(screen.getByLabelText(/^Room/), 'r1');
      await user.type(screen.getByLabelText(/^Title/), '   ');
      await user.type(screen.getByLabelText(/Description/), 'Some description');

      const form = container.querySelector('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Please fill in all required fields')).toBeInTheDocument();
      });
    });
  });

  describe('form submission', () => {
    it('submits form successfully with valid data', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Sunset Tower');
      await user.selectOptions(screen.getByLabelText(/^Property/), 'p1');
      await waitFor(() => screen.getByLabelText(/^Room/));
      await user.selectOptions(screen.getByLabelText(/^Room/), 'r1');
      await user.type(screen.getByLabelText(/^Title/), 'Broken window');
      await user.type(screen.getByLabelText(/Description/), 'Window in living room will not close');
      await user.click(screen.getByRole('radio', { name: 'high' }));

      await user.click(screen.getByRole('button', { name: 'Submit Request' }));

      // Success toast should appear
      expect(await screen.findByText('Maintenance request created')).toBeInTheDocument();

      // Should navigate back to maintenance list
      expect(await screen.findByText('Maintenance List')).toBeInTheDocument();
    });

    it('submits with default priority (medium) when no priority selected', async () => {
      const user = userEvent.setup();
      const submitSpy = vi.fn();

      server.use(
        http.post('*/api/v1/maintenance', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          submitSpy(body);
          return HttpResponse.json({
            data: {
              id: 'maint-new',
              property_id: body?.property_id ?? 'p1',
              room_id: body?.room_id ?? 'r1',
              title: body?.title ?? 'New Request',
              description: body?.description ?? 'Description',
              priority: body?.priority ?? 'medium',
              status: 'pending',
              assigned_to: null,
              created_by: 'user-1',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          });
        }),
      );

      renderPage();

      await screen.findByText('Sunset Tower');
      await user.selectOptions(screen.getByLabelText(/^Property/), 'p1');
      await waitFor(() => screen.getByLabelText(/^Room/));
      await user.selectOptions(screen.getByLabelText(/^Room/), 'r1');
      await user.type(screen.getByLabelText(/^Title/), 'Leaky pipe');
      await user.type(screen.getByLabelText(/Description/), 'Pipe under sink is leaking');

      // Don't select a priority — default should be 'medium'
      await user.click(screen.getByRole('button', { name: 'Submit Request' }));

      await waitFor(() => {
        expect(submitSpy).toHaveBeenCalled();
      });

      expect(submitSpy.mock.calls[0]?.[0]?.priority).toBe('medium');
    });

    it('sends correct payload with urgent priority', async () => {
      const user = userEvent.setup();
      const submitSpy = vi.fn();

      server.use(
        http.post('*/api/v1/maintenance', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          submitSpy(body);
          return HttpResponse.json({
            data: {
              id: 'maint-new',
              property_id: body?.property_id ?? 'p1',
              room_id: body?.room_id ?? 'r1',
              title: body?.title ?? 'New Request',
              description: body?.description ?? 'Description',
              priority: body?.priority ?? 'medium',
              status: 'pending',
              assigned_to: null,
              created_by: 'user-1',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          }, { status: 201 });
        }),
      );

      renderPage();

      await screen.findByText('Sunset Tower');
      await user.selectOptions(screen.getByLabelText(/^Property/), 'p1');
      await waitFor(() => screen.getByLabelText(/^Room/));
      await user.selectOptions(screen.getByLabelText(/^Room/), 'r1');
      await user.type(screen.getByLabelText(/^Title/), 'Urgent pipe burst');
      await user.type(screen.getByLabelText(/Description/), 'Main water pipe burst on ground floor');
      await user.click(screen.getByRole('radio', { name: 'urgent' }));

      await user.click(screen.getByRole('button', { name: 'Submit Request' }));

      await waitFor(() => {
        expect(submitSpy).toHaveBeenCalled();
      });

      const payload = submitSpy.mock.calls[0]?.[0];
      expect(payload.property_id).toBe('p1');
      expect(payload.room_id).toBe('r1');
      expect(payload.title).toBe('Urgent pipe burst');
      expect(payload.description).toBe('Main water pipe burst on ground floor');
      expect(payload.priority).toBe('urgent');
    });

    it('shows error toast when creation fails', async () => {
      server.use(
        http.post('*/api/v1/maintenance', () => {
          return HttpResponse.json(
            { error: { code: 'VAL-400', message: 'Room is already under maintenance' } },
            { status: 400 },
          );
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Sunset Tower');
      await user.selectOptions(screen.getByLabelText(/^Property/), 'p1');
      await waitFor(() => screen.getByLabelText(/^Room/));
      await user.selectOptions(screen.getByLabelText(/^Room/), 'r1');
      await user.type(screen.getByLabelText(/^Title/), 'Test request');
      await user.type(screen.getByLabelText(/Description/), 'Test description');

      await user.click(screen.getByRole('button', { name: 'Submit Request' }));

      expect(await screen.findByText('Room is already under maintenance')).toBeInTheDocument();
    });

    it('shows generic error message when error is not an Error instance', async () => {
      server.use(
        http.post('*/api/v1/maintenance', () => {
          return HttpResponse.json(
            { error: { code: 'SYS-500', message: 'Creation failed' } },
            { status: 500 },
          );
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Sunset Tower');
      await user.selectOptions(screen.getByLabelText(/^Property/), 'p1');
      await waitFor(() => screen.getByLabelText(/^Room/));
      await user.selectOptions(screen.getByLabelText(/^Room/), 'r1');
      await user.type(screen.getByLabelText(/^Title/), 'Test request');
      await user.type(screen.getByLabelText(/Description/), 'Test description');

      await user.click(screen.getByRole('button', { name: 'Submit Request' }));

      expect(await screen.findByText('Creation failed')).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('navigates back to maintenance list when Cancel is clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('New Maintenance Request');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(await screen.findByText('Maintenance List')).toBeInTheDocument();
    });
  });

  describe('loading state during submission', () => {
    it('shows loading state on Submit button while creating', async () => {
      server.use(
        http.post('*/api/v1/maintenance', async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return HttpResponse.json({
            data: {
              id: 'maint-new',
              property_id: 'p1',
              room_id: 'r1',
              title: 'Test',
              description: 'Test desc',
              priority: 'medium',
              status: 'pending',
              assigned_to: null,
              created_by: 'user-1',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          }, { status: 201 });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Sunset Tower');
      await user.selectOptions(screen.getByLabelText(/^Property/), 'p1');
      await waitFor(() => screen.getByLabelText(/^Room/));
      await user.selectOptions(screen.getByLabelText(/^Room/), 'r1');
      await user.type(screen.getByLabelText(/^Title/), 'Test');
      await user.type(screen.getByLabelText(/Description/), 'Test desc');

      await user.click(screen.getByRole('button', { name: 'Submit Request' }));

      // Button should be disabled during submission
      const submitBtn = screen.getByRole('button', { name: 'Submit Request' });
      expect(submitBtn).toBeDisabled();
      expect(submitBtn).toHaveAttribute('aria-busy', 'true');
    });
  });
});
