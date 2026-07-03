# File: frontend/docs/02-design/SDD/02-screen-specs/09-room-detail.md
# SCR-ROOM-DETAIL: Room Detail & Contract Info

| Attribute | Detail |
|-----------|--------|
| **Route** | `/property/rooms/:id` |
| **Layout** | Tabbed interface: Overview / Contract / Meter History / Maintenance |
| **UI Elements** | `RoomHeader`, `ContractStatusBadge`, `MeterHistoryChart`, `CreateContractButton`, `TerminateContractButton` |
| **State Mapping** | `loading` → `success` / `error` + tab-specific loading states |
| **API Dependency** | `GET /rooms/{id}`, `GET /contracts?room_id=...`, `POST /contracts`, `POST /contracts/{id}/terminate` |
| **Contract Flow** | "Create Contract" → opens modal with tenant search + form → on success, refresh room state |
| **Accessibility** | Tabs with `role="tablist"`, chart with `aria-label` + data table fallback, modal with focus trap |