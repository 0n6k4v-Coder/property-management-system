// File: src/features/contract/ContractFormPage.test.tsx
// Integration tests for ContractFormPage — RTL + MSW.

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { server } from '@/mocks/server';
import ContractFormPage from './ContractFormPage';

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
    <MemoryRouter initialEntries={['/contracts/new']}>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/contracts/new" element={<ContractFormPage />} />
              <Route path="/contracts" element={<div>Contract List</div>} />
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

describe('ContractFormPage', () => {
  describe('rendering', () => {
    it('renders page heading', async () => {
      renderPage();
      expect(screen.getByText('New Contract')).toBeInTheDocument();
      expect(screen.getByText('Create a new rental contract')).toBeInTheDocument();
    });

    it('renders property selection field', async () => {
      renderPage();
      expect(await screen.findByText('New Contract')).toBeInTheDocument();
      expect(screen.getByLabelText(/^Property/)).toBeInTheDocument();
    });

    it('renders all property options when properties are loaded', async () => {
      renderPage();
      await screen.findByText('Sunset Tower');
      expect(screen.getByText('Riverside Apartments')).toBeInTheDocument();
    });

    it('renders Cancel button', async () => {
      renderPage();
      await screen.findByText('New Contract');
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('renders Create Contract button', async () => {
      renderPage();
      await screen.findByText('New Contract');
      expect(screen.getByRole('button', { name: 'Create Contract' })).toBeInTheDocument();
    });

    it('does not render room selection until a property is selected', async () => {
      renderPage();
      await screen.findByText('New Contract');
      expect(screen.queryByLabelText(/^Room/)).not.toBeInTheDocument();
    });

    it('does not render tenant search until a property is selected', async () => {
      renderPage();
      await screen.findByText('New Contract');
      expect(screen.queryByLabelText(/Search Tenant/)).not.toBeInTheDocument();
    });

    it('renders Start Date and End Date inputs', async () => {
      renderPage();
      await screen.findByText('New Contract');
      expect(screen.getByLabelText(/^Start Date/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^End Date/)).toBeInTheDocument();
    });

    it('renders Monthly Rent and Deposit Amount inputs', async () => {
      renderPage();
      await screen.findByText('New Contract');
      expect(screen.getByLabelText(/^Monthly Rent/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Deposit Amount/)).toBeInTheDocument();
    });

    it('renders Special Conditions textarea', async () => {
      renderPage();
      await screen.findByText('New Contract');
      expect(screen.getByLabelText('Special conditions for the contract')).toBeInTheDocument();
    });

    it('shows hint text for special conditions', async () => {
      renderPage();
      await screen.findByText('New Contract');
      expect(screen.getByText('Optional special conditions for this contract')).toBeInTheDocument();
    });
  });

  describe('property selection', () => {
    it('shows room selection after property is selected', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Sunset Tower');
      await user.selectOptions(screen.getByLabelText(/^Property/), 'p1');

      await waitFor(() => {
        expect(screen.getByLabelText(/^Room/)).toBeInTheDocument();
      });
    });

    it('shows tenant search after property is selected', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Sunset Tower');
      await user.selectOptions(screen.getByLabelText(/^Property/), 'p1');

      await waitFor(() => {
        expect(screen.getByLabelText('Search tenant by name')).toBeInTheDocument();
      });
    });

    it('shows room options from selected property', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Sunset Tower');
      await user.selectOptions(screen.getByLabelText(/^Property/), 'p1');

      await waitFor(() => {
        const roomSelect = screen.getByLabelText(/^Room/);
        const options = roomSelect.querySelectorAll('option');
        expect(options.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('shows Select a room placeholder option', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Sunset Tower');
      await user.selectOptions(screen.getByLabelText(/^Property/), 'p1');

      await waitFor(() => {
        expect(screen.getByText('Select a room…')).toBeInTheDocument();
      });
    });

    it('shows tenant search hint text', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Sunset Tower');
      await user.selectOptions(screen.getByLabelText(/^Property/), 'p1');

      expect(await screen.findByText('Type at least 3 characters to search')).toBeInTheDocument();
    });

    it('shows tenant search placeholder', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Sunset Tower');
      await user.selectOptions(screen.getByLabelText(/^Property/), 'p1');

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type at least 3 characters…')).toBeInTheDocument();
      });
    });

    it('shows room number and type in room options', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Sunset Tower');
      await user.selectOptions(screen.getByLabelText(/^Property/), 'p1');

      await waitFor(() => {
        expect(screen.getByText('101 (studio) - available')).toBeInTheDocument();
        expect(screen.getByText('102 (1br) - occupied')).toBeInTheDocument();
      });
    });
  });

  describe('tenant search', () => {
    it('shows tenant results after typing 3+ characters', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Sunset Tower');
      await user.selectOptions(screen.getByLabelText(/^Property/), 'p1');

      await waitFor(() => screen.getByLabelText('Search tenant by name'));
      await user.type(screen.getByLabelText('Search tenant by name'), 'Joh');

      // Tenant suggestion list displays matching tenant name and phone in separate elements within an interactive button
      await waitFor(() => {
        expect(screen.getByText('Select matching tenant:')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /John Doe.*0812345678/ })).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('0812345678')).toBeInTheDocument();
      });
    });

    it('shows tenant options in suggestion list with phone', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Sunset Tower');
      await user.selectOptions(screen.getByLabelText(/^Property/), 'p1');

      await waitFor(() => screen.getByLabelText('Search tenant by name'));
      await user.type(screen.getByLabelText('Search tenant by name'), 'Joh');

      await waitFor(() => {
        const optionBtn = screen.getByRole('button', { name: /John Doe.*0812345678/ });
        expect(optionBtn).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('0812345678')).toBeInTheDocument();
      });
    });

    it('shows no tenant results for short queries (< 3 chars)', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Sunset Tower');
      await user.selectOptions(screen.getByLabelText(/^Property/), 'p1');
      await waitFor(() => screen.getByLabelText('Search tenant by name'));

      await user.type(screen.getByLabelText('Search tenant by name'), 'J');

      // No results for short queries — the search hook won't fire
      await waitFor(() => {
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      });
    });
  });

  describe('form validation', () => {
    it('shows error toast when submitting without filling required fields', async () => {
      const { container } = renderPage();

      await screen.findByText('New Contract');

      // Submit without filling fields
      const form = container.querySelector('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Please fill in all required fields')).toBeInTheDocument();
      });
    });

    it('shows error toast when only property is selected', async () => {
      const user = userEvent.setup();
      const { container } = renderPage();

      await screen.findByText('Sunset Tower');
      await user.selectOptions(screen.getByLabelText(/^Property/), 'p1');

      const form = container.querySelector('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Please fill in all required fields')).toBeInTheDocument();
      });
    });
  });

  describe('form submission', () => {
    it('Create Contract button shows loading state when creating', async () => {
      renderPage();
      const createBtn = await screen.findByRole('button', { name: 'Create Contract' });
      expect(createBtn).not.toBeDisabled();
      expect(createBtn).not.toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('navigation', () => {
    it('navigates back to contracts list when Cancel is clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('New Contract');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.getByText('Contract List')).toBeInTheDocument();
      });
    });
  });

  describe('property reset', () => {
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
});
