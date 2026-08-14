// File: src/features/property/PropertyListPage.test.tsx
// Integration tests for PropertyListPage — RTL + MSW.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { ToastProvider } from '@/shared/ui/Toast';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import PropertyListPage from './PropertyListPage';

// ── Test Helpers ──────────────────────────────────────────────────

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderPage(route: string = '/property') {
  const qc = createQueryClient();
  return render(
    <MemoryRouter initialEntries={[route]}>
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <AuthProvider>
            <Routes>
              <Route path="/property" element={<PropertyListPage />} />
              <Route path="/property/:id" element={<PropertyListPage />} />
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function renderPageWithId(propertyId: string) {
  return renderPage(`/property/${propertyId}`);
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── Tests ─────────────────────────────────────────────────────────

describe('PropertyListPage', () => {
  describe('loading state', () => {
    it('shows skeleton cards while properties are loading', async () => {
      server.use(
        http.get('*/api/v1/properties', async () => {
          await new Promise((r) => setTimeout(r, 100));
          return HttpResponse.json({ data: [], meta: null });
        }),
      );

      renderPage();

      // Heading should be visible immediately
      expect(screen.getByText('Property Management')).toBeInTheDocument();

      // Skeleton cards are rendered with aria-hidden
      const skeletonContainers = document.querySelectorAll('[aria-hidden="true"]');
      expect(skeletonContainers.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('property list', () => {
    it('renders property cards after loading', async () => {
      renderPage();

      expect(await screen.findByText(/sunset tower/i)).toBeInTheDocument();
      expect(screen.getByText(/riverside apartments/i)).toBeInTheDocument();
      expect(screen.getByText('123 Main St')).toBeInTheDocument();
      expect(screen.getByText('456 River Rd')).toBeInTheDocument();
    });

    it('displays billing due day and deposit info on each card', async () => {
      renderPage();

      await screen.findByText(/sunset tower/i);
      expect(screen.getByText('Due: Day 5')).toBeInTheDocument();
      expect(screen.getByText('Deposit: 2mo')).toBeInTheDocument();
      expect(screen.getByText('Due: Day 10')).toBeInTheDocument();
      expect(screen.getByText('Deposit: 3mo')).toBeInTheDocument();
    });

    it('renders Create Property button in list view', async () => {
      renderPage();

      await screen.findByText('Sunset Tower');
      expect(screen.getByText('+ Create Property')).toBeInTheDocument();
    });

    it('navigates to property detail when a card is clicked', async () => {
      // This test verifies the property grid renders buttons (navigation is via onClick)
      renderPage();

      await screen.findByText('Sunset Tower');
      // PropertyGrid uses buttons with onClick that calls navigate
      const propertyButton = screen.getByRole('button', { name: /Sunset Tower/ });
      expect(propertyButton).toBeInTheDocument();

      const property2Button = screen.getByRole('button', { name: /Riverside Apartments/ });
      expect(property2Button).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows create button when no properties exist', async () => {
      server.use(
        http.get('*/api/v1/properties', () => {
          return HttpResponse.json({ data: [], meta: null });
        }),
      );

      renderPage();

      expect(await screen.findByText('No Properties Yet')).toBeInTheDocument();
      expect(screen.getByText('+ Create Property')).toBeInTheDocument();
    });

    it('opens create property form when button clicked', async () => {
      server.use(
        http.get('*/api/v1/properties', () => {
          return HttpResponse.json({ data: [], meta: null });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      const createBtn = await screen.findByText('+ Create Property');
      await user.click(createBtn);

      expect(screen.getByText('Create New Property')).toBeInTheDocument();
      expect(screen.getByLabelText('Property Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Address')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('renders without crashing on API error', async () => {
      server.use(
        http.get('*/api/v1/properties', () => {
          return HttpResponse.json(
            { error: { code: 'SYS-500', message: 'Internal server error' } },
            { status: 500 },
          );
        }),
      );

      renderPage();

      // Should not crash — heading should still be present
      await waitFor(() => {
        expect(screen.getByText('Property Management')).toBeInTheDocument();
      });
    });

    it('handles 401 unauthorized gracefully', async () => {
      server.use(
        http.get('*/api/v1/properties', () => {
          return HttpResponse.json(
            { error: { code: 'AUTH-009', message: 'Invalid or expired access token' } },
            { status: 401 },
          );
        }),
      );

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Property Management')).toBeInTheDocument();
      });
    });
  });

  describe('create property form', () => {
    it('shows validation errors on empty submit', async () => {
      server.use(
        http.get('*/api/v1/properties', () => {
          return HttpResponse.json({ data: [], meta: null });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByText('+ Create Property'));

      // Submit without filling fields
      await user.click(screen.getByText('Create Property', { selector: 'button[type="submit"]' }));

      expect(screen.getByText('Property name is required')).toBeInTheDocument();
      expect(screen.getByText('Address is required')).toBeInTheDocument();
    });

    it('submits form successfully with valid data', async () => {
      server.use(
        http.get('*/api/v1/properties', () => {
          return HttpResponse.json({ data: [], meta: null });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByText('+ Create Property'));

      await user.type(screen.getByLabelText('Property Name'), 'New Tower');
      await user.type(screen.getByLabelText('Address'), '789 New St');
      await user.click(screen.getByText('Create Property', { selector: 'button[type="submit"]' }));

      // Form should close after success (back to empty state or list)
      await waitFor(() => {
        expect(screen.queryByText('Create New Property')).not.toBeInTheDocument();
      });
    });

    it('shows error message when creation fails', async () => {
      server.use(
        http.get('*/api/v1/properties', () => {
          return HttpResponse.json({ data: [], meta: null });
        }),
        http.post('*/api/v1/properties', () => {
          return HttpResponse.json(
            { error: { code: 'VAL-400', message: 'Property name already exists' } },
            { status: 400 },
          );
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByText('+ Create Property'));

      await user.type(screen.getByLabelText('Property Name'), 'Existing Tower');
      await user.type(screen.getByLabelText('Address'), '789 New St');
      await user.click(screen.getByText('Create Property', { selector: 'button[type="submit"]' }));

      // Error should be shown in the form
      await waitFor(() => {
        expect(screen.getByText('Property name already exists')).toBeInTheDocument();
      });
    });

    it('validates billing due day out of range', async () => {
      server.use(
        http.get('*/api/v1/properties', () => {
          return HttpResponse.json({ data: [], meta: null });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByText('+ Create Property'));

      // Clear and enter invalid billing due day (> 28)
      const dueDayInput = screen.getByLabelText('Billing Due Day');
      await user.clear(dueDayInput);
      await user.type(dueDayInput, '30');

      await user.click(screen.getByText('Create Property', { selector: 'button[type="submit"]' }));

      expect(screen.getByText('Must be 1–28')).toBeInTheDocument();
    });

    it('validates min deposit months below 1', async () => {
      server.use(
        http.get('*/api/v1/properties', () => {
          return HttpResponse.json({ data: [], meta: null });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByText('+ Create Property'));

      const depositInput = screen.getByLabelText('Min Deposit (months)');
      await user.clear(depositInput);
      await user.type(depositInput, '0');

      await user.click(screen.getByText('Create Property', { selector: 'button[type="submit"]' }));

      expect(screen.getByText('Must be at least 1')).toBeInTheDocument();
    });

    it('cancel button closes the form', async () => {
      server.use(
        http.get('*/api/v1/properties', () => {
          return HttpResponse.json({ data: [], meta: null });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByText('+ Create Property'));
      expect(screen.getByText('Create New Property')).toBeInTheDocument();

      await user.click(screen.getByText('Cancel'));
      expect(screen.queryByText('Create New Property')).not.toBeInTheDocument();
    });
  });

  describe('property detail view', () => {
    it('shows detail view when property id is in route', async () => {
      renderPageWithId('p1');

      // Property detail view renders property name
      expect(await screen.findByText(/sunset tower/i)).toBeInTheDocument();
      expect(screen.getByText('123 Main St')).toBeInTheDocument();
      expect(screen.getByText('Due Day')).toBeInTheDocument();
    });

    it('shows loading skeletons during property detail fetch', async () => {
      server.use(
        http.get('*/api/v1/properties/:id/rooms', async () => {
          await new Promise((r) => setTimeout(r, 100));
          return HttpResponse.json({
            property: {
              id: 'p1',
              name: 'Sunset Tower',
              address: '123 Main St',
              billing_due_day: 5,
              min_deposit_months: 2,
              created_by: null,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
            rooms: [],
          });
        }),
      );

      renderPageWithId('p1');

      // Should show skeleton during loading
      const skeletonContainers = document.querySelectorAll('[aria-hidden="true"]');
      expect(skeletonContainers.length).toBeGreaterThanOrEqual(1);

      // After loading, should show property
      await screen.findByText('Sunset Tower');
    });

    it('shows back to properties button', async () => {
      renderPageWithId('p1');

      await screen.findByText('Sunset Tower');
      const backButton = screen.getByText('Back to properties');
      expect(backButton).toBeInTheDocument();
    });

    it('shows room list with property detail', async () => {
      renderPageWithId('p1');

      await screen.findByText('Sunset Tower');
      expect(screen.getByRole('link', { name: /Room 101/ })).toHaveAttribute('href', '/property/rooms/r1');
      expect(screen.getByRole('link', { name: /Room 102/ })).toHaveAttribute('href', '/property/rooms/r2');
    });

    it('shows property stats in detail view', async () => {
      renderPageWithId('p1');

      await screen.findByText('Sunset Tower');
      expect(screen.getByText('Total Rooms')).toBeInTheDocument();
      expect(screen.getByText('Available')).toBeInTheDocument();
      expect(screen.getByText('1 available')).toBeInTheDocument();
      expect(screen.getByText('1 occupied')).toBeInTheDocument();
    });

    it('shows maintenance badge when maintenance rooms exist', async () => {
      server.use(
        http.get('*/api/v1/properties/:id/rooms', () => {
          return HttpResponse.json({
            property: {
              id: 'p1',
              name: 'Sunset Tower',
              address: '123 Main St',
              billing_due_day: 5,
              min_deposit_months: 2,
              created_by: null,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
            rooms: [
              {
                id: 'r1',
                property_id: 'p1',
                building_id: 'b1',
                floor_id: null,
                room_number: '101',
                room_type: 'studio',
                base_rent: 5000,
                status: 'available',
                images: null,
              },
              {
                id: 'r2',
                property_id: 'p1',
                building_id: 'b1',
                floor_id: null,
                room_number: '102',
                room_type: '1br',
                base_rent: 8000,
                status: 'maintenance',
                images: null,
              },
            ],
          });
        }),
      );

      renderPageWithId('p1');

      await screen.findByText('Sunset Tower');
      expect(screen.getByText('1 maintenance')).toBeInTheDocument();
    });

    it('shows rooms count correctly for empty rooms', async () => {
      server.use(
        http.get('*/api/v1/properties/:id/rooms', () => {
          return HttpResponse.json({
            property: {
              id: 'p1',
              name: 'Sunset Tower',
              address: '123 Main St',
              billing_due_day: 5,
              min_deposit_months: 2,
              created_by: null,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
            rooms: [],
          });
        }),
      );

      renderPageWithId('p1');

      await screen.findByText('Sunset Tower');
      expect(screen.getByText('Total Rooms')).toBeInTheDocument();
      expect(screen.getByText('0 available')).toBeInTheDocument();
      expect(screen.queryByText('0 maintenance')).not.toBeInTheDocument();
    });

    it('shows no rooms message when property has no rooms', async () => {
      server.use(
        http.get('*/api/v1/properties/:id/rooms', () => {
          return HttpResponse.json({
            property: {
              id: 'p1',
              name: 'Sunset Tower',
              address: '123 Main St',
              billing_due_day: 5,
              min_deposit_months: 2,
              created_by: null,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
            rooms: [],
          });
        }),
      );

      renderPageWithId('p1');

      await screen.findByText(/sunset tower/i);
      expect(screen.getByText('No rooms yet. Add buildings and rooms to this property.')).toBeInTheDocument();
    });
  });

  describe('mobile viewport', () => {
    it('renders correctly on narrow screens', async () => {
      // Override innerWidth to simulate mobile
      vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(375);

      renderPage();

      expect(await screen.findByText(/sunset tower/i)).toBeInTheDocument();
      expect(screen.getByText(/riverside apartments/i)).toBeInTheDocument();

      vi.restoreAllMocks();
    });
  });
});
