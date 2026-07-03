# File: frontend/docs/02-design/SDD/02-screen-specs/08-property-list.md
# SCR-PROPERTY-LIST: Property & Building Management

| Attribute | Detail |
|-----------|--------|
| **Route** | `/property` |
| **Layout** | Property grid → Property detail with room list |
| **UI Elements** | `AddPropertyButton`, `PropertyGrid`, `PropertyCard` (clickable → `/property/rooms/:id`), `PropertyDetail`, `EmptyState`, `CreatePropertyForm`, `BackButton`, `Badge` (status), `Stat` (metrics), `NavigationLink` (room items link to `/property/rooms/:id`) |
| **State Mapping** | `loading` → Spinner rotates while "Loading…" text remains static (per §4.2 Loading State Contract) / `success` → `PropertyGrid` or `PropertyDetail` / `error` → error card / `empty` → `EmptyState` with create form |
| **API Dependency** | `GET /api/v1/properties` (list), `GET /api/v1/properties/{id}` (detail), `GET /api/v1/properties/{id}/rooms` (room list), `POST /api/v1/properties` (create) |
| **Navigation** | Click PropertyCard → `/property` (state: `selectedPropertyId`) → shows `PropertyDetail` with rooms. Click room item → `/property/rooms/:id` via `<Link>` component |
| **Empty State** | When `GET /properties` returns empty array → show `EmptyState` with "Create Property" button → opens `CreatePropertyForm` (inline or modal) |
| **Create Flow** | `AddPropertyButton` or `EmptyState` → `CreatePropertyForm` → POST /properties → invalidate cache → shows new property in grid |
| **Detail View** | Shows property stats (Due Day, Deposit, Total Rooms, Available), room list with clickable items linking to `/property/rooms/:id`, status badges and rent prices |
| **Loading State Contract** | Spinner SVG has `animate-spin` class; "Loading…" text is in a separate `<span>` with no animation class. Layout uses `flex items-center gap-3` to keep spinner and text side by side |
| **Accessibility** | Grid layout with proper heading hierarchy, buttons with aria-labels, focus management on navigation, `role="tablist"` for tabs, keyboard-navigable room links |
