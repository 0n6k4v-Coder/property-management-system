# File: frontend/docs/02-design/SDD/05-diagrams.md
# UML/Design Diagrams (Client-Side)
## Property Management System (Client-Side)

---

## 7. UML/Design Diagrams (Client-Side)

### 7.1 Sequence Diagram: Auth Flow + Token Refresh (Native Fetch)
```mermaid
sequenceDiagram
    participant UI as UI Component
    participant Hook as useAuth Hook
    participant Client as Native Fetch Wrapper
    participant BE as Backend API
    participant Storage as Browser Storage

    UI->>Hook: login(email, password)
    Hook->>Client: apiFetch('/auth/login', {method:'POST', body:...})
    Client->>BE: {email, password} + Headers
    BE-->>Client: 200 { access_token, refresh_token, user }
    Client->>Storage: Store access_token in memory
    Client-->>Hook: Success
    Hook-->>UI: Navigate /dashboard

    alt Access Token Expired (401)
        UI->>Hook: Fetch protected data
        Hook->>Client: apiFetch('/dashboard')
        Client->>BE: GET /dashboard (expired token)
        BE-->>Client: 401
        Client->>Client: Call POST /auth/refresh
        BE-->>Client: 200 { new_access_token }
        Client->>Storage: Update access_token
        Client->>BE: Retry GET /dashboard (X-Retry header)
        BE-->>Client: 200 { data }
        Client-->>Hook: Success
        Hook-->>UI: Render dashboard
    end
```

### 7.2 State Machine: Offline Sync Lifecycle
```mermaid
stateDiagram-v2
    [*] --> idle : App start / online
    idle --> recording : User fills meter form
    recording --> validating : Submit clicked
    validating --> online_success : Network OK, 201
    validating --> offline_queued : Network fail / 503
    offline_queued --> syncing : Connection restored + Background Sync
    syncing --> synced_all : Queue empty, 201s
    syncing --> partial_fail : Some retries failed
    partial_fail --> manual_retry : User clicks "Sync Now"
    online_success --> idle : Show toast, clear form
    synced_all --> idle : Clear queue, show toast
    
    note right of offline_queued
      เก็บใน IndexedDB
      แสดงสถานะ "รอซิงค์"
    end note
```