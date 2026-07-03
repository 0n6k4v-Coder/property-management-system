# File: frontend/docs/02-design/SDD/02-screen-specs/03-dashboard.md
# SCR-DASHBOARD: Analytics & Overview

| Attribute | Detail |
|-----------|--------|
| **Route** | `/dashboard` |
| **Layout** | Grid 1/2/3 columns ตาม viewport, cards for stats, table for overdue |
| **UI Elements** | `OccupancyCard`, `RevenueCard`, `OverdueTable`, `QuickActions`, `DateRangeFilter`, `PropertySelector` |
| **State Mapping** | `stale` → `loading` → `success` / `error` (with retry) |
| **API Dependency** | `GET /dashboard`, `GET /reports/overdue` |
| **Caching Strategy** | `staleTime: 300000` (5m), `gcTime: 900000` (15m), refetch on window focus |
| **Performance** | Virtualize table if >50 rows, lazy-load charts, bundle split per widget |