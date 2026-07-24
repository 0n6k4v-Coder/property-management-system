// File: src/layouts/MainLayout.tsx
// Application shell — collapsible sidebar + top header + card-panel content area.
// SDD §SCR-APP-SHELL — replaces the old top-nav-only layout.

import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/layouts/components/Sidebar';
import { TopHeader } from '@/layouts/TopHeader';
import { useSidebar } from '@/shared/hooks/useSidebar';

export function MainLayout() {
  const sidebar = useSidebar();

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50-light [color-scheme:light]">
      {/* Sidebar (desktop fixed / tablet collapsed / mobile hidden) */}
      <Sidebar sidebarState={sidebar} />

      {/* Main column: header + content */}
      <div className="flex h-full flex-1 flex-col overflow-hidden">
        {/* Top Header Bar */}
        <TopHeader onToggleSidebar={sidebar.toggleMobile} />

        {/* Main Content Area — card panel with rounded corners */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
          <div className="mx-auto max-w-7xl">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-surface-200/50 sm:p-6 lg:p-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
