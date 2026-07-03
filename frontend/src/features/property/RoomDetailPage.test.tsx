// File: src/features/property/RoomDetailPage.test.tsx
// Integration tests for RoomDetailPage — RTL + MSW.

import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { ToastProvider } from '@/shared/ui/Toast';
import RoomDetailPage from './RoomDetailPage';

// ── Test Helpers ──────────────────────────────────────────────────

const MOCK_ROOM_ID = '00000000-0000-0000-0000-000000000001';

function renderPage(roomId: string = MOCK_ROOM_ID) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <MemoryRouter initialEntries={[`/property/rooms/${roomId}`]}>
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <Routes>
            <Route path="/property/rooms/:id" element={<RoomDetailPage />} />
          </Routes>
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────

describe('RoomDetailPage', () => {
  describe('rendering', () => {
    it('renders breadcrumb navigation', () => {
      renderPage();

      expect(screen.getByText('Property')).toBeInTheDocument();
      expect(screen.getByText(`/`)).toBeInTheDocument();
    });

    it('renders room ID in breadcrumb', () => {
      renderPage();

      // Breadcrumb shows first 8 chars of the room ID
      expect(screen.getByText('Room 00000000')).toBeInTheDocument();
    });

    it('renders all three tabs', () => {
      renderPage();

      expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Contract' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Meter History' })).toBeInTheDocument();
    });

    it('defaults to Overview tab as active', () => {
      renderPage();

      const overviewTab = screen.getByRole('tab', { name: 'Overview' });
      expect(overviewTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('tab switching', () => {
    it('switches to Contract tab when clicked', () => {
      renderPage();

      fireEvent.click(screen.getByRole('tab', { name: 'Contract' }));

      expect(screen.getByRole('tab', { name: 'Contract' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByText('No active contract for this room.')).toBeInTheDocument();
    });

    it('switches to Meter History tab when clicked', () => {
      renderPage();

      fireEvent.click(screen.getByRole('tab', { name: 'Meter History' }));

      expect(screen.getByRole('tab', { name: 'Meter History' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Meter reading history will appear here.')).toBeInTheDocument();
    });

    it('switches back to Overview tab', () => {
      renderPage();

      fireEvent.click(screen.getByRole('tab', { name: 'Contract' }));
      fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));

      expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Room Details')).toBeInTheDocument();
    });
  });

  describe('Overview tab content', () => {
    it('displays room detail fields', () => {
      renderPage();

      expect(screen.getByText('Room Details')).toBeInTheDocument();
      expect(screen.getByText('Room Number')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Base Rent')).toBeInTheDocument();
    });

    it('shows available status badge', () => {
      renderPage();

      expect(screen.getByText('available')).toBeInTheDocument();
    });
  });

  describe('Contract tab content', () => {
    it('shows placeholder text and disabled button', () => {
      renderPage();

      fireEvent.click(screen.getByRole('tab', { name: 'Contract' }));

      expect(screen.getByText('No active contract for this room.')).toBeInTheDocument();
      expect(screen.getByText('Contract creation will be available in Sprint 3.')).toBeInTheDocument();

      const createBtn = screen.getByRole('button', { name: 'Create Contract' });
      expect(createBtn).toBeDisabled();
    });
  });

  describe('Meter History tab content', () => {
    it('shows placeholder text', () => {
      renderPage();

      fireEvent.click(screen.getByRole('tab', { name: 'Meter History' }));

      expect(screen.getByText('Meter reading history will appear here.')).toBeInTheDocument();
      expect(screen.getByText('Available in Sprint 4+.')).toBeInTheDocument();
    });
  });

  describe('link navigation', () => {
    it('has a link back to property list', () => {
      renderPage();

      const propertyLink = screen.getByText('Property');
      expect(propertyLink).toHaveAttribute('href', '/property');
    });
  });

  describe('accessibility', () => {
    it('has proper tablist and tab roles', () => {
      renderPage();

      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeInTheDocument();

      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBe(3);

      tabs.forEach((tab) => {
        expect(tab).toHaveAttribute('aria-selected');
      });
    });
  });
});
