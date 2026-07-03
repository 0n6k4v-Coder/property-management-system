// File: src/features/property/PropertyListPage.test.tsx
// Integration tests for PropertyListPage — RTL + MSW.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
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

function renderPage() {
  const qc = createQueryClient();
  return render(
    <MemoryRouter initialEntries={['/property']}>
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <AuthProvider>
            <PropertyListPage />
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
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

      // Skeleton cards are rendered with aria-hidden (3 skeletons)
      const skeletonContainers = document.querySelectorAll('[aria-hidden="true"]');
      expect(skeletonContainers.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('property list', () => {
    it('renders property cards after loading', async () => {
      renderPage();

      expect(await screen.findByText('Sunset Tower')).toBeInTheDocument();
      expect(screen.getByText('Riverside Apartments')).toBeInTheDocument();
      expect(screen.getByText('123 Main St')).toBeInTheDocument();
      expect(screen.getByText('456 River Rd')).toBeInTheDocument();
    });

    it('displays billing due day and deposit info on each card', async () => {
      renderPage();

      await screen.findByText('Sunset Tower');
      expect(screen.getByText('Due: Day 5')).toBeInTheDocument();
      expect(screen.getByText('Deposit: 2mo')).toBeInTheDocument();
      expect(screen.getByText('Due: Day 10')).toBeInTheDocument();
      expect(screen.getByText('Deposit: 3mo')).toBeInTheDocument();
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

  describe('mobile viewport', () => {
    it('renders correctly on narrow screens', async () => {
      // Override innerWidth to simulate mobile
      vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(375);

      renderPage();

      expect(await screen.findByText('Sunset Tower')).toBeInTheDocument();
      expect(screen.getByText('Riverside Apartments')).toBeInTheDocument();

      vi.restoreAllMocks();
    });
  });
});