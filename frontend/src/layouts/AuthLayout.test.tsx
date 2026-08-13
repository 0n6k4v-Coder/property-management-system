// File: src/layouts/AuthLayout.test.tsx
// Unit tests for AuthLayout — renders centered card, brand header, auth outlet, footer.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';

function renderWithRouter(ui: React.ReactNode, initialEntries: string[] = ['/#']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      {ui}
    </MemoryRouter>,
  );
}

describe('AuthLayout', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the brand header with "Property Management"', () => {
    renderWithRouter(
      <Routes>
        <Route element={<AuthLayout />}>
          <Route index element={<div>Child Content</div>} />
        </Route>
      </Routes>,
    );
    expect(screen.getByText('Property Management')).toBeInTheDocument();
  });

  it('renders the Thai subtitle "ระบบจัดการอสังหาริมทรัพย์"', () => {
    renderWithRouter(
      <Routes>
        <Route element={<AuthLayout />}>
          <Route index element={<div>Child Content</div>} />
        </Route>
      </Routes>,
    );
    expect(screen.getByText('ระบบจัดการอสังหาริมทรัพย์')).toBeInTheDocument();
  });

  it('renders Outlet content for child routes', () => {
    renderWithRouter(
      <Routes>
        <Route element={<AuthLayout />}>
          <Route index element={<div data-testid="outlet-child">Login Form Content</div>} />
        </Route>
      </Routes>,
    );
    expect(screen.getByTestId('outlet-child')).toBeInTheDocument();
    expect(screen.getByText('Login Form Content')).toBeInTheDocument();
  });

  it('renders the copyright footer with current year', () => {
    renderWithRouter(
      <Routes>
        <Route element={<AuthLayout />}>
          <Route index element={<div>Child</div>} />
        </Route>
      </Routes>,
    );
    const year = new Date().getFullYear();
    expect(
      screen.getByText(new RegExp(`© ${year} Property Management System`)),
    ).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = renderWithRouter(
      <Routes>
        <Route element={<AuthLayout />}>
          <Route index element={<div>Child</div>} />
        </Route>
      </Routes>,
    );
    expect(container.querySelector('div')).toBeInTheDocument();
  });

  it('applies the centered card layout class (max-w-auth)', () => {
    const { container } = renderWithRouter(
      <Routes>
        <Route element={<AuthLayout />}>
          <Route index element={<div>Child</div>} />
        </Route>
      </Routes>,
    );
    // max-w-auth is on the wrapper div, not the <main> card
    const wrapperDiv = container.querySelector('div.w-full');
    expect(wrapperDiv).toHaveClass('max-w-auth');
  });

  it('applies the full-height centered container class', () => {
    const { container } = renderWithRouter(
      <Routes>
        <Route element={<AuthLayout />}>
          <Route index element={<div>Child</div>} />
        </Route>
      </Routes>,
    );
    const rootDiv = container.querySelector('div');
    expect(rootDiv).toHaveClass('min-h-screen');
    expect(rootDiv).toHaveClass('flex-col', 'items-center');
  });

  it('applies rounded-xl shadow ring classes on the card', () => {
    const { container } = renderWithRouter(
      <Routes>
        <Route element={<AuthLayout />}>
          <Route index element={<div>Child</div>} />
        </Route>
      </Routes>,
    );
    const card = container.querySelector('main');
    expect(card).toHaveClass('rounded-xl');
    expect(card).toHaveClass('shadow-sm');
    expect(card).toHaveClass('ring-1');
  });

  // Verify Outlet works independently (no route nesting)
  it('renders Outlet when used as a layout route', () => {
    renderWithRouter(
      <Routes>
        <Route element={<AuthLayout />}>
          <Route index element={<div data-testid="layout-outlet">Outlet Content</div>} />
        </Route>
      </Routes>,
    );
    // AuthLayout renders an Outlet — with a route match, it renders the child
    expect(screen.getByTestId('layout-outlet')).toBeInTheDocument();
    expect(screen.getByText('Outlet Content')).toBeInTheDocument();
    // AuthLayout itself (header, card, footer) should still be visible
    expect(screen.getByText('Property Management')).toBeInTheDocument();
  });
});
