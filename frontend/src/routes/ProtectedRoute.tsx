// File: src/routes/ProtectedRoute.tsx
// Route guard — redirects unauthenticated users to /login.

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthContext';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="flex items-center gap-3">
          <output className="size-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" aria-hidden="true" />
          <span className="text-sm font-medium text-slate-600">Loading…</span>
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}