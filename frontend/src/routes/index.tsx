// File: src/routes/index.tsx
// React Router v7 — lazy-loaded pages with ProtectedRoute + GuestRoute guards.

import { Suspense, lazy, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { GuestRoute } from './GuestRoute';
import { AuthLayout } from '@/layouts/AuthLayout';
import { MainLayout } from '@/layouts/MainLayout';

// Auth (eager)
const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'));

// Main features (lazy)
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const PropertyListPage = lazy(() => import('@/features/property/PropertyListPage'));
const RoomDetailPage = lazy(() => import('@/features/property/RoomDetailPage'));
const TenantListPage = lazy(() => import('@/features/tenant/TenantListPage'));
const MeterReadingPage = lazy(() => import('@/features/meter/MeterReadingPage'));
const InvoiceListPage = lazy(() => import('@/features/billing/InvoiceListPage'));
const InvoiceDetailPage = lazy(() => import('@/features/billing/InvoiceDetailPage'));
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'));
const PropertyDetailPage = lazy(() => import('@/features/property/PropertyDetailPage'));

// New features (Phase 4)
const ContractListPage = lazy(() => import('@/features/contract/ContractListPage'));
const ContractDetailPage = lazy(() => import('@/features/contract/ContractDetailPage'));
const ContractFormPage = lazy(() => import('@/features/contract/ContractFormPage'));
const MaintenanceListPage = lazy(() => import('@/features/maintenance/MaintenanceListPage'));
const MaintenanceFormPage = lazy(() => import('@/features/maintenance/MaintenanceFormPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));

function SuspenseFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <span className="flex items-center gap-3">
        <output className="size-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" aria-hidden="true" />
        <span className="text-sm font-medium text-slate-600">Loading…</span>
      </span>
    </div>
  );
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<SuspenseFallback />}>{children}</Suspense>;
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Auth */}
      <Route element={<GuestRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/register" element={<RegisterPage />} />
        </Route>
      </Route>

      {/* Protected */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<LazyPage><DashboardPage /></LazyPage>} />
          <Route path="/property" element={<LazyPage><PropertyListPage /></LazyPage>} />
          <Route path="/property/:id" element={<LazyPage><PropertyDetailPage /></LazyPage>} />
          <Route path="/property/rooms/:id" element={<LazyPage><RoomDetailPage /></LazyPage>} />
          <Route path="/tenants" element={<LazyPage><TenantListPage /></LazyPage>} />
          <Route path="/meter-reading" element={<LazyPage><MeterReadingPage /></LazyPage>} />
          <Route path="/invoices" element={<LazyPage><InvoiceListPage /></LazyPage>} />
          <Route path="/invoices/:id" element={<LazyPage><InvoiceDetailPage /></LazyPage>} />
          <Route path="/reports" element={<LazyPage><ReportsPage /></LazyPage>} />
          <Route path="/contracts" element={<LazyPage><ContractListPage /></LazyPage>} />
          <Route path="/contracts/new" element={<LazyPage><ContractFormPage /></LazyPage>} />
          <Route path="/contracts/:id" element={<LazyPage><ContractDetailPage /></LazyPage>} />
          <Route path="/maintenance" element={<LazyPage><MaintenanceListPage /></LazyPage>} />
          <Route path="/maintenance/new" element={<LazyPage><MaintenanceFormPage /></LazyPage>} />
          <Route path="/settings" element={<LazyPage><SettingsPage /></LazyPage>} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}