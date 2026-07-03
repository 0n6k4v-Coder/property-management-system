// File: src/layouts/MainLayout.tsx
// Main application layout with header, navigation, and responsive content area.

import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthContext';

export function MainLayout() {
  const { user, logout } = useAuth();
  const year = new Date().getFullYear();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-primary-50 text-primary-700'
        : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
    }`;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-surface-200 bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-surface-900">
              Property Management
            </h2>
          </div>
          <nav className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-1">
              <NavLink to="/dashboard" className={navLinkClass}>Dashboard</NavLink>
              <NavLink to="/property" className={navLinkClass}>Properties</NavLink>
              <NavLink to="/tenants" className={navLinkClass}>Tenants</NavLink>
              <NavLink to="/meter-reading" className={navLinkClass}>Meters</NavLink>
              <NavLink to="/invoices" className={navLinkClass}>Invoices</NavLink>
              <NavLink to="/contracts" className={navLinkClass}>Contracts</NavLink>
              <NavLink to="/maintenance" className={navLinkClass}>Maintenance</NavLink>
              <NavLink to="/reports" className={navLinkClass}>Reports</NavLink>
              <NavLink to="/settings" className={navLinkClass}>Settings</NavLink>
            </div>
            <div className="flex items-center gap-4">
              {user && (
                <span className="text-sm text-surface-600">
                  {user.full_name}
                </span>
              )}
              <button
                onClick={logout}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-surface-600 hover:bg-surface-100 active:bg-surface-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                type="button"
              >
                Logout
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-200 bg-white py-4">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-surface-400 sm:px-6 lg:px-8">
          &copy; {year} Property Management System
        </div>
      </footer>
    </div>
  );
}