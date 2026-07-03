# File: frontend/docs/02-design/SDD/02-screen-specs/10-reports.md
# SCR-REPORTS: Analytics & Export

| Attribute | Detail |
|-----------|--------|
| **Route** | `/reports` |
| **Layout** | Filter sidebar + chart area + export controls |
| **UI Elements** | `ReportTypeSelector`, `DateRangePicker`, `RevenueChart`, `OverdueChart`, `ExportCSVButton`, `ExportPDFButton` |
| **State Mapping** | `idle` → `loading` → `success` / `error` + `exporting` state |
| **API Dependency** | `GET /reports/revenue`, `GET /reports/overdue` |
| **Export Strategy** | Generate on client from fetched data (no backend file gen in MVP) |
| **Accessibility** | Chart with `aria-label` + data table toggle, export buttons with `aria-busy` during processing |