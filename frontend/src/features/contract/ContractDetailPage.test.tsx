// File: src/features/contract/ContractDetailPage.test.tsx
// Integration tests for ContractDetailPage — RTL + MSW.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import ContractDetailPage from './ContractDetailPage';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderPage(contractId: string = 'c1') {
  const qc = createQueryClient();
  return render(
    <MemoryRouter initialEntries={[`/contracts/${contractId}`]}>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/contracts" element={<div>Contract List</div>} />
              <Route path="/contracts/:id" element={<ContractDetailPage />} />
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

// Helper: wait for contract detail to load
async function waitForContractLoad() {
  await waitFor(() => {
    expect(screen.getByText('Contract Details')).toBeInTheDocument();
  }, { timeout: 5000 });
}

// Helper: get terminated contract
function getTerminatedContractOverride() {
  return http.get('*/api/v1/contracts/:id', () => {
    return HttpResponse.json({
      data: {
        id: 'c1',
        room_id: 'r1',
        tenant_id: 't1',
        property_id: 'p1',
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        monthly_rent: '15000',
        deposit_amount: '30000',
        status: 'terminated',
        special_conditions: null,
        is_renewal: false,
        renewed_from_id: null,
        created_by: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        termination: {
          id: 'term-1',
          reason: 'tenant_moved_out',
          termination_date: '2026-06-15',
          notes: 'Moving to another city',
          terminated_by: 'user-1',
          created_at: '2026-06-15T10:00:00Z',
        },
        extensions: [],
      },
    });
  });
}

// Helper: get contract with no extensions
function getNoExtensionsContractOverride() {
  return http.get('*/api/v1/contracts/:id', () => {
    return HttpResponse.json({
      data: {
        id: 'c1',
        room_id: 'r1',
        tenant_id: 't1',
        property_id: 'p1',
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        monthly_rent: '15000',
        deposit_amount: '30000',
        status: 'active',
        special_conditions: null,
        is_renewal: false,
        renewed_from_id: null,
        created_by: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        termination: null,
        extensions: [],
      },
    });
  });
}

describe('ContractDetailPage', () => {
  describe('loading state', () => {
    it('shows skeleton while loading', async () => {
      server.use(
        http.get('*/api/v1/contracts/:id', async () => {
          await new Promise((r) => setTimeout(r, 100));
          return HttpResponse.json({
            data: {
              id: 'c1',
              room_id: 'r1',
              tenant_id: 't1',
              property_id: 'p1',
              start_date: '2026-01-01',
              end_date: '2026-12-31',
              monthly_rent: '15000',
              deposit_amount: '30000',
              status: 'active',
              special_conditions: null,
              is_renewal: false,
              renewed_from_id: null,
              created_by: 'user-1',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
              termination: null,
              extensions: [],
            },
          });
        }),
      );

      renderPage();

      // Skeleton is rendered during loading
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);

      // After loading
      await screen.findByText('Contract c1');
    });
  });

  describe('rendering — active contract', () => {
    it('shows contract heading with truncated ID', async () => {
      renderPage();

      expect(await screen.findByText('Contract c1')).toBeInTheDocument();
    });

    it('shows back to contracts link', async () => {
      renderPage();

      await screen.findByText('Contract c1');
      const backLink = screen.getByText('← Back to contracts');
      expect(backLink).toHaveAttribute('href', '/contracts');
    });

    it('shows status badge', async () => {
      renderPage();

      await screen.findByText('Contract c1');
      expect(screen.getByText('active')).toBeInTheDocument();
    });

    it('shows Extend Lease and Terminate buttons for active contracts', async () => {
      renderPage();

      await screen.findByText('Contract c1');
      expect(screen.getByRole('button', { name: 'Extend Lease' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Terminate' })).toBeInTheDocument();
    });

    it('hides Renew Contract button for active contracts', async () => {
      renderPage();

      await screen.findByText('Contract c1');
      expect(screen.queryByRole('button', { name: 'Renew Contract' })).not.toBeInTheDocument();
    });
  });

  describe('rendering — terminated contract', () => {
    it('shows Renew Contract button for terminated contracts', async () => {
      server.use(getTerminatedContractOverride());

      renderPage();

      await screen.findByText('Contract c1');
      expect(screen.getByRole('button', { name: 'Renew Contract' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Extend Lease' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Terminate' })).not.toBeInTheDocument();
    });

    it('shows termination record section', async () => {
      server.use(getTerminatedContractOverride());

      renderPage();

      await waitForContractLoad();
      expect(screen.getByText('Termination Record')).toBeInTheDocument();
      expect(screen.getByText('Reason')).toBeInTheDocument();
      expect(screen.getByText('tenant_moved_out')).toBeInTheDocument();
      expect(screen.getByText('Termination Date')).toBeInTheDocument();
      // formatDate uses en-GB: "15 Jun 2026"
      expect(screen.getByText('15 Jun 2026')).toBeInTheDocument();
      expect(screen.getByText('Notes')).toBeInTheDocument();
      expect(screen.getByText('Moving to another city')).toBeInTheDocument();
    });

    it('hides termination notes when notes is null', async () => {
      server.use(
        http.get('*/api/v1/contracts/:id', () => {
          return HttpResponse.json({
            data: {
              id: 'c1',
              room_id: 'r1',
              tenant_id: 't1',
              property_id: 'p1',
              start_date: '2026-01-01',
              end_date: '2026-12-31',
              monthly_rent: '15000',
              deposit_amount: '30000',
              status: 'terminated',
              special_conditions: null,
              is_renewal: false,
              renewed_from_id: null,
              created_by: 'user-1',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
              termination: {
                id: 'term-1',
                reason: 'breach_of_contract',
                termination_date: '2026-06-15',
                notes: null,
                terminated_by: 'user-1',
                created_at: '2026-06-15T10:00:00Z',
              },
              extensions: [],
            },
          });
        }),
      );

      renderPage();

      await waitForContractLoad();
      expect(screen.getByText('Termination Record')).toBeInTheDocument();
      expect(screen.queryByText('Moving to another city')).not.toBeInTheDocument();
    });
  });

  describe('rendering — contract details section', () => {
    it('shows contract details section with all fields', async () => {
      renderPage();

      await waitForContractLoad();
      expect(screen.getByText('Contract Details')).toBeInTheDocument();
      expect(screen.getByText('Room ID')).toBeInTheDocument();
      expect(screen.getByText('Tenant ID')).toBeInTheDocument();
      expect(screen.getByText('Start Date')).toBeInTheDocument();
      expect(screen.getByText('End Date')).toBeInTheDocument();
      expect(screen.getByText('Monthly Rent')).toBeInTheDocument();
      expect(screen.getByText('Deposit Amount')).toBeInTheDocument();
      expect(screen.getByText('Is Renewal')).toBeInTheDocument();
    });

    it('shows formatted dates', async () => {
      renderPage();

      await waitForContractLoad();
      // formatDate uses en-GB: "01 Jan 2026"
      expect(screen.getByText('01 Jan 2026')).toBeInTheDocument();
      // "31 Dec 2026" appears in both Contract Details and Extensions section
      expect(screen.getAllByText('31 Dec 2026').length).toBeGreaterThanOrEqual(1);
    });

    it('shows formatted currency values', async () => {
      renderPage();

      await waitForContractLoad();
      // formatCurrency uses toLocaleString('en-US') → "15,000"
      expect(screen.getByText('15,000')).toBeInTheDocument();
      expect(screen.getByText('30,000')).toBeInTheDocument();
    });

    it('shows Is Renewal as No', async () => {
      renderPage();

      await waitForContractLoad();
      expect(screen.getByText('No')).toBeInTheDocument();
    });

    it('shows special conditions when present', async () => {
      server.use(
        http.get('*/api/v1/contracts/:id', () => {
          return HttpResponse.json({
            data: {
              id: 'c1',
              room_id: 'r1',
              tenant_id: 't1',
              property_id: 'p1',
              start_date: '2026-01-01',
              end_date: '2026-12-31',
              monthly_rent: '15000',
              deposit_amount: '30000',
              status: 'active',
              special_conditions: 'No smoking policy',
              is_renewal: false,
              renewed_from_id: null,
              created_by: 'user-1',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
              termination: null,
              extensions: [],
            },
          });
        }),
      );

      renderPage();

      await waitForContractLoad();
      expect(screen.getByText('Special Conditions')).toBeInTheDocument();
      expect(screen.getByText('No smoking policy')).toBeInTheDocument();
    });

    it('hides special conditions section when not present', async () => {
      renderPage();

      await waitForContractLoad();
      expect(screen.queryByText('Special Conditions')).not.toBeInTheDocument();
    });
  });

  describe('rendering — extensions section', () => {
    it('shows extensions section when contract has extensions', async () => {
      renderPage();

      await waitForContractLoad();
      expect(screen.getByText('Lease Extensions')).toBeInTheDocument();
      expect(screen.getByText('Previous End Date')).toBeInTheDocument();
      expect(screen.getByText('Extended To')).toBeInTheDocument();
      expect(screen.getByText('Reason')).toBeInTheDocument();
      // formatDate for previous_end_date '2025-12-31' → '31 Dec 2025'
      expect(screen.getByText('31 Dec 2025')).toBeInTheDocument();
      // "31 Dec 2026" appears in both Contract Details section and Extensions table
      expect(screen.getAllByText('31 Dec 2026').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Tenant requested extension')).toBeInTheDocument();
    });

    it('hides extensions section when contract has no extensions', async () => {
      server.use(getNoExtensionsContractOverride());

      renderPage();

      await waitForContractLoad();
      expect(screen.queryByText('Lease Extensions')).not.toBeInTheDocument();
    });
  });

  describe('not found state', () => {
    it('shows not found message when contract fetch fails', async () => {
      server.use(
        http.get('*/api/v1/contracts/:id', () => {
          return HttpResponse.json(
            { error: { code: 'NOT-404', message: 'Contract not found' } },
            { status: 404 },
          );
        }),
      );

      renderPage('c999');

      await waitFor(() => {
        expect(screen.getByText('Contract not found.')).toBeInTheDocument();
      });

      const backLink = screen.getByText('Back to contracts');
      expect(backLink).toHaveAttribute('href', '/contracts');
    });
  });

  describe('terminate workflow', () => {
    it('opens terminate modal when Terminate button is clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Contract c1');
      await user.click(screen.getByRole('button', { name: 'Terminate' }));

      expect(await screen.findByText('Terminate Contract')).toBeInTheDocument();
    });

    it('closes terminate modal when Cancel is clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Contract c1');
      await user.click(screen.getByRole('button', { name: 'Terminate' }));
      await screen.findByText('Terminate Contract');

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByText('Terminate Contract')).not.toBeInTheDocument();
      });
    });

    it('shows success toast and closes modal after terminating', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Contract c1');
      await user.click(screen.getByRole('button', { name: 'Terminate' }));
      // Wait for modal dialog to open
      await screen.findByRole('dialog', { name: 'Terminate Contract' });

      await user.selectOptions(screen.getByLabelText(/^Reason/), 'tenant_moved_out');
      // The modal's submit button is named 'Terminate' — but so is the page button.
      // Find the button inside the dialog.
      const dialog = screen.getByRole('dialog', { name: 'Terminate Contract' });
      const submitBtn = dialog.querySelector('button[type="submit"]')!;
      await user.click(submitBtn);

      // Modal closes after successful mutation (parent handles setModalMode(null))
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Terminate Contract' })).not.toBeInTheDocument();
      });
      // Success toast should appear
      await waitFor(() => {
        expect(screen.getByText('Contract terminated successfully')).toBeInTheDocument();
      });
    });

    it('shows error toast when termination fails', async () => {
      server.use(
        http.patch('*/api/v1/contracts/:id/terminate', () => {
          return HttpResponse.json(
            { error: { code: 'VAL-400', message: 'Contract is not active' } },
            { status: 400 },
          );
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Contract c1');
      await user.click(screen.getByRole('button', { name: 'Terminate' }));
      // Wait for modal dialog to open
      await screen.findByRole('dialog', { name: 'Terminate Contract' });

      await user.selectOptions(screen.getByLabelText(/^Reason/), 'tenant_moved_out');
      // Find the submit button inside the dialog to avoid matching the page button
      const dialog = screen.getByRole('dialog', { name: 'Terminate Contract' });
      const submitBtn = dialog.querySelector('button[type="submit"]')!;
      await user.click(submitBtn);

      // Error toast appears and modal stays open
      await waitFor(() => {
        expect(screen.getByText('Contract is not active')).toBeInTheDocument();
      });
      // Modal should still be open
      expect(screen.getByRole('dialog', { name: 'Terminate Contract' })).toBeInTheDocument();
    });
  });

  describe('extend workflow', () => {
    it('opens extend modal when Extend Lease button is clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Contract c1');
      // Use role=button with exact name to distinguish from dialog title
      const extendBtn = screen.getByRole('button', { name: 'Extend Lease' });
      await user.click(extendBtn);

      // The dialog title is also "Extend Lease" — use dialog role to find it
      expect(await screen.findByRole('dialog', { name: 'Extend Lease' })).toBeInTheDocument();
    });

    it('closes extend modal when Cancel is clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Contract c1');
      await user.click(screen.getByRole('button', { name: 'Extend Lease' }));
      // Wait for dialog to be present
      await screen.findByRole('dialog', { name: 'Extend Lease' });

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Extend Lease' })).not.toBeInTheDocument();
      });
    });

    it('shows success toast and closes modal after extending', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Contract c1');
      await user.click(screen.getByRole('button', { name: 'Extend Lease' }));
      // Wait for dialog to be present
      await screen.findByRole('dialog', { name: 'Extend Lease' });

      await user.type(screen.getByLabelText(/^New End Date/), '2027-12-31');
      await user.click(screen.getByRole('button', { name: 'Extend' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Extend Lease' })).not.toBeInTheDocument();
      });
      expect(screen.getByText('Lease extended successfully')).toBeInTheDocument();
    });
  });

  describe('renew workflow', () => {
    it('opens renew modal when Renew Contract button is clicked', async () => {
      server.use(
        http.get('*/api/v1/contracts/:id', () => {
          return HttpResponse.json({
            data: {
              id: 'c1',
              room_id: 'r1',
              tenant_id: 't1',
              property_id: 'p1',
              start_date: '2026-01-01',
              end_date: '2026-12-31',
              monthly_rent: '15000',
              deposit_amount: '30000',
              status: 'terminated',
              special_conditions: null,
              is_renewal: false,
              renewed_from_id: null,
              created_by: 'user-1',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
              termination: {
                id: 'term-1',
                reason: 'tenant_moved_out',
                termination_date: '2026-06-15',
                notes: 'Moving to another city',
                terminated_by: 'user-1',
                created_at: '2026-06-15T10:00:00Z',
              },
              extensions: [],
            },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Contract c1');
      await user.click(screen.getByRole('button', { name: 'Renew Contract' }));

      expect(await screen.findByRole('dialog', { name: 'Renew Contract' })).toBeInTheDocument();
    });

    it('closes renew modal when Cancel is clicked', async () => {
      server.use(
        http.get('*/api/v1/contracts/:id', () => {
          return HttpResponse.json({
            data: {
              id: 'c1',
              room_id: 'r1',
              tenant_id: 't1',
              property_id: 'p1',
              start_date: '2026-01-01',
              end_date: '2026-12-31',
              monthly_rent: '15000',
              deposit_amount: '30000',
              status: 'terminated',
              special_conditions: null,
              is_renewal: false,
              renewed_from_id: null,
              created_by: 'user-1',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
              termination: {
                id: 'term-1',
                reason: 'tenant_moved_out',
                termination_date: '2026-06-15',
                notes: 'Moving to another city',
                terminated_by: 'user-1',
                created_at: '2026-06-15T10:00:00Z',
              },
              extensions: [],
            },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Contract c1');
      await user.click(screen.getByRole('button', { name: 'Renew Contract' }));
      await screen.findByRole('dialog', { name: 'Renew Contract' });

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Renew Contract' })).not.toBeInTheDocument();
      });
    });

    it('shows success toast and closes modal after renewing', async () => {
      server.use(
        http.get('*/api/v1/contracts/:id', () => {
          return HttpResponse.json({
            data: {
              id: 'c1',
              room_id: 'r1',
              tenant_id: 't1',
              property_id: 'p1',
              start_date: '2026-01-01',
              end_date: '2026-12-31',
              monthly_rent: '15000',
              deposit_amount: '30000',
              status: 'terminated',
              special_conditions: null,
              is_renewal: false,
              renewed_from_id: null,
              created_by: 'user-1',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
              termination: {
                id: 'term-1',
                reason: 'tenant_moved_out',
                termination_date: '2026-06-15',
                notes: 'Moving to another city',
                terminated_by: 'user-1',
                created_at: '2026-06-15T10:00:00Z',
              },
              extensions: [],
            },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Contract c1');
      await user.click(screen.getByRole('button', { name: 'Renew Contract' }));
      await screen.findByRole('dialog', { name: 'Renew Contract' });

      await user.type(screen.getByLabelText(/^New Start Date/), '2027-01-01');
      await user.type(screen.getByLabelText(/^New End Date/), '2027-12-31');
      await user.type(screen.getByLabelText(/^New Monthly Rent/), '16000');
      await user.type(screen.getByLabelText(/^New Deposit Amount/), '32000');
      await user.click(screen.getByRole('button', { name: 'Renew' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Renew Contract' })).not.toBeInTheDocument();
      });
      expect(screen.getByText('Contract renewed successfully')).toBeInTheDocument();
    });
  });
});
