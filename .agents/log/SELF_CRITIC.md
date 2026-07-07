# Self-Critique Log — Agent: nemotron-3-ultra-550b-a55b → tencent/hy3:free

**Purpose:**
เก็บบันทึก Self-Critique ของ Agent เพื่ออ่านก่อนเริ่มดำเนินการใด ๆ ในครั้งถัดไป
เป้าหมาย: ไม่ให้ทำผิดซ้ำกับที่เคยเกิดขึ้นมาแล้ว

**วิธีอ่าน (สำคัญ):**
1. อ่าน **STANDING RULES** (ส่วนบน) ทุกครั้งก่อนเริ่มงาน — นี่คือ "สัญญาไม่ให้พลาด" ที่รวบจากทุก Session แล้วตัดซ้ำ
2. ดู **Session Index** เพื่อเลือกอ่าน ARCHIVE ตามประเภทงาน (Docker / E2E / Doc-edit)
3. ARCHIVE ด้านล่างคือ narrative เต็ม อ่านเฉพาะตอนงานตรงกับ Session นั้น — ห้ามอ่านทั้งหมดทุกครั้ง (เปลือง context)

══════════════════════════════════════════════════
# ⛔ STANDING RULES — อ่านส่วนนี้ทุก Session (รวบจาก A/B/C ตัดซ้ำ)
══════════════════════════════════════════════════

R1. ห้ามประกาศ "จบ/เสร็จ" ก่อน verify จริง
    - ต้องรันคำสั่งตรวจสอบ (docker ps / wc / read / test) และเห็นผลถูกต้อง แล้วค่อยรายงาน
    - Source: Session B, C

R2. Docker cleanup — Observe → Act → Verify → Prune (ห้ามเดา)
    ```
    docker ps -a                                          # Observe
    docker compose -p <project> down -v --remove-orphans # Act (ใช้ -p ตรงๆ)
    docker ps -a                                          # Verify ว่าว่าง
    docker system prune -af --volumes                     # Prune
    ```
    - ห้ามเดาชื่อ project จากชื่อ directory → หาจาก `docker compose ls` / `docker ps --format '{{.Names}}'`
    - ห้ามเชื่อ empty success: `compose down` คืนค่าว่าง = ไม่มีอะไรโดนลบ ไม่ใช่ "สำเร็จ"
    - อย่ารัน compose file ที่ไม่แน่ใจว่ารันอยู่ (prod compose มี env required จะ error เปล่า)
    - Source: Session B

R3. E2E / backend error test — เช็ค error path อย่างน้อย 1 รอบก่อนเขียน
    - อ่าน `frontend/src/shared/api/fetchClient.ts` ก่อนเขียน test ที่คาดหวัง backend error
      (FastAPI HTTPException ส่ง `{detail}` ไม่ใช่ `{error}`)
    - อ่าน Zod schema (`useXForm.ts`) ก่อนเขียน form/validation test — สิ่งที่ client บล็อกจะไม่ถึง server
    - Source: Session A

R4. แก้ไฟล์ / doc edit เล็กๆ
    - Path ที่ผู้ใช้ให้มา → `read_file` ตรงๆ ห้ามเสียเวลา search_files เดา
    - ต่อท้าย log ธรรมดา → ใช้ `patch` mode ต่อท้าย ไม่ต้อง rewrite ทั้งไฟล์
    - ถ้าต้องแทรกหัว/กลาง → `read_file` ใหม่ทันทีก่อน `write_file` (กัน external edit clobber)
    - หลีกเลี่ยง markdown table ใน CLI → ใช้ plain text / indent
    - Source: Session C

R5. E2E general discipline (จาก Session A)
    - ใช้ `SEEDED.*` จาก `frontend/e2e/fixtures/seeded-ids.ts` ห้าม hardcode UUID
    - Debug ด้วย `npx playwright test -g "TEST_NAME" --headed` อย่ารันทั้ง suite
    - ห้าม `page.route()` mock — fullstack เท่านั้น
    - เลือก `billing_month` ไม่ซ้ำกับ seed (July=7) และไม่ซ้ำกับ test อื่น
    - Source: Session A

══════════════════════════════════════════════════
# 📑 SESSION INDEX — เลือกอ่าน ARCHIVE ตามประเภทงาน
══════════════════════════════════════════════════

| # | Date | ประเภทงาน | Task | Verdict |
|---|------|-----------|------|---------|
| A | 2026-07-07 | E2E / backend error test | Extend `meter-offline-sync.spec.ts` (METER-03~06) | Time 6/10, Quality 9/10 |
| B | 2026-07-07 | Docker cleanup | `docker compose down` ทุก container + prune | Time 3/10, Quality 5/10 |
| C | 2026-07-07 | Doc/log edit | เพิ่ม Session B ลง `SELF_CRITIC.md` | Time 7/10, Quality 8/10 |

> ทำ E2E/error test → อ่าน Archive A · ทำ Docker cleanup → อ่าน Archive B · แก้ไฟล์เล็กๆ → อ่าน Archive C

══════════════════════════════════════════════════
# 🗄️ ARCHIVE (reference only — อ่านเฉพาะตอนงานตรงกับ Session)
══════════════════════════════════════════════════

## SESSION A — E2E Spec Extension (2026-07-07)

**Task:** Extended `frontend/e2e/specs/meter-offline-sync.spec.ts` (Route 8 `/meter-reading`)
to cover METER-03~06 (fullstack, zero mocks).
**Total Session Time:** ~1h 54m

### 1. Performance Summary
| Phase | Actual | Expected | Delta |
|-------|--------|----------|-------|
| Code audit & verification | 15m | 10m | +5m |
| Spec extension (5 tests) | 25m | 20m | +5m |
| Bug discovery & fix (`fetchClient.ts`) | 45m | 15m | **+30m** |
| Test runs & flakiness resolution | 25m | 20m | +5m |
| Verification & docs | 8m | 10m | -2m |

**Verdict:** Time 6/10 (over ~40m จาก assumption error format ผิด) · Quality 9/10 (root cause fixed, 7/7 pass) · Process 7/10

### 2. Bottlenecks
1. Backend error format mismatch — ไม่เช็ค `fetchClient.ts` รองรับ `{detail}` หรือไม่ (สมมติ `{error}`) → 30m
2. Test flakiness / state pollution — seed July ชน test month → 15m
3. Client vs server validation — METER-04 Zod บล็อก submit ก่อนถึง server → 15m
4. Container startup variance — docker cold start login timeout → 10m

### 3. Mistakes
- สมมติ error format โดยไม่เช็ค `fetchClient.ts` → อ่านก่อนเขียน test
- ไม่ trace client validation → อ่าน Zod schema ก่อน
- Hardcode regex `"Value error, "` → ใช้ `/Value error/` ตั้งแต่แรก
- ไม่ใช้ single-test iteration → ใช้ `-g "NAME"` ตอน debug

### 4. What Went Well
- Systematic audit ก่อนเขียนโค้ด · Reuse `SEEDED.*` · Assert-absence tests · Fixed root cause (patch fetchClient) · State isolation

### 5. AGENTS.md Rule (already applied)
> ❗ ก่อนเขียน test สำหรับ backend error: ต้อง verify `fetchClient.ts` handle error format จริง (FastAPI `{detail}` ไม่ใช่ `{error}`)

### 6. Pre-Task Checklist
- [ ] อ่าน `fetchClient.ts` ถ้าคาดหวัง backend error
- [ ] อ่าน Zod schema (`useXForm.ts`) ถ้าเขียน form/validation test
- [ ] ใช้ `SEEDED.*` ห้าม hardcode UUID
- [ ] เลือก `billing_month` ไม่ซ้ำ seed/test
- [ ] Debug `-g "NAME"` อย่ารันทั้ง suite
- [ ] ห้าม `page.route()` mock
- [ ] สุดท้าย: `./scripts/reset-e2e-db.sh` แล้วรัน playwright

---

## SESSION B — Docker Full Cleanup (2026-07-07)

**Task:** `docker compose down` ทุก container + prune image/volume/network ทั้งหมด
(เจตนา: ล้าง dev stack ตาม Resource Policy — Containers OFF default)
**Total Session Time:** ~12m (รวมรอบที่ user เตือน 1 ครั้ง)

### 1. Performance Summary
| Phase | Actual | Expected | Delta |
|-------|--------|----------|-------|
| Observe state (`docker ps -a`) | 0m (ข้ามไป) | 2m | **-2m** |
| ทายผิด + down ซ้ำ (dev/prod) | ~6m | 0m | **+6m** |
| ถูก user เตือน + ตรวจสอบใหม่ | ~4m | 0m | **+4m** |
| Correct down (`-p pms-dev`) | ~1m | 2m | -1m |
| Prune images + verify | ~1m | 1m | 0m |

**Verdict:** Time 3/10 (9 คำสั่งควร 3 + ถูกเตือน 1 รอบ) · Quality 5/10 (ประกาศจบ 2 ครั้งก่อน verify ทั้งคู่ผิด) · Process 2/10 (เดา project name)

### 2. Bottlenecks
1. ไม่เช็ค state ก่อน down — เดาว่า default = ชื่อ directory → ~8m
2. เชื่อ empty success — `compose -f dev down` คืนค่าว่าง = ไม่มีอะไรโดนลบ แต่บอกสะอาด → ~4m
3. รัน prod compose โดยเปล่าเหตุ — error ขาด MINIO_SECRET_KEY → ~1m

### 3. Mistakes
- เดา project name จากชื่อ directory → container จริงใช้ `pms-dev` down ไม่โดน → รัน `docker ps -a`/`compose ls` ก่อน
- ประกาศสะอาดจาก empty output → ยืนยัน `docker ps -a` ว่างก่อนจบ
- รัน prune ไม่แน่ใจหยุดหมด → Observe→Act(-p)→Verify→Prune
- ไม่ใช้ `-p` ตรงๆ → `docker compose -p <project> down -v`

### 4. What Went Well
- ยอมรับผิดโปร่งใส สแกน `docker ps -a` ทันที · หยุดถูกต้องด้วย `-p pms-dev` · Prune หมดจริง + verify ว่าง

### 5. AGENTS.md Rule (PENDING approval)
> ❗ ก่อน `docker compose down`: รัน `docker ps -a` + `docker compose ls` ดู project name จริง แล้วใช้ `-p <project>` ตรงๆ — ห้ามเดาจากชื่อ directory และห้ามประกาศจบก่อน verify `docker ps -a` ว่าง

### 6. Pre-Task Checklist
- [ ] รัน `docker ps -a` ก่อนลงมือ
- [ ] รัน `docker compose ls` ดู project name จริง
- [ ] `docker compose -p <project> down -v --remove-orphans`
- [ ] verify `docker ps -a` ว่างก่อนจบ
- [ ] อย่ารัน `-f docker-compose.prod.yml down` ถ้าไม่แน่ใจมี prod รัน
- [ ] `docker image prune -af` แล้วเช็ค `docker images`
- [ ] สุดท้าย `docker system prune -af --volumes`

---

## SESSION C — Log-Edit Self-Critique (2026-07-07)

**Task:** เพิ่ม Session B ลง `.agents/log/SELF_CRITIC.md` เป็น reference ไม่ให้ผิดซ้ำ
**Total Session Time:** ~6m (6 tool calls)

### 1. Performance Summary
| Phase | Actual | Expected | Delta |
|-------|--------|----------|-------|
| Search ผิดทาง (search_files x2 → find) | ~2m | 0m | **+2m** |
| Read + rewrite ทั้งไฟล์ | ~1m | 1m | 0m |
| Verify (wc/head/tail) | ~1m | 1m | 0m |

**Verdict:** Time 7/10 (เสีย 1 รอบฟรีจาก search) · Quality 8/10 · Process 7/10 (verify ดี แต่ยังประกาศจบก่อน verify)

### 2. Bottlenecks
1. หลงทางที่ search_files — path อยู่ในมือแล้วแต่ไป search → ได้ 0 → fallback find → ~2m
2. Full rewrite แทน patch — ได้ warning "file modified since read" (จุดเสี่ยง clobber) → ~1m

### 3. Mistakes
- เสียเวลา search ไฟล์ที่ path อยู่ในมือ → `read_file` ตรงๆ
- ใช้ markdown table ตอบ CLI → ใช้ plain text
- ประกาศเสร็จก่อน verify → ฟันธงจบหลัง verify
- ไม่ re-read หลัง warning external edit → read ใหม่ก่อน write

### 4. What Went Well
- เก็บ Session A ครบ · เพิ่ม Session Index ที่หัว · ไม่ลาม scope (PENDING) · verify หลังเขียน

### 5. Pre-Task Checklist
- [ ] `read_file` จาก path ผู้ใช้ให้ ไม่ search
- [ ] ต่อท้าย log → `patch` ไม่ rewrite
- [ ] แทรกหัว/กลาง → `read_file` ใหม่ก่อน `write_file`
- [ ] หลีกเลี่ยง markdown table ใน CLI
- [ ] รัน verify ก่อนประกาศจบ
