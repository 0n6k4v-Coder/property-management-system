# File: frontend/docs/02-design/SDD/02-screen-specs/_index.md
# Screen/View Specifications — Quick Navigation
## Property Management System (Client-Side)

---

## Quick Navigation

| # | File | Screen ID | Route |
|---|------|-----------|-------|
| 1 | [01-login.md](01-login.md) | SCR-LOGIN | `/login` |
| 2 | [02-register.md](02-register.md) | SCR-REGISTER | `/auth/register?token=...` |
| 3 | [03-dashboard.md](03-dashboard.md) | SCR-DASHBOARD | `/dashboard` |
| 4 | [04-meter-reading.md](04-meter-reading.md) | SCR-METER-READ | `/meter-reading` |
| 5 | [05-invoice-list.md](05-invoice-list.md) | SCR-INVOICE-LIST | `/invoices` |
| 6 | [06-invoice-detail.md](06-invoice-detail.md) | SCR-INVOICE-DETAIL | `/invoices/:id` |
| 7 | [07-tenant-list.md](07-tenant-list.md) | SCR-TENANT-LIST | `/tenants` |
| 8 | [08-property-list.md](08-property-list.md) | SCR-PROPERTY-LIST | `/property` |
| 9 | [09-room-detail.md](09-room-detail.md) | SCR-ROOM-DETAIL | `/property/rooms/:id` |
| 10 | [10-reports.md](10-reports.md) | SCR-REPORTS | `/reports` |
| 11 | [11-system-fallback.md](11-system-fallback.md) | SCR-404 & SCR-500 | `*` (catch-all) / `/error` |

---

## AI Usage Guide

1. เริ่มที่ `01-login.md` + `02-register.md` สำหรับ Auth flow screens
2. อ่าน `04-meter-reading.md` หากทำงานเกี่ยวกับ Offline/PWA meter reading
3. ดู `09-room-detail.md` สำหรับ Contract + Room management flow
4. ทุก screen ใช้ UI Contract format เดียวกัน: Route → Layout → Elements → State → API → Accessibility