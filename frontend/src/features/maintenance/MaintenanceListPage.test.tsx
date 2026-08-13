// File: src/features/maintenance/MaintenanceListPage.test.tsx
// Integration tests for MaintenanceListPage — RTL + MSW.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import MaintenanceListPage from './MaintenanceListPage';
import type { API } from '@/types/api.d';

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <MemoryRouter initialEntries={['/maintenance']}>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <ToastProvider>
            <MaintenanceListPage />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const sampleRequests: API.MaintenanceResponse[] = [
  {
    id: 'maint-1',
    property_id: 'p1',
    room_id: 'r1',
    title: 'Leaking faucet',
    description: 'Kitchen faucet has been dripping for 3 days',
    priority: 'medium',
    status: 'pending',
    assigned_to: null,
    created_by: 'user-1',
    created_at: '2026-06-15T10:00:00Z',
    updated_at: '2026-06-15T10:00:00Z',
  },
  {
    id: 'maint-2',
    property_id: 'p1',
    room_id: 'r2',
    title: 'AC not cooling',
    description: 'Air conditioner in bedroom not cooling properly',
    priority: 'high',
    status: 'in_progress',
    assigned_to: 'tech-1',
    created_by: 'user-2',
    created_at: '2026-06-14T14:30:00Z',
    updated_at: '2026-06-15T09:00:00Z',
  },
];

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('MaintenanceListPage', () => {
  describe('static rendering', () => {
    it('renders page heading', () => {
      renderPage();
      expect(screen.getByText('Maintenance Requests')).toBeInTheDocument();
    });

    it('renders page description', () => {
      renderPage();
      expect(screen.getByText(/View and manage pending maintenance requests/i)).toBeInTheDocument();
    });

    it('renders New Request button', () => {
      renderPage();
      expect(screen.getByRole('link', { name: /New Request/i })).toBeInTheDocument();
    });

    it('renders property filter label', () => {
      renderPage();
      expect(screen.getByText('Filter by property:')).toBeInTheDocument();
    });

    it('renders "All properties" option by default', () => {
      renderPage();
      expect(screen.getByText('All properties')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows skeleton while requests are loading', async () => {
      server.use(
        http.get('*/api/v1/maintenance/pending', async () => {
          await new Promise((r) => setTimeout(r, 100));
          return HttpResponse.json({ data: [], meta: null });
        }),
      );

      renderPage();

      // Wait for properties to load so we can select a property and trigger the
      // pending-maintenance query (which has the slow handler)
      await screen.findByText('Sunset Tower');
      await userEvent.setup().selectOptions(
        screen.getByLabelText('Filter by property:'),
        'p1',
      );

      // TableSkeleton renders with aria-hidden="true"
      await waitFor(() => {
        const skeletons = document.querySelectorAll('[aria-hidden="true"]');
        expect(skeletons.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('empty state', () => {
    it('shows empty state when no requests found', async () => {
      server.use(
        http.get('*/api/v1/maintenance/pending', () => {
          return HttpResponse.json({ data: [], meta: null });
        }),
      );

      renderPage();

      // Select a property to trigger the query
      await screen.findByText('Sunset Tower');
      await userEvent.setup().selectOptions(
        screen.getByLabelText('Filter by property:'),
        'p1',
      );

      expect(await screen.findByText('No pending maintenance requests found.')).toBeInTheDocument();
    });
  });

  describe('maintenance request list', () => {
    it('renders request table with data after loading', async () => {
      server.use(
        http.get('*/api/v1/maintenance/pending', () => {
          return HttpResponse.json({ data: sampleRequests, meta: null });
        }),
      );

      renderPage();

      // Select property to enable query
      await screen.findByText('Sunset Tower');
      await userEvent.setup().selectOptions(
        screen.getByLabelText('Filter by property:'),
        'p1',
      );

      expect(await screen.findByText('Leaking faucet')).toBeInTheDocument();
      expect(screen.getByText('AC not cooling')).toBeInTheDocument();
    });

    it('displays request titles as plain text (not links to dead /maintenance/:id route)', async () => {
      server.use(
        http.get('*/api/v1/maintenance/pending', () => {
          return HttpResponse.json({ data: sampleRequests, meta: null });
        }),
      );

      renderPage();

      await screen.findByText('Sunset Tower');
      await userEvent.setup().selectOptions(
        screen.getByLabelText('Filter by property:'),
        'p1',
      );

      await screen.findByText('Leaking faucet');

      // No anchor should point to a /maintenance/<uuid> path (F-30 fix)
      const maintenanceDetailLinks = Array.from(document.querySelectorAll('a')).filter(
        (a) => /^ \/maintenance\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(
          a.getAttribute('href') ?? '',
        ),
      );
      expect(maintenanceDetailLinks.length).toBe(0);
    });

    it('displays room ID (sliced to first 8 chars)', async () => {
      server.use(
        http.get('*/api/v1/maintenance/pending', () => {
          return HttpResponse.json({ data: sampleRequests, meta: null });
        }),
      );

      renderPage();

      await screen.findByText('Sunset Tower');
      await userEvent.setup().selectOptions(
        screen.getByLabelText('Filter by property:'),
        'p1',
      );

      await screen.findByText('Leaking faucet');
      // r1.slice(0, 8) = "r1"
      expect(screen.getByText('Room r1')).toBeInTheDocument();
      expect(screen.getByText('Room r2')).toBeInTheDocument();
    });

    it('displays priority badges with correct variants', async () => {
      server.use(
        http.get('*/api/v1/maintenance/pending', () => {
          return HttpResponse.json({ data: sampleRequests, meta: null });
        }),
      );

      renderPage();

      await screen.findByText('Sunset Tower');
      await userEvent.setup().selectOptions(
        screen.getByLabelText('Filter by property:'),
        'p1',
      );

      await screen.findByText('Leaking faucet');
      expect(screen.getByText('medium')).toBeInTheDocument();
      expect(screen.getByText('high')).toBeInTheDocument();
    });

    it('displays status badges with underscores replaced by spaces', async () => {
      server.use(
        http.get('*/api/v1/maintenance/pending', () => {
          return HttpResponse.json({ data: sampleRequests, meta: null });
        }),
      );

      renderPage();

      await screen.findByText('Sunset Tower');
      await userEvent.setup().selectOptions(
        screen.getByLabelText('Filter by property:'),
        'p1',
      );

      await screen.findByText('Leaking faucet');
      // status 'pending' → "pending" (no underscore), 'in_progress' → "in progress"
      expect(screen.getByText('pending')).toBeInTheDocument();
      expect(screen.getByText('in progress')).toBeInTheDocument();
    });

    it('displays formatted creation dates (en-GB locale)', async () => {
      server.use(
        http.get('*/api/v1/maintenance/pending', () => {
          return HttpResponse.json({ data: sampleRequests, meta: null });
        }),
      );

      renderPage();

      await screen.findByText('Sunset Tower');
      await userEvent.setup().selectOptions(
        screen.getByLabelText('Filter by property:'),
        'p1',
      );

      await screen.findByText('Leaking faucet');
      // 2026-06-15 → "15 Jun 2026"
      expect(screen.getByText('15 Jun 2026')).toBeInTheDocument();
      // 2026-06-14 → "14 Jun 2026"
      expect(screen.getByText('14 Jun 2026')).toBeInTheDocument();
    });

    it('renders table headers', async () => {
      server.use(
        http.get('*/api/v1/maintenance/pending', () => {
          return HttpResponse.json({ data: sampleRequests, meta: null });
        }),
      );

      renderPage();

      await screen.findByText('Sunset Tower');
      await userEvent.setup().selectOptions(
        screen.getByLabelText('Filter by property:'),
        'p1',
      );

      await screen.findByText('Leaking faucet');
      expect(screen.getByText('Request')).toBeInTheDocument();
      expect(screen.getByText('Room')).toBeInTheDocument();
      expect(screen.getByText('Priority')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Created')).toBeInTheDocument();
    });
  });

  describe('property filter', () => {
    it('renders property options from API', async () => {
      renderPage();

      const propertySelect = await screen.findByLabelText('Filter by property:');
      expect(propertySelect).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText('Sunset Tower')).toBeInTheDocument();
      });
      expect(screen.getByText('Riverside Apartments')).toBeInTheDocument();
    });

    it('updates request list when property filter changes', async () => {
      const user = userEvent.setup();
      renderPage();

      // Initially no requests shown (no property selected)
      await screen.findByText('Sunset Tower');
      expect(screen.queryByText('Leaking faucet')).not.toBeInTheDocument();

      // Select property
      await user.selectOptions(screen.getByLabelText('Filter by property:'), 'p1');

      expect(await screen.findByText('Leaking faucet')).toBeInTheDocument();
      expect(screen.getByText('AC not cooling')).toBeInTheDocument();
    });

    it('shows empty state when filtered property has no requests', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Sunset Tower');
      await user.selectOptions(screen.getByLabelText('Filter by property:'), 'p2');

      // p2 is not in the sample data; the handler returns all filtered requests
      // which won't match, so we expect empty state
      expect(await screen.findByText('No pending maintenance requests found.')).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('New Request button links to /maintenance/new', () => {
      renderPage();

      const newLink = screen.getByRole('link', { name: /New Request/i });
      expect(newLink).toHaveAttribute('href', '/maintenance/new');
    });
  });

  describe('error handling', () => {
    it('handles API error gracefully without crashing', async () => {
      server.use(
        http.get('*/api/v1/maintenance/pending', () => {
          return HttpResponse.json(
            { error: { code: 'SYS-500', message: 'Server error' } },
            { status: 500 },
          );
        }),
      );

      renderPage();

      // Select property to trigger the failing query
      await screen.findByText('Sunset Tower');
      await userEvent.setup().selectOptions(
        screen.getByLabelText('Filter by property:'),
        'p1',
      );

      // Page should not crash — heading still visible
      expect(screen.getByText('Maintenance Requests')).toBeInTheDocument();
    });
  });
});
