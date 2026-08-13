// File: src/features/property/PropertyDetailPage.test.tsx
// Integration tests for PropertyDetailPage — RTL + MSW.

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import PropertyDetailPage from './PropertyDetailPage';

function renderPage(propertyId: string = 'p1') {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <MemoryRouter initialEntries={[`/property/${propertyId}`]}>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/property" element={<div>Property List</div>} />
              <Route path="/property/:id" element={<PropertyDetailPage />} />
              <Route path="/property/rooms/:id" element={<div>Room Detail</div>} />
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

describe('PropertyDetailPage', () => {
  it('renders loading state with skeletons', async () => {
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

    renderPage();

    // Skeleton elements should be present during loading
    const skeletonContainers = document.querySelectorAll('[aria-hidden="true"]');
    expect(skeletonContainers.length).toBeGreaterThanOrEqual(1);
  });

  it('renders property name and address after load', async () => {
    renderPage();

    expect(await screen.findByText('Sunset Tower')).toBeInTheDocument();
    expect(screen.getByText('123 Main St')).toBeInTheDocument();
  });

  it('renders back to properties link', async () => {
    renderPage();

    await screen.findByText('Sunset Tower');
    const backLink = screen.getByText('← Back to properties');
    expect(backLink).toHaveAttribute('href', '/property');
  });

  it('renders property info section', async () => {
    renderPage();

    await screen.findByText('Sunset Tower');
    expect(screen.getByText('Property Info')).toBeInTheDocument();
    expect(screen.getByText('Billing Due Day')).toBeInTheDocument();
    expect(screen.getByText('Day 5')).toBeInTheDocument();
    expect(screen.getByText('Min Deposit')).toBeInTheDocument();
    expect(screen.getByText('2 months')).toBeInTheDocument();
  });

  it('renders room cards with room details', async () => {
    renderPage();

    await screen.findByText('Sunset Tower');
    expect(screen.getByText('Rooms')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Room 101/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Room 102/ })).toBeInTheDocument();
    expect(screen.getByText('studio')).toBeInTheDocument();
    expect(screen.getByText('1br')).toBeInTheDocument();
    expect(screen.getByText('available')).toBeInTheDocument();
    expect(screen.getByText('occupied')).toBeInTheDocument();
  });

  it('renders room links pointing to room detail pages', async () => {
    renderPage();

    await screen.findByText('Sunset Tower');
    const link101 = screen.getByRole('link', { name: /Room 101/ });
    expect(link101).toHaveAttribute('href', '/property/rooms/r1');

    const link102 = screen.getByRole('link', { name: /Room 102/ });
    expect(link102).toHaveAttribute('href', '/property/rooms/r2');
  });

  it('renders room rent values', async () => {
    renderPage();

    await screen.findByText('Sunset Tower');
    expect(screen.getByText('Rent: ฿5,000')).toBeInTheDocument();
    expect(screen.getByText('Rent: ฿8,000')).toBeInTheDocument();
  });

  it('shows room status badges with correct styling', async () => {
    renderPage();

    await screen.findByText('Sunset Tower');
    // Available room badge
    const availableBadge = screen.getByText('available');
    expect(availableBadge).toHaveClass('bg-green-100');
    // Occupied room badge
    const occupiedBadge = screen.getByText('occupied');
    expect(occupiedBadge).toHaveClass('bg-amber-100');
  });

  it('handles unknown room status with default styling', async () => {
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
              status: 'unknown_status',
              images: null,
            },
          ],
        });
      }),
    );

    renderPage();

    await screen.findByText('Room 101');
    const unknownBadge = screen.getByText('unknown_status');
    expect(unknownBadge).toHaveClass('bg-surface-100');
  });

  it('renders not found message when property data is empty', async () => {
    server.use(
      http.get('*/api/v1/properties/:id/rooms', () => {
        return HttpResponse.json({
          error: { code: 'NOT-404', message: 'Property not found' },
        }, { status: 404 });
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Property not found.')).toBeInTheDocument();
    });
  });
});
