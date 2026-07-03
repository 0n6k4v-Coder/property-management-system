# Frontend Code Style & Quality Guidelines

## 1. Language & Tooling
- TypeScript 5.8+ (Strict Mode)
- React 19.2.6+ (Functional Components, Hooks only)
- ESLint (Flat Config) + Prettier + `eslint-plugin-react-doctor`

## 2. File & Naming Conventions
- Components: `PascalCase.tsx` (e.g., `LoginPage.tsx`)
- Hooks: `use<PascalCase>.ts` (e.g., `useAuthSession.ts`)
- Utils: `camelCase.ts` (e.g., `formatCurrency.ts`)
- Tests: `*.test.tsx` หรือ `*.spec.tsx` คู่กับไฟล์ต้นทาง

## 3. React Best Practices (บังคับผ่าน ESLint/React Doctor)
- ❌ ห้ามใช้ `useEffect` สำหรับ derived state → คำนวณใน render แทน
- ❌ ห้าม `fetch` ใน `useEffect` → ใช้ TanStack Query หรือ wrapper
- ✅ Props ≤ 3 ตัว → ใช้ destructuring, >3 ตัว → ใช้ object prop
- ✅ Components ≤ 150 บรรทัด → แยกเป็น sub-components

## 4. State & Data Flow
- Server State → `@tanstack/react-query` (ห้ามเก็บใน localStorage)
- Auth/Session → React Context + `useReducer`
- Form State → React Hook Form + Zod validation
- Offline Queue → IndexedDB (`idb`) เท่านั้น

## 5. Accessibility & UX
- ทุก `<input>` ต้องมี `<label>` หรือ `aria-label`
- Contrast ratio ≥ 4.5:1 (Tailwind default ผ่านอยู่แล้ว)
- Touch target ≥ 44×44px
- Error messages ใช้ `aria-live="polite"` + `role="alert"`

## 6. Testing Rules
- Unit: Vitest + RTL (coverage ≥80%)
- Integration: MSW mock `fetch` (coverage ≥75%)
- ❌ ห้าม skip test โดยไม่มีเหตุผล → ใช้ `test.skip()` พร้อม comment
- ✅ Test ชื่อสื่อถึง behavior: `test('shows error on 401 response')`

## 7. Git & CI Gates
- Pre-commit: `eslint --fix` + `tsc --noEmit` + `prettier --check`
- CI: `--max-warnings 0`, React Doctor score ≥ 90, Bundle ≤ 150KB (gzip)
- ❌ PR จะไม่ถูก merge หาก quality gates ผ่านไม่ครบ