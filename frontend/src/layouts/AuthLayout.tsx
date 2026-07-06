// File: src/layouts/AuthLayout.tsx
// Centered card layout for authentication pages.
// SDD §SCR-LOGIN: Centered card, max-width 400px, mobile responsive.

import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  const year = new Date().getFullYear();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-100 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-auth">
        {/* Brand */}
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-surface-900">
            Property Management
          </h1>
          <p className="mt-1 text-sm text-surface-600">
            ระบบจัดการอสังหาริมทรัพย์
          </p>
        </header>

        {/* Auth Card */}
        <main className="rounded-xl bg-white px-6 py-8 shadow-sm ring-1 ring-surface-200 sm:px-8">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="mt-6 text-center text-xs text-surface-600">
          &copy; {year} Property Management System
        </footer>
      </div>
    </div>
  );
}