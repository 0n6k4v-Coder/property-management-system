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
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-surface-900">
            Property Management
          </h1>
          <p className="mt-1 text-sm text-surface-500">
            ระบบจัดการอสังหาริมทรัพย์
          </p>
        </div>

        {/* Auth Card */}
        <div className="rounded-xl bg-white px-6 py-8 shadow-sm ring-1 ring-surface-200 sm:px-8">
          <Outlet />
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-surface-400">
          &copy; {year} Property Management System
        </p>
      </div>
    </div>
  );
}