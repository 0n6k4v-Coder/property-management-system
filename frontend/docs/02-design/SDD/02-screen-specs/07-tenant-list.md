# File: frontend/docs/02-design/SDD/02-screen-specs/07-tenant-list.md
# SCR-TENANT-LIST: Tenant Management

| Attribute | Detail |
|-----------|--------|
| **Route** | `/tenants` |
| **Layout** | Search bar + table view, mobile: card list with expandable details |
| **UI Elements** | `SearchInput`, `TenantTable`, `AddTenantButton`, `RowActions`, `IDCardUploadTrigger` |
| **State Mapping** | `idle` → `searching` → `results` / `error` |
| **API Dependency** | `GET /tenants/search`, `POST /tenants`, `POST /tenants/{id}/id-card` |
| **Search Strategy** | Debounce 300ms, min 3 chars, ILIKE on name + exact match on phone |
| **Accessibility** | Search input with `aria-autocomplete="list"`, table with proper headers, upload with `aria-describedby` |