# Frontend Testing Patterns (Phase 4)

> คู่มือนี้รวบรวม patterns ที่ใช้จริงใน Phase 4 (Tasks 0-7.3) ของโปรเจกต์นี้
> อ้างอิงจาก: `src/test/templates/COMPONENT_TEMPLATE.test.tsx`

## 1. Overview

- Framework: Vitest + React Testing Library + MSW
- Test types: Unit (hooks, utils), Integration (components with API mocks)
- Coverage threshold: 80% statements / 75% branches / 80% functions / 80% lines
- Execution: Docker-First via `docker-compose.test.yml`

## 2. Test File Structure

### 2.1 File Naming
- Components: `ComponentName.test.tsx` (colocated with component)
- Hooks: `useHookName.test.ts` หรือ `.test.tsx` (colocated)
- Utils: `utilName.test.ts` (colocated)

### 2.2 Import Block Pattern
```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import ComponentUnderTest from './ComponentUnderTest';
```

## 3. renderPage() Helper Pattern

### 3.1 Standard renderPage()
```typescript
function renderPage() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <MemoryRouter initialEntries={['/route-path']}>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <ToastProvider>
            <ComponentUnderTest />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
```

### 3.2 Why retry: false + gcTime: 0?
- `retry: false`: ป้องกัน test hang จาก network retry
- `gcTime: 0`: ป้องกัน cache pollution ระหว่าง tests

### 3.3 When to Customize
- ใช้ route params → `initialEntries={['/path/:id', { id: '123' }]}`
- Skip AuthProvider → สำหรับ public routes
- Add providers → สำหรับ features ที่ใช้ custom providers

## 4. MSW Patterns

### 4.1 Lifecycle Hooks (ต้องเหมือนกันทุกไฟล์)
```typescript
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### 4.2 Per-Test Handler Override
```typescript
it('handles API error', async () => {
  server.use(
    http.get('*/api/v1/endpoint', () => {
      return HttpResponse.json(
        { error: { code: 'SYS-500', message: 'Internal error' } },
        { status: 500 },
      );
    }),
  );
  renderPage();
  expect(await screen.findByText(/error/i)).toBeInTheDocument();
});
```

### 4.3 Success Response Pattern
```typescript
server.use(
  http.get('*/api/v1/endpoint', () => {
    return HttpResponse.json({ data: { id: '1', name: 'Test' } });
  }),
);
```

## 5. Async Handling

### 5.1 findBy* vs getBy*
- `findByText` → auto-retry (ใช้สำหรับ async content)
- `getByText` → immediate (ใช้สำหรับ static content)

### 5.2 waitFor with Timeout
```typescript
await waitFor(() => {
  expect(screen.queryByText('Loading')).not.toBeInTheDocument();
}, { timeout: 5000 });
```

### 5.3 userEvent Pattern
```typescript
const user = userEvent.setup();  // สร้างใหม่ทุก test
await user.click(button);        // await ทุก interaction
await user.type(input, 'value');
```

## 6. Accessible Selectors

### 6.1 Preference Order
1. `getByRole` — semantics-based (ดีที่สุด)
2. `getByLabelText` — form inputs
3. `getByText` — text content
4. `getByTestId` — last resort

### 6.2 Regex Matchers for Composite Names
```typescript
// ✅ ถูก — element ที่มี child text
screen.getByRole('button', { name: /Room 101/ });

// ❌ ผิด — exact match จะ fail ถ้ามี child text
screen.getByRole('button', { name: 'Room 101' });
```

### 6.3 Modal Disambiguation
```typescript
// ใช้ findByRole('dialog') เพื่อแยก modal จาก page button
expect(await screen.findByRole('dialog')).toBeInTheDocument();
```

## 7. Common Gotchas (จาก Phase 4)

### 7.1 Date/Currency Formatting
- `formatDate` → en-GB: "01 Jan 2026" (ไม่ใช่ "Jan 1, 2026")
- `toLocaleString('en-GB')` → "15/06/2026, 10:00:00"
- Number formatting: ฿5,000 (มี comma)

### 7.2 Safe Coercion
```typescript
// ✅ ปลอดภัย
String(value ?? '').toLowerCase()

// ❌ อาจ crash ถ้า value เป็น null/undefined
value.toLowerCase()
```

### 7.3 Module-Level Caching
- ถ้า module มี module-level state (เช่น dbPromise) → ต้องมี reset function
- เรียก reset ใน beforeEach ของ test

### 7.4 OOM from Lazy Routes
- อย่า import AppRoutes ทั้งหมดใน test
- ทดสอบ route guards (ProtectedRoute, GuestRoute) โดยตรงแทน

### 7.5 Button Type Override
- ถ้า Button component มี `type="button"` default แต่ {...rest} overrides → submit อาจไม่ทำงาน
- ใช้ `fireEvent.submit(form)` แทน `userEvent.click(submitButton)` ในบางกรณี

### 7.6 Unused Imports
- ESLint ใช้ `--max-warnings 0` → unused import = error
- ลบ unused imports ก่อน commit

### 7.7 react-doctor Exemption
- Test files ได้ exemption จาก react-doctor rules (config ใน eslint.config.js)
- ไม่ต้องใช้ `eslint-disable` comments

## 8. Docker-First Testing

### 8.1 Run Tests
```bash
docker compose -f docker-compose.test.yml run --rm frontend-test \
  npx vitest run

docker compose -f docker-compose.test.yml run --rm frontend-test \
  npx vitest run src/features/X/ --coverage
```

### 8.2 Resource Policy
```
✅ Default: Containers OFF
✅ Start: เฉพาะเมื่อ actively testing
✅ End: ปิด containers หลังเสร็จ (docker compose down)
```

### 8.3 Makefile Commands
```bash
make test-frontend    # Vitest unit tests
make lint-frontend    # ESLint + TSC
make dev-down         # Stop all containers
```

## 9. Template Reference

- **Test template:** `src/test/templates/COMPONENT_TEMPLATE.test.tsx`
- **Usage:** Copy template → rename → customize test cases
- **Exclude from vitest:** Template excluded ใน vite.config.ts

## 10. Debugging Tips

### 10.1 Test Fails in Full Suite but Passes in Isolation
- สาเหตุ: State pollution จาก tests อื่น
- แก้: Reset module-level state ใน beforeEach
- หรือ: ใช้ `vi.resetModules()` + re-import

### 10.2 "Unable to find element" Errors
- ตรวจสอบว่า data ถูก render แล้ว (ใช้ findBy* แทน getBy*)
- ตรวจสอบว่า MSW handler ถูกเรียก (console.log ใน handler)
- ตรวจสอบว่า test ใช้ route ที่ถูกต้อง

### 10.3 Coverage Not Reaching 80%
- ใช้ `--coverage` flag ดู uncovered lines
- เขียน tests เพิ่มสำหรับ uncovered branches
- อย่า test implementation details (ไม่เพิ่ม coverage จริง)
