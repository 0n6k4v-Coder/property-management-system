# File: frontend/docs/02-design/SDD/08-implementation.md
# Implementation Checklist & Change Control
## Property Management System (Client-Side)

---

## 10. Implementation Checklist & Change Control

### 10.1 Pre-Implementation Checklist
- [ ] `openapi.json` generate สำเร็จ → `src/types/api.d.ts` ตรง spec
- [ ] `fetchClient.ts` + error mapper ทำงาน (attach token, 401 refresh retry, error mapping)
- [ ] React Router v7 config + `ProtectedRoute` ผ่าน test
- [ ] `useAuth` hook เก็บ/ลบ token ได้, redirect ถูกต้อง
- [ ] ทุกหน้าใน §2.2 มี `React.lazy()` wrapper ใน `routes/index.tsx`
- [ ] โครงสร้าง `features/` เริ่มแบบ Flat ตาม §4.3
- [ ] Vite build, ESLint, TSC, Vitest ผ่าน 100% ใน local
- [ ] MSW mock setup สำหรับ dev mode (ดัก native `fetch` อัตโนมัติ)

### 10.2 Change Control Protocol
```text
เมื่อมีการเปลี่ยนแปลง UI/State/API Integration:
1. แก้ Frontend SDD (ไฟล์นี้) ก่อนเสมอ
2. อัปเดต Traceability Matrix (§9) + Test Files
3. รัน tsc --noEmit + vitest + lighthouse ci
4. หากเปลี่ยน API contract → รัน generate:types ใหม่ → แก้ type error → notify backend team
5. หากแยกโฟลเดอร์โมดูล (Nesting) → อัปเดต index.ts Facade + routes/index.tsx imports
6. บันทึก commit message: "feat(frontend): add meter offline queue (#FR-METER-01)"

ห้าม:
- เพิ่ม API call โดยไม่ผ่าน src/shared/api/fetchClient.ts
- เขียน type ใน src/types/ นอก api.d.ts
- ข้าม test coverage gate
- แก้ SDD โดยไม่อัปเดต Traceability Matrix
```

---

> ℹ️ **หมายเหตุ:** เอกสารนี้เป็น living document — อัปเดตเมื่อมี screen ใหม่, เปลี่ยน state strategy, หรือปรับ API contract
> 🔄 **Change Control:** แก้ Frontend SDD → อัปเดต Traceability Matrix + Test Files + Run CI Gates
> 🤖 **สำหรับ AI Agent:** อ่านไฟล์นี้ + `docs/SDD.md §3.5` + `frontend/docs/ARCHITECTURE.md` ก่อนสร้าง component ทุกครั้ง
> 👨‍💻 **สำหรับ Human:** ใช้เอกสารนี้เป็น checklist ใน PR review, ตรวจสอบ layer responsibility, type safety, และ traceability

✅ **Status:** DRAFT — Ready for Frontend Lead & QA Review
📅 **Last Updated:** 2026-05-24