# File: frontend/docs/02-design/SDD/02-screen-specs/04-meter-reading.md
# SCR-METER-READ: PWA Offline Meter Reading

| Attribute | Detail |
|-----------|--------|
| **Route** | `/meter-reading` |
| **Layout** | Full-width mobile, large touch targets (≥44px), sticky summary bar |
| **UI Elements** | `RoomSelector`, `ElectricInput`, `WaterInput`, `UnitSummary`, `SaveButton`, `OfflineBanner`, `SyncStatusIndicator` |
| **State Mapping** | `loading-rooms` → `ready` → `submitting` → `success / offline-queued / error` |
| **API Dependency** | `GET /rooms?status=occupied`, `GET /meter-readings/history?room_id=...`, `POST /meter-readings` |
| **Offline Fallback** | เก็บ payload ใน IndexedDB (`pms-meter-queue`) → แสดง `✅ บันทึกแล้ว (รอซิงค์)` → `BackgroundSync` เมื่อออนไลน์ |
| **Accessibility** | `inputmode="decimal"`, `aria-describedby` สำหรับ validation error, haptic feedback on save (หาก PWA support) |