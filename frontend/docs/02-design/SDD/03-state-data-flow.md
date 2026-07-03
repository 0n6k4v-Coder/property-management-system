# File: frontend/docs/02-design/SDD/03-state-data-flow.md
# State & Data Flow Design
## Property Management System (Client-Side)

---

## 5. State & Data Flow Design

### 5.1 State Management Strategy
| ประเภท | เครื่องมือ | ขอบเขต | Retention & Invalidation |
|--------|----------|--------|--------------------------|
| **Server State** | `@tanstack/react-query` | API responses, pagination, filters | `staleTime: 5m`, `gcTime: 15m`, invalidate on `mutation` success |
| **Client State** | React Context + `useReducer` | Auth session, theme, filter drafts, modals | Session lifetime, reset on logout |
| **Offline State** | `idb` (IndexedDB) | Meter reading queue, draft forms | Persistent until sync success + 24h |
| **Routing State** | `react-router-dom` v7 | URL params, search params, history | URL-driven, serializable |

### 5.2 Data Flow Rules
1. **Unidirectional:** UI → Hooks → State/API → Backend → Response → UI
2. **No Direct Mutations:** Cache ต้องอัปเดตผ่าน `queryClient.invalidateQueries()` หรือ `onSuccess` callback
3. **Optimistic Updates:** ใช้เฉพาะเมื่อ confidence > 95% (เช่น like button) → ไม่ใช้สำหรับ financial/meter data
4. **Error Boundaries:** Catch render errors at `routes/` level, show fallback UI + log to monitoring