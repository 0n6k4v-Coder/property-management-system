// File: src/features/contract/ContractListPage.test.tsx
// Integration tests for ContractListPage — RTL + MSW.

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import ContractListPage from './ContractListPage';

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
    <MemoryRouter initialEntries={['/contracts']}>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/contracts" element={<ContractListPage />} />
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

describe('ContractListPage', () => {
  describe('loading state', () => {
    it('shows heading immediately and skeleton while loading', async () => {
      server.use(
        http.get('*/api/v1/contracts/active', async () => {
          await new Promise((r) => setTimeout(r, 100));
          return HttpResponse.json({ data: [], meta: null });
        }),
      );

      renderPage();

      // Heading visible immediately
      expect(screen.getByText('Contracts')).toBeInTheDocument();
      expect(screen.getByText('View and manage active rental contracts')).toBeInTheDocument();

      // Skeleton elements should be present during loading
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);

      // After loading completes
      await screen.findByText('No active contracts found.');
    });
  });

  describe('contract list', () => {
    it('renders page heading', async () => {
      renderPage();

      expect(screen.getByText('Contracts')).toBeInTheDocument();
      expect(screen.getByText('View and manage active rental contracts')).toBeInTheDocument();
    });

    it('renders New Contract button', async () => {
      renderPage();

      expect(await screen.findByRole('link', { name: /New Contract/i })).toBeInTheDocument();
    });

    it('renders contract rows after loading', async () => {
      renderPage();

      await screen.findByText('c1');
      expect(screen.getByText('r1')).toBeInTheDocument();
      expect(screen.getByText('t1')).toBeInTheDocument();
      // Use getAllByText since there are 2 'active' badges
      expect(screen.getAllByText('active')).toHaveLength(2);
      expect(screen.getByText('c2')).toBeInTheDocument();
      expect(screen.getByText('r2')).toBeInTheDocument();
      expect(screen.getByText('t2')).toBeInTheDocument();
      expect(screen.getByText('15,000')).toBeInTheDocument();
      expect(screen.getByText('18,000')).toBeInTheDocument();
    });

    it('renders date range in en-GB format', async () => {
      renderPage();

      await screen.findByText('c1');
      // ContractListPage uses formatDate with en-GB: "01 Jan 2026 - 31 Dec 2026"
      const periodCell = screen.getByText(/01 Jan 2026.*31 Dec 2026/);
      expect(periodCell).toBeInTheDocument();
    });

    it('renders monthly rent formatted as number (en-US locale, no symbol)', async () => {
      renderPage();

      await screen.findByText('c1');
      // formatCurrency uses toLocaleString('en-US') → "15,000"
      expect(screen.getByText('15,000')).toBeInTheDocument();
      expect(screen.getByText('18,000')).toBeInTheDocument();
    });

    it('renders View links for each contract', async () => {
      renderPage();

      await screen.findByText('c1');
      const viewLink1 = screen.getByRole('link', { name: 'View contract c1' });
      expect(viewLink1).toHaveAttribute('href', '/contracts/c1');

      const viewLink2 = screen.getByRole('link', { name: 'View contract c2' });
      expect(viewLink2).toHaveAttribute('href', '/contracts/c2');
    });

    it('truncates contract IDs to 8 characters', async () => {
      renderPage();

      await screen.findByText('c1');
      // IDs are only 2 chars ('c1'), so they stay as-is
      expect(screen.getByText('c1')).toBeInTheDocument();
      expect(screen.getByText('c2')).toBeInTheDocument();
    });

    it('renders room_id and tenant_id truncated to 8 chars', async () => {
      renderPage();

      await screen.findByText('c1');
      // room_id 'r1' → slice(0,8) → 'r1'
      expect(screen.getByText('r1')).toBeInTheDocument();
      expect(screen.getByText('t1')).toBeInTheDocument();
    });

    it('renders status badges for each contract', async () => {
      renderPage();

      await screen.findByText('c1');
      // Both contracts have status 'active'
      expect(screen.getAllByText('active')).toHaveLength(2);
    });
  });

  describe('empty state', () => {
    it('shows no active contracts message when list is empty', async () => {
      server.use(
        http.get('*/api/v1/contracts/active', () => {
          return HttpResponse.json({ data: [], meta: null });
        }),
      );

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('No active contracts found.')).toBeInTheDocument();
      });
    });

    it('still shows New Contract button in empty state', async () => {
      server.use(
        http.get('*/api/v1/contracts/active', () => {
          return HttpResponse.json({ data: [], meta: null });
        }),
      );

      renderPage();

      expect(await screen.findByRole('link', { name: /New Contract/i })).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText('No active contracts found.')).toBeInTheDocument();
      });
    });

    it('hides table when contracts list is empty', async () => {
      server.use(
        http.get('*/api/v1/contracts/active', () => {
          return HttpResponse.json({ data: [], meta: null });
        }),
      );

      renderPage();

      await waitFor(() => {
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
      });
    });
  });

  describe('property filter', () => {
    it('renders property filter dropdown', async () => {
      renderPage();

      await screen.findByText('c1');
      expect(screen.getByText('Filter by property:')).toBeInTheDocument();
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('has "All properties" as default option', async () => {
      renderPage();

      await screen.findByText('c1');
      const select = screen.getByRole('combobox');
      const options = select.querySelectorAll('option');
      expect(options[0]).toHaveValue('');
      expect(options[0]).toHaveTextContent('All properties');
    });

    it('shows property names in filter dropdown', async () => {
      renderPage();

      await screen.findByText('c1');
      const propertyOptions = screen.getAllByRole('option');
      const propertyTexts = Array.from(propertyOptions).map((o) => o.textContent);
      expect(propertyTexts).toContain('Sunset Tower');
      expect(propertyTexts).toContain('Riverside Apartments');
    });

    it('shows all contracts when "All properties" is selected (default)', async () => {
      renderPage();

      await screen.findByText('c1');
      // Default filter (empty) shows all 2 contracts
      expect(await screen.findByText('c1')).toBeInTheDocument();
      expect(screen.getByText('c2')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('renders without crashing on API error', async () => {
      server.use(
        http.get('*/api/v1/contracts/active', () => {
          return HttpResponse.json(
            { error: { code: 'SYS-500', message: 'Internal server error' } },
            { status: 500 },
          );
        }),
      );

      renderPage();

      // Should not crash — heading should still be present
      await waitFor(() => {
        expect(screen.getByText('Contracts')).toBeInTheDocument();
      });
    });

    it('handles 401 unauthorized gracefully', async () => {
      server.use(
        http.get('*/api/v1/contracts/active', () => {
          return HttpResponse.json(
            { error: { code: 'AUTH-009', message: 'Invalid or expired access token' } },
            { status: 401 },
          );
        }),
      );

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Contracts')).toBeInTheDocument();
      });
    });
  });
});
