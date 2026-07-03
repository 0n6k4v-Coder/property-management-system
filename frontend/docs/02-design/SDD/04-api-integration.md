# File: frontend/docs/02-design/SDD/04-api-integration.md
# API Integration Contract (Native Fetch)
## Property Management System (Client-Side)

---

## 6. API Integration Contract (Native Fetch)

### 6.1 Native Fetch Wrapper & Interceptor Pattern
```typescript
// src/shared/api/fetchClient.ts
type FetchOptions = RequestInit & { skipAuth?: boolean };

export async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { skipAuth, headers, body, ...rest } = options;
  const baseUrl = import.meta.env.VITE_API_URL || '/api/v1';
  const url = `${baseUrl}${endpoint}`;
  
  const requestHeaders = new Headers(headers);
  requestHeaders.set('Content-Type', 'application/json');
  requestHeaders.set('X-Request-ID', crypto.randomUUID());
  
  if (!skipAuth) {
    const token = getStoredAccessToken();
    if (token) requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  let response = await fetch(url, {
    credentials: 'include',
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
    ...rest,
  });

  // 401 Handling: Refresh Token → Retry once
  if (response.status === 401 && !skipAuth && !requestHeaders.has('X-Retry')) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      requestHeaders.set('Authorization', `Bearer ${newToken}`);
      requestHeaders.set('X-Retry', 'true');
      response = await fetch(url, { credentials: 'include', headers: requestHeaders, body, ...rest });
    } else {
      logoutAndRedirect();
      throw new Error('AUTH_SESSION_EXPIRED');
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw createApiError(response.status, errorData);
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return {} as T;
  }

  return response.json();
}
```

### 6.2 Property API Hooks Pattern
```typescript
// src/features/property/api.ts

/** List all properties from DB */
export function useProperties() {
  return useQuery({
    queryKey: propertyKeys.all,
    queryFn: async () => {
      const res = await apiFetch<API.SuccessResponse<API.PropertyResponse[]>>('/properties');
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res.data;
    },
    staleTime: 30_000,
  });
}

/** Get property with rooms — backend returns {property, rooms} directly (no data wrapper) */
export function usePropertyWithRooms(propertyId: string | null) {
  return useQuery({
    queryKey: propertyKeys.detail(propertyId ?? ''),
    queryFn: async () => {
      const res = await apiFetch<API.PropertyWithRoomsResponse>(
        `/properties/${propertyId}/rooms`,
      );
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res as API.PropertyWithRoomsResponse;
    },
    enabled: !!propertyId,
    staleTime: 15_000,
  });
}

/** Create property — invalidates property list cache on success */
export function useCreateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: API.PropertyRequest) => {
      const res = await apiFetch<API.SuccessResponse<API.PropertyResponse>>('/properties', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: propertyKeys.all });
    },
  });
}
```

> ⚠️ **Note:** `GET /properties/{id}/rooms` returns `{property, rooms}` directly (no `data` wrapper),
> while `GET /properties` returns `{data: [...], meta: null}`. The hooks handle this difference.

### 6.3 Type Generation & Mocking
```bash
# CI/CD Pipeline
- name: Generate API Types
  run: npx openapi-typescript http://localhost:8000/openapi.json -o src/types/api.d.ts

# Development Mock
npm i -D msw
# src/mocks/handlers.ts → ใช้ openapi.json หรือเขียน manual match
# src/mocks/browser.ts → worker.start()
```
> ✅ **กฎ:** ห้ามเขียน type มือใน `src/types/` นอกเหนือจาก `api.d.ts` และ custom UI props

### 6.4 Error Format Mapping (Backend §3.5.2)
| Backend `error.code` Prefix | Frontend Behavior | i18n Key |
|----------------------------|-------------------|----------|
| `FR-xxx` / `BR-xxx` | Business error toast / inline message | `error.business.{code}` |
| `VAL-xxx` | Form field highlight + tooltip | `error.validation.{code}` |
| `AUTH-xxx` | Redirect `/login` or show session modal | `error.auth.{code}` |
| `SYS-xxx` | Generic "เกิดข้อผิดพลาด" + log to Sentry | `error.system.{code}` |