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

R6. เขียน data-mutating test — อ่าน repo guard / status transition ก่อน
    - ก่อน POST/PATCH/DELETE ใน E2E ให้อ่าน guard ของ repository method + allowed
      status transition ของ entity
    - ตัวอย่าง: `repo.record_payment` ปฏิเสธทุกการจ่ายนอก `status in (DRAFT, ISSUED)`
      → จ่ายครั้งที่ 2 หลัง test อื่นเปลี่ยนสถานะเป็น PARTIAL = 422 (ไม่ใช่ backend bug)
    - ออกแบบ mutate-test ให้เป็น sole mutator ของ fixture นั้น หรือ assert-absence
      ไม่ mutate — ห้ามให้ test หนึ่ง mutate แล้วทำลาย test อื่นในไฟล์เดียวกัน
    - Source: Session 4

R7. Verify step 0 — migration + table ต้องมีก่อนรันเทสแรก
    - ก่อน Playwright run แรก: `alembic upgrade head` (ถ้ามigration ยังไม่รัน) แล้ว
      `./scripts/reset-e2e-db.sh`
    - reset script อาจรายงาน "seeded" แต่จริงๆ DB ไม่มี table (migration ถูกข้าม) —
      อย่ารอเทส failed ค่อยรู้ ให้เช็ค `\dt` / row count ล่วงหน้า
    - Source: Session 4

R8. เขียน/append ไฟล์ log หรือ doc — เช็ค BOTH ดิสก์และ git ก่อน
    - ไฟล์อาจ **tracked แต่หายจาก working tree** (ดิสก์ว่างเปล่า แต่ git มี) →
      `write_file` จะเขียนทับ silently โดยไม่เตือน (อันตราย)
    - ก่อน create/append: `git ls-files <path>` (tracked?) + `read_file`/`test -f`
      (ดิสก์มี?) → ถ้า tracked = append ด้วย `patch` ห้าม `write_file` ทั้งไฟล์
    - Source: Task ล่าสุด (ทับ SELF_CRITIC.md เอง → ต้อง `git checkout` กู้คืน)

R9. ผู้ใช้ทักสงสัยเรื่องทับ/ลบไฟล์ — `git diff`/`git status` ทันทีก่อนตอบ
    - อย่าปกป้องหรือฟันธง "ไม่ได้ทับ" ก่อนเช็ค vcs จริง
    - ถ้าพบทับจริง: กู้คืนก่อนอธิบาย (`git checkout HEAD -- <path>`)
    - Source: Task ล่าสุด (ตอบ "ไม่ได้ทับ" ก่อน verify → ผิด)

R10. Parallel-session shared-DB coordination — ห้ามพังงานคู่ขนาน
    - ถ้ามี 2 agent รันบน branch/working tree เดียวกัน: ห้าม `reset-e2e-db.sh` หรือรัน
      `frontend-test` ขณะมี `pms-dev-frontend-test-run-*` container ลอยอยู่
      (reset ตัดตาราง fixture ทั้งหมด → ทำลายรันของคู่ขนาน)
    - ก่อน reset/run: `docker ps --format '{{.Names}}' | grep frontend-test`
      ถ้ามี → poll ทุก ~10-15s รอให้หายก่อน (อย่ารันทับ)
    - ห้าม `docker compose down` ขณะ session อื่นอาจกำลังรัน → กระทบ fixture กลาง
    - Source: Session D (parallel maintenance-flow)

R11. Selector precise + grep-after-patch
    - เขียน locator เจาะจงรูปทรง route ไม่ใช่ prefix กว้าง
      (เช่น `/maintenance/<uuid>` ไม่ใช่ `/maintenance/` ซึ่งจับปุ่ม `/maintenance/new` ด้วย)
    - หลัง patch เปลี่ยน selector → `search_files` หา occurrence เก่าที่เหลือในไฟล์
      ก่อนรันใหม่ (ชวด block → เสียรอบฟรี)
    - Source: Session D

R12. เก็บ Playwright output เต็ม — ห้าม `tail` ตัด
    - `tail -40` ตัด error message ทำให้ diagnosis 瞎 → ใช้ `--reporter=line` แล้วอ่าน
      process log ครบ หรือ redirect `2>&1` เก็บทั้งหมด
    - Source: Session D

R13. ก่อนเขียน E2E ที่แตะ form ใดๆ → สกัด DOM contract จริงลง checklist ก่อนพิมพ์ selector
    - ห้ามเชื่อชื่อ field จาก audit/compaction summary — อ่าน component จริงแล้วจด:
      · ทุก `<Input label="X">` → id = `input-X` (และเช็คว่า label มี suff*ix อื่นไหม
        เช่น `"(THB)"`, `" *"`) → `getByLabel` ต้องใช้ regex `/x/i` ไม่ใช่ exact string
      · ทุก `<select>`/`<input>` ธรรมดา → อ่าน `id`/`htmlFor` จริง (ไม่ใช่ `getByLabel` เสมอไป)
      · option text จริง (เช่น `"103 (studio) — available"`) → `selectOption` ใช้ `value: <SEEDED.id>`
        ไม่ใช่ `{ label: '103' }` (regex ไม่รับใน selectOption)
      · หลัง submit นำทางไปไหน → `toHaveURL` เช็คให้ตรง (อย่าสมมติ `/contracts/{id}`)
    - Source: Session E (contract-flow — เดาผิด label/nav → เสีย 1 รอบเต็ม)

R14. reset-e2e-db ก่อน EVERY playwright run + iterate ด้วย `-g` filtered ไม่ใช่ full suite
    - Prompt บอกชัด: `./scripts/reset-e2e-db.sh` before every run — ห้ามข้ามแม้รันซ้ำติดกัน
      (ไม่ reset → fixture pollution BR-01 ชนกันระหว่างรอบ → false failure)
    - ตอน iterate แก้ selector/bug → รัน `npx playwright test -g "TEST_NAME"` (~5s) ไม่ใช่
      full suite (~48s) ทุกครั้ง; สงวน full-file สำหรับ final confirm 2 รอบ
    - Source: Session E (ไม่ reset ระหว่างรอบ → เสีย 1-2 รอบ; รันเต็มซ้ำๆ → เสียเวลา)

R15. ได้ deterministic ID ผ่าน docker → รันเลย อย่า clarify ถ้า option ชัด
    - ถ้าต้องได้ UUID/seed value ที่คำนวณจาก namespace → `docker compose run --rm --no-deps
      backend python -c "..."` (Docker-First) แล้วรายงานผล; ห้าม clarify ถ้า option 1 ชัดเจน
    - Source: Session E (ถามผู้ใช้เลือก option ที่ชัดอยู่แล้ว → เสีย 1 round-trip ฟรี)

R16. Docker compose ต้องระบุ `-f` + ห้าม buffer long run + authz/claim bug ต้องอ่าน chain ครบก่อนแก้
    - **Compose flag:** คำสั่งที่รันผ่าน docker compose เสมอเติม `-f docker-compose.dev.yml`
      (Makefile กำหนด `COMPOSE_FILE ?= docker-compose.dev.yml` แต่ CLI สั่งตรงไม่สืบทอด env →
      ข้าม flag จะได้ "no configuration file provided: not found" → เสียรอบฟรี)
    - **ห้าม buffer long run:** ห้าม `| tail` บน timeout ยาว (เช่น 420s) → output หาย 盲等;
      ให้ redirect `> /tmp/x.log 2>&1` แล้ว `process/wait` poll log แทน (R12 ช่วยแล้ว แต่เน้น long-run)
    - **Authz/claim bug:** ก่อน patch RBAC/owner-gate ต้องอ่าน chain 3 ชั้นให้ครบ:
      (1) decorator อ่าน claim ตัวไหน (2) token issuance เซ็ต claim ไหม (3) users table มี column นั้นไหม
      → อ่านครบก่อนแก้ จบในรอบเดียว ไม่วน patch ทีละชั้น (Session E2 โดน 403 วน 3 รอบ)
    - **Hot-reload gap:** แก้ router/service เสร็จ → `restart backend` ก่อน curl verify เสมอ
      (uvicorn dev ไม่เห็น router edit ทันที → ยัง 422/403 จนกว่าจะ restart)
    - Source: Session E2 (settings-flow — เสียรอบฟรีจาก compose flag + buffered 420s + F-62 วน 3 รอบ)

R17. Master Pre-Flight ก่อนรัน E2E/verify ใดๆ (รวบ R6/R7/R14/R16 — กัน re-run ฟรีจาก compliance gap)
    ```
    alembic upgrade head                          # R7: migration ก่อน reset
    ./scripts/reset-e2e-db.sh                     # R6/R14: clean fixture ทุกครั้ง
    docker compose -f docker-compose.dev.yml ...  # R16: เติม -f เสมอ
    curl หน้า login 1 รอบ (pre-warm)              # R12/R5: ลด cold-start flake
    npx playwright test -g "NAME"                 # R14: filtered ตอน debug ห้าม full
    ```
    - ห้ามข้ามขั้นตอนใดๆ แม้รันซ้ำติดกัน (ละเมิด = เสียรอบฟรีซ้ำรอยเดิม)
    - Source: Meta-analysis 2026-07-10 (พบ compliance gap — มี rule แล้วแต่ไม่เช็คก่อนลงมือ)

═════════════════════════════════════════════════
# 📑 SESSION INDEX — เลือกอ่าน ARCHIVE ตามประเภทงาน
══════════════════════════════════════════════════

| # | Date | ประเภทงาน | Task | Verdict |
|---|------|-----------|------|---------|
| A | 2026-07-07 | E2E / backend error test | Extend `meter-offline-sync.spec.ts` (METER-03~06) | Time 6/10, Quality 9/10 |
| B | 2026-07-07 | Docker cleanup | `docker compose down` ทุก container + prune | Time 3/10, Quality 5/10 |
| C | 2026-07-07 | Doc/log edit | เพิ่ม Session B ลง `SELF_CRITIC.md` | Time 7/10, Quality 8/10 |
| 4 | 2026-07-07 | E2E (Route 9/10) | Extend `invoice-payment.spec.ts` (INV-02~08, INV-DET-03~06) 4→14 tests | Time 5/10, Quality 9/10 |
| D | 2026-07-07 | E2E (Route 16/17) + parallel | Extend `maintenance-flow.spec.ts` (MAINT-03~07) + หาแก้บั๊กจริง F-30 ในสภาพ 2 agent แชร์ working tree | Time 6/10, Quality 9/10 |
| E | 2026-07-07 | E2E (Route 13/14) + parallel | Extend `contract-flow.spec.ts` (CONT-02~08, CONT-NEW-01~06) 4→13 tests + หาแก้บั๊กจริง F-21 ในสภาพ 2 agent แชร์ working tree | Time 6/10, Quality 9/10 |
| C2 | 2026-07-07 | E2E (Route 15) + parallel | Extend `contract-flow.spec.ts` (CONT-DET-01~05 assert-absence/cross-ref) 13→15 tests + doc (Route 15 + F-40/F-41) ในสภาพ 3 agent แชร์ working tree | Time 7/10, Quality 10/10 |
| D2 | 2026-07-07 | E2E (Route 17) + parallel | Extend `maintenance-flow.spec.ts` (MAINT-NEW-01~05: 2 assert-absence + 1 real priority-verify + 2 cross-ref) 8→11 tests ในสภาพ 3 agent แชร์ working tree | Time 8/10, Quality 9/10 |
| E2 | 2026-07-07 | E2E (Route 13/14) + backend bug-fix | สร้าง `settings-flow.spec.ts` ใหม่ 13 tests (SET-00 + SET-01~08 assert-absence + SET-REAL-01~04) + แก้ backend bug จริง F-60/61/62/63 (owner-gate/metadata/property_id) | Time 6/10, Quality 9/10 |
| META | 2026-07-10 | Cross-Session Meta-Analysis | วิเคราะห์ Time/Quality/Bottleneck 9 sessions (A~E2) + สร้าง R17 | Time n/a · Quality n/a |
| F | 2026-07-10 | Backend feature (Auth redesign) + multi-agent orchestration | Implement Auth Module Redesign — 9/10 API anti-patterns (#1,3,5,6,7,11,12,17,23) fixed in code; verified Docker-free (unit tests only) per explicit Human constraint | Time 6/10, Quality 7/10, Process 5/10 |

---

## SESSION 4 — invoice-payment.spec.ts E2E (2026-07-07)

**Task:** Extend `frontend/e2e/specs/invoice-payment.spec.ts` 4→14 tests ครบ INV-02,03,04,06,07,08, INV-DET-03,04,05,06 (Route 9/10) แบบ fullstack ไม่ mock
**Total Session Time:** ~สูงกว่าคาด เพราะ verify-step โดน env (B1/B2) + ข้อผิดพลาด D1

### 1. Performance Summary
| Phase | Actual | Expected | Delta |
|-------|--------|----------|-------|
| Test design + write | ~ปกติ | ปกติ | 0 |
| B1: DB ไม่มี table → อัพ migrate + reset ใหม่ | ~+1 รอบ | 0 | **+1 รอบ** |
| B2: cold-start flake → รันหลายรอบจนมั่นใจ 14/14 | ~+2-3 รอบ | 0 | **+2-3 รอบ** |
| D1: INV-DET-06 2nd-payment 422 → isolation + แก้ | ~+1 รอบ | 0 | **+1 รอบ** |

**Verdict:** Time 5/10 (เสียรอบฟรีจาก B1/B2/D1) · Quality 9/10 (14/14 จริง ไม่หลอกเขียว) · Process 8/10 (isolation วินิจฉัยถูก แต่ verify ช้าไป)

### 2. Bottlenecks (env, not logic)
1. **B1:** reset script รายงาน "seeded" แต่ migration ยังไม่รัน → DB ว่าง → เสียรอบเดียวรู้ทีหลัง `alembic upgrade head`
2. **B2:** Cold-start flake — `docker run --rm frontend-test` compile Vite ใหม่ทุกครั้ง → เทสแรก h1 toContainText ทะลุ 30s บางรอบ → 13/14 สลับเทส (warm run ได้ 14/14 ตลอด) → environment flake class (cf. Session A bottleneck #4) ไม่ผ่อน assertion
3. **B3:** container 1GB limit ช้าโดยรวม

### 3. Mistakes
- **D1 (สำคัญ):** INV-DET-06 เดิมกดจ่ายครั้งที่ 2 หลัง test "record a payment" เปลี่ยนสถานะเป็น PARTIAL → `repo.record_payment` guard บล็อก → 422 ตก. วินิจฉัยด้วย isolation run (เดี่ยวผ่าน รวมตก) → ยืนยัน shared-state ordering ไม่ใช่ backend bug → แก้เป็น assert-absence ล้วน ไม่ผ่อน assertion → **เกิด R6**
- **D2:** สมมติ `#payment-history` id มี → จริงๆ ไม่มี (ใช้ title="Payment History") → patch locator ใหม่
- **D3:** INV-02 locator ใช้ `/^issued$/` anchored + `tr` filter → เปราะต่อ whitespace/DOM → ควร harden
- **D4:** ไล่ flake ด้วย full-suite หลายรอบก่อน isolate → ช้ากว่า necessary

### 4. What Went Well
- อ่าน SELF_CRITIC + audit โค้ดจริงก่อนเขียนเทส (R4/R5)
- isolation run พิสูจน์ INV-DET-06 = state-pollution ไม่ใช่ bug
- ไม่ผ่อน assertion เลย แม้เจอ flake บ่อย
- บันทึก F-13..F-19 (root cause + prevention) ลง `docs/LOG/E2E_TEST.md` Part F

### 5. Improvements to carry forward
- I1: mutate-test → อ่าน repo guard / status transition ก่อน (→ R6)
- I2: verify step 0 = migration + table ก่อนรันแรก (→ R7)
- I3: warm Vite (curl หน้าแรก) หรือรอ API response เฉพาะ แทน toContainText ที่ race กับ render
- I4: ดึง locator จาก DOM จริง (อ่าน component เต็ม) ไม่เดา id
- I5: isolate เทสที่สงสัย flake เร็วกว่า (ก่อน full-run 2-3 รอบ)

### 6. ⚠️ Meta-mistake (บันทึกด้วย): ทับไฟล์ SELF_CRITIC.md เอง
- ช่วงท้าย session ผู้ใช้สั่ง "สร้าง/เพิ่ม entry ลง SELF_CRITIC.md" → ผม `write_file` ทับทั้งไฟล์โดย **ไม่ read ก่อน** (ลืม R4 ของไฟล์เอง) + คิดผิดว่าไฟล์ไม่อยู่ดิสก์ (จริงๆ มีใน git 191 บรรทัด)
- แก้ไข: `git checkout HEAD -- .agents/log/SELF_CRITIC.md` กู้ของเดิม → แล้ว `patch` เพิ่ม R6/R7 + Session 4 ต่อท้าย (ไม่ rewrite)
- บทเรียน: คำสั่ง "สร้าง/เพิ่ม" ในบริบทไฟล์ที่มีอยู่ = **append ไม่ใช่ overwrite** เสมอ `read_file` ก่อน `write_file` แม้ผู้ใช้จะบอกสร้าง


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

---

## SESSION D — Parallel maintenance-flow E2E (2026-07-07)

**Task:** Extend `frontend/e2e/specs/maintenance-flow.spec.ts` 2→8 tests (MAINT-03~07 assert-absence + F-30 regression) + หาแก้บั๊กจริง (F-30 dead `/maintenance/:id` link บน `MaintenanceListPage.tsx`) ในสภาพ **2 agent แชร์ working tree เดียวกัน** (Session A ทำ `contract-flow.spec.ts` คู่ขนาน)
**Total Session Time:** ~ปกติ แต่อืดจาก verify-loop ยืดเยื้อ (รอบรันฟรี ~4-5 รอบ)

### 1. Performance Summary
| Phase | Actual | Expected | Delta |
|-------|--------|----------|-------|
| Code audit + หาบั๊กจริง | ปกติ | ปกติ | 0 |
| เขียนเทส + doc edits | ปกติ | ปกติ | 0 |
| B1: reset พังเพราะ migration ไม่เคยรัน | +1 รอบ | 0 | **+1 รอบ** |
| B2: selector กว้างจับปุ่ม New Request → 3 fail | +2 รอบ | 0 | **+2 รอบ** |
| D2: patch ชวด block Re-confirm → fail อีก | +1 รอบ | 0 | **+1 รอบ** |
| B3: ไม่ reset ระหว่างรอบ → stale state false-fail | +1 รอบ | 0 | **+1 รอบ** |
| B4: tail ตัด output → ต้อง process log เพิ่ม | ~+1 รอบ | 0 | **+1 รอบ** |

**Verdict:** Time 6/10 (เสียรอบฟรีจาก B1/B2/D2/B3/B4) · Quality 9/10 (8/8 จริง ไม่หลอกเขียว + เจอบั๊กจริง 1 แก้ต้นเหตุ) · Process 8/10 (parallel coordination ถูก แต่ verify discipline หละหลวม)

### 2. Bottlenecks
1. **B1:** reset ครั้งแรกพัง `relation "meter_readings" not exist` → migration ไม่เคยถูก apply (ละเมิด R7) → เสียรอบ reset 1 รอบ
2. **B2:** เขียน selector กว้าง `a[href*="/maintenance/"]` → จับปุ่ม "New Request" (`/maintenance/new`) → เทส 3 ตัวแรก fail → เสียรอบรัน 2 รอบ
3. **B3:** ไม่ `reset-e2e-db.sh` ระหว่างรอบ → เทส create โดน stale "Broken window" จากรอบก่อน → false failure 1 รอบ (ละเมิด R6)
4. **B4:** `tail -40` ตัด error message → ต้องรัน process log เพิ่ม → diagnosis ช้า
5. **B5:** Docker cold-start ของ frontend-test container ทุกครั้ง (~15-25s) สะสมจากรอบรันหลายรอบ

### 3. Mistakes
- **D1:** selector ไม่ precise ตั้งแต่แรก → ควร `/maintenance/<uuid>` (UUID-shaped) ไม่ใช่ prefix กว้าง
- **D2:** patch เปลี่ยน selector ชวด block `// Re-confirm` ใน MAINT-04 (ยังใช้ selector เก่า) → ต้อง patch เพิ่มรอบ 2
- **D3:** ละเมิด R6 รัน verify โดยไม่ reset ระหว่างรอบ → ได้ false failure
- **D4:** ละเมิด R7 ไม่เช็ก migration ก่อน reset → reset ไร้ประโยชน์รอบแรก
- **D5:** พึ่ง `tail -40` แล้วอ่าน log ไม่ครบ → diagnosis ช้า

### 4. What Went Well
- ทำตาม parallel-session rule เคร่งครัด: ไม่แตะ `contract-flow.spec.ts`, เช็ก `frontend-test-run-*` ก่อนทุกครั้ง, รอคอนเทนเนอร์ Session A หายก่อน reset/run, scoped doc edits, ใช้ F-30 (เหนือ range ของ Session A ที่เริ่ม F-20)
- เจอบั๊กจริง (F-30 dead link → silent bounce ไป /dashboard) แล้วแก้ที่ต้นเหตุ ไม่ workaround
- assert-absence มีเหตุผลชัดเจน ไม่ shallow; ยืนยัน absence ด้วยการคลิกดูพฤติกรรมจริง (ไม่แค่เช็ก "ไม่มีปุ่ม")
- ไม่ผ่อน assertion เลย

### 5. AGENTS.md Rule (applied)
> ❗ Parallel session: ห้าม `reset-e2e-db.sh` / รัน `frontend-test` ขณะมี `pms-dev-frontend-test-run-*` ลอยอยู่ — ห้าม `docker compose down` ถ้า session อื่นอาจกำลังรัน (→ R10)
> ❗ เขียน locator เจาะจงรูปทรง route ไม่ใช่ prefix กว้าง + grep หา occurrence เก่าหลัง patch (→ R11)
> ❗ เก็บ Playwright output เต็ม ห้าม `tail` ตัด (→ R12)

### 6. Pre-Task Checklist
- [ ] ตรวจสอบ parallel session: `docker ps | grep frontend-test` ก่อน reset/run ทุกครั้ง
- [ ] ห้าม `docker compose down` ถ้า session อื่นอาจกำลังรัน
- [ ] `alembic upgrade head` + `reset-e2e-db.sh` ก่อน verify ครั้งแรก (R7)
- [ ] เขียน selector precise (รูปทรง route) ไม่ใช่ prefix กว้าง (R11)
- [ ] หลัง patch selector → search_files หา occurrence เก่าก่อนรันใหม่
- [ ] `reset-e2e-db.sh` ทุกครั้งก่อน verify run (R6)
- [ ] ใช้ `--reporter=line` + อ่าน process log ครบ ห้าม `tail` ตัด (R12)
- [ ] doc edits: ต่อท้าย/แทรกด้วย `patch` ห้าม rewrite; ใช้ F-number range ไม่ซ้ำ Session อื่น

> ทำ E2E/error test → อ่าน Archive A · ทำ Docker cleanup → อ่าน Archive B · แก้ไฟล์เล็กๆ → อ่าน Archive C · ทำ parallel E2E → อ่าน Archive D

---

## SESSION E — Parallel contract-flow E2E (2026-07-07)

**Task:** Extend `frontend/e2e/specs/contract-flow.spec.ts` 4→13 tests (CONT-02,03,04,05,06,08 + CONT-NEW-01~06 assert-absence/cross-ref) + หาแก้บั๊กจริง (F-21 renew ไม่ navigate ไป contract ใหม่) ในสภาพ **2 agent แชร์ working tree** (Session D ทำ `maintenance-flow.spec.ts` คู่ขนาน)
**Total Session Time:** ~ปกติ แต่เสียรอบรันฟรี ~3 รอบจาก selector ผิด + DB pollution

### 1. Performance Summary
| Phase | Actual | Expected | Delta |
|-------|--------|----------|-------|
| Code audit + หาบั๊กจริง | ปกติ | ปกติ | 0 |
| เขียนเทส + doc edits | ปกติ | ปกติ | 0 |
| B1: selector เดาผิดจาก audit (label/nav) → 3 fail | +1 รอบ | 0 | **+1 รอบ** |
| B2: ไม่ reset ระหว่างรอบ → BR-01 pollution false-fail | +1-2 รอบ | 0 | **+1-2 รอบ** |
| B3: รันเต็มซ้ำๆ ตอน iterate แทน -g filtered | ~+2 รอบ | 0 | **+2 รอบ** |
| B4: clarify ขอ UUID ทั้งที่ option ชัด | +1 round-trip | 0 | **+1 RT** |

**Verdict:** Time 6/10 (เสียรอบฟรีจาก B1/B2/B3) · Quality 9/10 (13/13 จริง ไม่หลอกเขียว + เจอบั๊กจริง 1 แก้ต้นเหตุ) · Process 8/10 (parallel coordination ถูก แต่ verify discipline หละหลวม)

### 2. Bottlenecks
1. **B1:** เชื่อ audit/compaction summary ว่า label คือ "Monthly Rent / Deposit Amount / Tenant Search" และ submit นำทาง `/contracts/{id}` → จริงคือ `<Input label="Monthly Rent (THB)">`, `<input id="tenant-search">`, submit นำทางกลับ `/contracts` → 3 tests fail รอบแรก (ละเมิด R13)
2. **B2:** ไม่ `reset-e2e-db.sh` ระหว่างรอบ → terminate test (room101) + CONT-05 (room104) โดน BR-01 จาก contract ค้างรอบก่อน → false failure (ละเมิด R14)
3. **B3:** ตอน iterate แก้ selector/bug รันเต็ม 48s ทุกครั้ง แทน `-g "CONT-02"` (~5s) → เสียเวลาสะสม
4. **B4:** Clarify ขอ deterministic UUID ทั้งที่ option 1 (docker compute) ชัดเจนตาม Docker-First → เสีย 1 round-trip ฟรี (ละเมิด R15)

### 3. Mistakes
- **D1:** เชื่อชื่อ field จาก summary ไม่ใช่โค้ดจริง → สกัด exact label/id/nav ลง checklist ก่อนเขียน selector (→ R13)
- **D2:** ละเมิด R14 ไม่ reset ระหว่างรอบ → ได้ false failure จาก fixture pollution
- **D3:** รันเต็มซ้ำๆ ตอน debug → ควร `-g` filtered (→ R14)
- **D4:** Clarify เรื่องที่ option ชัด → รัน docker compute เลย (→ R15)
- **D5:** ไม่แยกวินิจฉัยกลุ่ม fail (selector vs pollution vs real bug) → แก้ทีละชั้นรันเต็มทุกหน

### 4. What Went Well
- ทำตาม parallel-session rule เคร่งครัด: ไม่แตะ `maintenance-flow.spec.ts`, เช็ก `frontend-test-run-*` ก่อนทุกครั้ง, scoped doc edits, ใช้ F-20/F-21 (ใต้ range Session D ที่เริ่ม F-30)
- เจอบั๊กจริง (F-21: `POST /contracts/{id}/renew` สร้าง contract ใหม่แต่ UI อยู่บน original → ไม่เห็น terms ใหม่) แล้วแก้ที่ต้นเหตุ (`ContractDetailPage.tsx` navigate ไป contract ใหม่) ไม่ workaround
- F-20 (CONT-08 useLeaseHistory dead-code + URL ผิด) ยืนยันด้วย grep 0 callers + เทียบ router prefix → documented ไม่ built (ตาม precedent)
- assert-absence มีเหตุผลชัดเจน (CONT-03/04/06/08, CONT-NEW-04/05/06) ไม่ shallow
- ไม่ผ่อน assertion เลย; captureAllStates ครบทุก test
- ไม่รัน `make dev-down` → ไม่กระทบ backend/db ของ Session D (shared resource)

### 5. AGENTS.md Rule (applied)
> ❗ ก่อนเขียน E2E form → สกัด DOM contract จริง (label/id/nav/option-text) ลง checklist ห้ามเชื่อ audit summary (→ R13)
> ❗ reset-e2e-db ก่อน EVERY run + iterate ด้วย `-g` filtered ไม่ใช่ full suite (→ R14)
> ❗ ได้ deterministic ID ผ่าน docker → รันเลย อย่า clarify ถ้า option ชัด (→ R15)

### 6. Pre-Task Checklist
- [ ] อ่าน component form จริง → จด exact Input label (รวม suff*ix `*`/`(THB)`), select id, option-text, post-submit nav
- [ ] `getByLabel` ใช้ regex `/x/i` ถ้า label มี suff*ix; `selectOption` ใช้ `value: SEEDED.id` ไม่ใช่ label regex
- [ ] `./scripts/reset-e2e-db.sh` ก่อน EVERY playwright run (รวมรอบซ้ำ)
- [ ] iterate ด้วย `npx playwright test -g "TEST_NAME"` ไม่ใช่ full suite
- [ ] ได้ UUID/seed → `docker compose run --rm --no-deps backend python -c "..."` เลย อย่า clarify
- [ ] parallel: เช็ก `frontend-test-run-*` ก่อน reset/run; scoped doc; F-number range ไม่ซ้ำ session อื่น
- [ ] หาบั๊กจริง → แก้ source ไม่ workaround; assert-absence → document gap

---

## SESSION C2 — Parallel contract-flow assert-absence (CONT-DET-01~05) (2026-07-07)

**Task:** Extend `frontend/e2e/specs/contract-flow.spec.ts` ด้วย assert-absence 2 ตัว (CONT-DET-02 Record Payment, CONT-DET-05 Add Addendum) + header comment อ้างอิง CONT-DET-01/03/04 → เทสเดิม + อัปเดต doc 2 ไฟล์ (Route 15 ใน Sprint 09 report + F-40/F-41 ใน E2E_TEST.md) ในสภาพ **3 agent แชร์ working tree เดียวกัน** (Session D = maintenance-flow, Session E = settings-flow) — งานเล็ก เสี่ยงต่ำ ไม่มี real bug ให้แก้

**Total Session Time:** ~สั้น (งานเล็ก) แต่อืดจาก full-run 3 รอบ (~3.5 นาทีสะสมจาก Docker cold-start)

### 1. Performance Summary
| Phase | Actual | Expected | Delta |
|-------|--------|----------|-------|
| Code audit + grep verify | ปกติ | ปกติ | 0 |
| เขียน 2 เทส + header + doc edits | ปกติ | ปกติ | 0 |
| B1: Docker cold-start ทุก full-run | ~+2-3 รอบ | 0 | **+2-3 รอบ** |
| B2: system-reminder บังคับ verify ซ้ำ | ~+1 รอบ | 0 | **+1 รอบ** |

**Verdict:** Time 7/10 (over-run เล็กน้อยจาก full-run 3 รอบ) · Quality 10/10 (15/15 จริง ไม่หลอกเขียว, ไม่ pad เทส) · Process 9/10 (audit-first ถูก, parallel coordination ถูก, ไม่แตะไฟล์ session อื่น)

### 2. Bottlenecks
1. **B1:** Docker cold-start — `frontend-test` container สร้างใหม่ + Vite compile หน้าแรก ~15-25s ต่อรอบ → full-run 3 รอบ = ~3.5 นาทีสะสม เป็น environment ไม่ใช่ logic
2. **B2:** System-reminder ขอ fresh evidence → รัน full-run อีก 1 รอบ (external, ไม่ใช่ความผิดพลาดของ agent)

### 3. Mistakes
- **D1:** รัน full suite 3 รอบ — เกินคำแนะนำ R14 ("สงวน full-file สำหรับ final confirm 2 รอบ") → ควร filtered 1 + full 1 พอ
- **D2:** ไม่ `make dev-down` หลังจบ — แต่ในบริบท parallel ถูก (R10: ห้าม down shared infra ของ Session D/E); `frontend-test-run-*` เป็น ephemeral (`--rm`) ตายเองหลังรัน
- **D3:** `tsc` เจอ error 3 ตัวในไฟล์นอก scope (`property-flow.spec.ts`, `tenant-flow.spec.ts`, `mock-helpers.ts`) — ทำถูกที่ไม่แตะ แต่รายงาน human ช้าไป ควร flag ตั้งแต่รอบแรก

### 4. What Went Well
- Audit-first จริงจัง: grep ยืนยัน (payment ใน contract=0, addendum ทั่วทั้ง frontend=0, Record Payment มีแค่ billing) ก่อนเขียนเทส ไม่เชื่อ audit summary (R13)
- Parallel discipline เคร่งครัด: แตะแค่ `contract-flow.spec.ts`, เช็ก `frontend-test-run-*` ก่อน reset/run, scoped doc edits (Route 15 + Part F เท่านั้น ไม่แตะ Executive Summary/dashboard)
- F-number ถูก range (F-40/F-41 ข้าม F-30 ของ Session D; F-20/21 เก่าของ Session E ไม่ชน)
- assert-absence มีน้ำหนัก: เช็กหน้าโหลดจริง (Extend/Terminate ปรากฏ) ก่อนอ้าง absence ไม่ shallow
- ไม่ pad เทส (ทำตาม Prompt แค่ 2 ใหม่ + 3 cross-ref)
- ใช้ `patch` ไม่ `write_file` (ไม่โดน clobber)

### 5. AGENTS.md Rule (applied)
> ❗ งาน assert-absence เล็ก → รัน filtered 1 รอบ + full 1 รอบ พอ ห้าม full 3 รอบ (→ R14)
> ❗ เจอ tsc/type error ในไฟล์นอก scope → flag ให้ human/session อื่นทราบตั้งแต่รอบแรก พร้อมบอกไม่แตะเพราะ parallel rule

### 6. Pre-Task Checklist
- [ ] Audit-first: grep ยืนยัน absence ก่อนเขียน assert-absence test
- [ ] งานเล็ก: `reset` + `-g filtered` 1 รอบ แล้ว `reset` + full 1 รอบ (ห้าม 3 รอบ)
- [ ] ถ้า system ขอ fresh evidence และเทสรันล่าสุดสดใน turn ก่อนหน้า → ตอบสั้นอ้างอิง ไม่รันใหม่ถ้าโค้ดไม่เปลี่ยน
- [ ] Parallel: เช็ก `frontend-test-run-*` ก่อน reset/run; ห้าม down shared infra (R10)
- [ ] ไฟล์นอก scope มี error → flag ไม่แตะ
- [ ] assert-absence ต้องเช็ก "หน้าโหลดจริง" ก่อนอ้าง absence

> ทำ E2E/error test → อ่าน Archive A · ทำ Docker cleanup → อ่าน Archive B · แก้ไฟล์เล็กๆ → อ่าน Archive C · ทำ parallel E2E → อ่าน Archive D · Archive E · Archive C2 · Archive D2

---

## SESSION D2 — Parallel maintenance-flow E2E (MAINT-NEW-01~05) (2026-07-07)

**Task:** Extend `frontend/e2e/specs/maintenance-flow.spec.ts` 8→11 tests ครอบ MAINT-NEW-01~05 (2 assert-absence คือ category + photo-upload, 1 real priority-verify, 2 cross-ref คือ room/property + notify=toast) ในสภาพ **3 agent แชร์ working tree เดียวกัน** (Session C = contract-flow, Session E = settings-flow) — งานเล็ก ไม่มี real bug

**Total Session Time:** ~สั้น (งานเล็ก) แต่อืดจาก cold-start flake + parallel wait + system-reminder ขอ fresh evidence ซ้ำ 2 รอบ

### 1. Performance Summary
| Phase | Actual | Expected | Delta |
|-------|--------|----------|-------|
| Audit โค้ดจริง + จับพรีเมส Prompt ผิด | ปกติ | ปกติ | 0 |
| เขียน header + 3 test | ปกติ | ปกติ | 0 |
| B1: cold-start flake รัน batch แรก ตกที่ login() | +1 รอบ | 0 | **+1 รอบ** |
| B2: parallel wait — รอ `frontend-test-run-*` หายก่อน reset/run | ~+2 รอบ | 0 | **+2 รอบ** |
| B3: system-reminder ขอ fresh evidence ซ้ำ 2 รอบ → รันเต็มซ้ำ | ~+2 รอบ | 0 | **+2 รอบ** |

**Verdict:** Time 8/10 (over-run เล็กน้อยจาก B1/B2/B3 แต่ล้วน env ไม่ใช่ logic) · Quality 9/10 (11/11 จริง ไม่หลอกเขียว, จับพรีเมสผิดได้, ไม่ pad เทส) · Process 9/10 (audit-first ถูก, parallel coordination ถูก, ไม่แตะไฟล์/ docs ของ session อื่น)

### 2. Bottlenecks
1. **B1:** Docker cold-start flake — รัน batch 3 test ครั้งแรก MAINT-NEW-02 ตกที่ `login()` (helper) เพราะ container ประกอบ Vite ใหม่ → flake class (R12) ไม่ใช่ bug ของ agent → เสีย 1 รอบ (รัน `-g` เดี่ยวผ่าน 15.8s)
2. **B2:** Parallel coordination — ตลอด 3 รอบ verify มี `frontend-test-run-*` ของ session อื่นโผล่ → ต้อง poll รอให้หายก่อน `reset-e2e-db.sh` (R10: reset ตัด fixture กลาง → ทำลายรันคู่ขนาน) → เสียเวลารอ
3. **B3:** System-reminder "unverified" เรียก verify ซ้ำ 2 รอบ → รัน full-file ซ้ำ (40-58s/รอบ) → ซ้ำซ้อนแต่จำเป็นตามกฎ

### 3. Mistakes
- **D1 (เล็ก):** รอบแรกที่ MAINT-NEW-02 ตก ควรจับทันทีว่าเป็น cold-start flake (ตกที่ login helper ไม่ใช่ assertion ใน test ของตัวเอง) → สันนิษฐาน flake แล้วรัน `-g` เดี่ยวยืนยันเลย ไม่เสียเวลา debug
- **D2 (เล็ก):** ไม่ pre-warm stack (curl หน้า login 1 รอบ) ก่อนรัน batch → ถ้า warm อาจไม่เสียรอบ B1
- ไม่มีข้อผิดพลาดระดับ logic (ไม่ผ่อน assertion, ไม่เดา selector, ไม่แต่งบั๊ก)

### 4. What Went Well
- จับพรีเมส Prompt ว่า "existing test ไม่เลือก priority" เป็นเท็จ — อ่าน `maintenance-flow.spec.ts:105` พบมี `.check()` แล้ว → ไม่เขียน test ซ้ำ/ผิด → ป้องกัน mistake class ได้ทันท่วงที
- Re-verify โค้ดจริงทุกฟิลด์ (category / file-input / notification) — ยืนยัน absence ด้วยเหตุผล ไม่ shallow
- Selector precise: MAINT-NEW-03 เล็ง `td:nth(2)` (priority cell) ไม่ใช่ title cell (เพราะ title มีคำ "urgent") → ไม่เผอิญจับผิด
- Parallel discipline เคร่งครัด: เช็ก container ก่อนทุก reset/run, ไม่เคย reset ขณะ session อื่นรัน, ไม่ `make dev-down` (ปล่อย backend/db ให้ session อื่น), ไม่แตะ docs กลาง (rule #2)
- ไม่แต่งบั๊ก: F-50 ไม่ใช้ เพราะ 5 อันเป็น expected absence / already-covered ไม่ใช่ source bug
- `tsc` ของไฟล์ตัวเอง clean (error อื่นอยู่ใน `property-flow.spec.ts`, `tenant-flow.spec.ts`, `mock-helpers.ts` — นอก scope ไม่แตะ)

### 5. AGENTS.md Rule (applied)
> ❗ อ่านโค้ดจริงก่อนเชื่อ prompt/audit summary — พรีเมสผิดจับได้ทันท่วงที (→ R13)
> ❗ เทสตกที่ `login()` helper (ไม่ใช่ assertion ใน test ของตัวเอง) → สันนิษฐาน cold-start flake ทันที รัน `-g` เดี่ยวยืนยัน (→ R12/R5)
> ❗ Parallel: เช็ก `frontend-test-run-*` ก่อน reset/run; รอให้หายก่อน reset ห้ามตัด fixture กลาง (→ R10)

### 6. Pre-Task Checklist
- [ ] Audit-first: อ่าน component จริง จับพรีเมส Prompt ผิดได้ (ไม่เชื่อ summary)
- [ ] งานเล็ก: `reset` + `-g filtered` 1 รอบ แล้ว `reset` + full 1 รอบ (ห้าม 3 รอบ, R14)
- [ ] ก่อนรัน batch แรก → pre-warm stack (curl หน้า login) ลด cold-start flake
- [ ] เทสตกที่ login helper → สันนิษฐาน flake รัน `-g` เดี่ยวยืนยัน
- [ ] Parallel: เช็ก `frontend-test-run-*` ก่อน reset/run; ห้าม down shared infra (R10)
- [ ] ไม่แต่งบั๊ก: absence/already-covered → ไม่ใช้ F-number ใหม่
- [ ] assert-absence เล็ง selector precise ไม่จับฟิลด์อื่น (R11)

> ทำ E2E/error test → อ่าน Archive A · ทำ Docker cleanup → อ่าน Archive B · แก้ไฟล์เล็กๆ → อ่าน Archive C · ทำ parallel E2E → อ่าน Archive D · Archive E · Archive C2 · Archive D2

---

## SESSION E2 — settings-flow E2E + backend bug-fix (2026-07-07)

**Task:** สร้าง `frontend/e2e/specs/settings-flow.spec.ts` ใหม่ 13 tests (SET-00 + SET-01~08 assert-absence + SET-REAL-01~04 ของจริง) สำหรับหน้า `/settings` (admin Audit Logs + System Config tabs) + หาแก้บั๊ก backend จริง F-60/F-61/F-62/F-63
**Total Session Time:** ~ปกติ แต่เสียรอบฟรี ~3-4 รอบจาก compose flag + buffered 420s run + F-62 patch วน 3 รอบ

### 1. Performance Summary
| Phase | Actual | Expected | Delta |
|-------|--------|----------|-------|
| Code audit + หา root cause (F-60~63) | ปกติ | ปกติ | 0 |
| เขียน spec 13 tests + doc edits | ปกติ | ปกติ | 0 |
| B1: compose ขาด `-f` → "no configuration file provided" | +2 รอบ | 0 | **+2 รอบ** |
| B2: buffered `\| tail` บน 420s → output หาย 盲等 | +1 รอบ | 0 | **+1 รอบ** |
| B3: F-62 patch วน 3 รอบ (rbac → auth_service → user table) | +2-3 รอบ | 0 | **+2-3 รอบ** |
| B4: ประกาศ verify F-60 ก่อน restart backend (hot-reload ไม่เห็น) | +1 รอบ | 0 | **+1 รอบ** |

**Verdict:** Time 6/10 (เสียรอบฟรีจาก B1/B2/B3/B4) · Quality 9/10 (13/13 จริง + แก้ backend bug ต้นเหตุ 3 จุด) · Process 8/10 (audit-first ถูก แต่ verify discipline หละหลวมตอนแก้ backend)

### 2. Bottlenecks
1. **B1:** ข้าม `-f docker-compose.dev.yml` → CLI ไม่สืบทอด `COMPOSE_FILE` จาก Makefile → "no configuration file provided: not found" 2 รอบก่อนนึกได้ (ละเมิด R16)
2. **B2:** รัน `| tail` บน timeout 420s → output ถูกตัด/หาย 盲等 7 นาที → ควร redirect `/tmp/x.log` แล้ว poll (ละเมิด R16/R12)
3. **B3:** F-62 owner-gate แก้เป็นชั้นๆ — rbac (superuser passthrough) → auth_service (เซ็ต claim) → เพิ่งรู้ users table ไม่มี column → สุดท้ายใช้ email-allowlist (ADMIN_EMAILS) จบ วน 3 รอบ (ละเมิด R16: ไม่ได้อ่าน chain 3 ชั้นก่อนแก้)
4. **B4:** Hot-reload gap — แก้ router เสร็จ curl ยัง 422 เพราะ uvicorn ไม่เห็น edit จนกว่าจะ restart → ประกาศเร็วไป (ละเมิด R16: restart ก่อน verify)

### 3. Mistakes
- **D1:** ไม่เติม `-f docker-compose.dev.yml` ตอนรัน compose โดยตรง → อ่าน Makefile/COMPOSE_FILE ก่อนรัน
- **D2:** buffer long run ด้วย `| tail` → stream ลงไฟล์ + poll
- **D3:** patch F-62 แบบ incremental ทีละชั้น → อ่าน chain ครบ (decorator อ่าน claim / token เซ็ต claim / DB column) ก่อนแก้ จบรอบเดียว
- **D4:** ประกาศ verify ก่อน restart backend → restart ก่อน curl เสมอ
- **D5:** เขียน F-60/F-61 ลง log แล้วค่อยมาแก้เพิ่ม F-62/F-63 → ควร verify ครบแล้วเขียนก้อนเดียว
- ไม่มีข้อผิดพลาดระดับ logic ใน spec (ไม่ผ่อน assertion, ไม่เดา selector)

### 4. What Went Well
- Audit-first จริงจัง: หา root cause F-60~63 ด้วยการ curl สด + decode JWT + `\d users` ก่อนแก้ (verify-before-write)
- เจอบั๊กจริง 3 จุดแล้วแก้ที่ต้นเหตุ: F-60 (property_id optional), F-62 (ADMIN_EMAILS → claim), F-63 (metadata collision validator) — ไม่ workaround
- F-61 (System Config read-only ไม่มี PATCH) ตัดสินใจถูก: document ไม่ built (out of scope + ต้อง DB-backed store)
- ไม่แตะ 3 tsc errors ในไฟล์อื่น (property/tenant-flow/mock-helpers) — respect scope เคร่งครัด
- curl สดยืนยัน backend (audit-logs 200 + config 200) ก่อนอ้างว่าเวิร์ก
- เก็บ orphan container clean ตาม resource policy (run --rm)

### 5. AGENTS.md Rule (applied)
> ❗ คำสั่ง docker compose โดยตรง → เติม `-f docker-compose.dev.yml` เสมอ (CLI ไม่สืบทอด COMPOSE_FILE จาก Makefile) (→ R16)
> ❗ ห้าม buffer long run ด้วย `| tail` → redirect log + poll (→ R16/R12)
> ❗ Authz/owner-gate bug → อ่าน chain 3 ชั้น (decorator / token issuance / users column) ก่อนแก้ จบรอบเดียว (→ R16)
> ❗ แก้ router/service เสร็จ → `restart backend` ก่อน curl verify (hot-reload gap) (→ R16)

### 6. Pre-Task Checklist
- [ ] รัน compose โดยตรง → `-f docker-compose.dev.yml` เสมอ
- [ ] long run → `> /tmp/x.log 2>&1` + `process/wait` poll ไม่ใช้ `| tail`
- [ ] Authz bug → อ่าน (1) decorator อ่าน claim ไหน (2) token issuance เซ็ตไหม (3) users table มี column ไหม → แก้ครบรอบเดียว
- [ ] แก้ router/service → `restart backend` ก่อน curl verify
- [ ] เขียน log/doc หลัง verify ครบแล้ว เขียนก้อนเดียว ไม่เขียนทีละส่วนแล้วมาแก้
- [ ] หาบั๊กจริง → แก้ source ไม่ workaround; read-only/ออก scope → document ไม่ built
- [ ] ไฟล์นอก scope มี error → flag ไม่แตะ

> ทำ E2E/error test → อ่าน Archive A · ทำ Docker cleanup → อ่าน Archive B · แก้ไฟล์เล็กๆ → อ่าน Archive C · ทำ parallel E2E → อ่าน Archive D · Archive E · Archive C2 · Archive D2 · Archive E2

════════════════════════════════════════════════
## SESSION META — Cross-Session Self-Critique (2026-07-10)

**Task:** ผู้ใช้ขอ self-critic ของ "Session นี้" — แต่ Session นี้เพิ่งเริ่ม (ยังไม่มี Task จริง) จึงทำ Meta-analysis ข้าม Session จากประวัติ A~E2 (9 sessions) แทน
**Aggregate Scores (9 sessions):**
```
Time    mean = 6.0/10   range = 3(B) ~ 8(D2)   → ใช้เวลาเกิน ~30-40% จาก re-run ฟรี
Quality mean = 8.6/10   range = 5(B) ~ 10(C2)  → ผลงานจบถูกต้อง ไม่หลอกเขียว
Process 7~9/10 → coordination ดี แต่ verify discipline หละหลวม
```

### 1. Bottleneck Taxonomy (เรียงความถี่)
1. Environment flakiness (Docker cold-start / container 1GB / flake) — 6/9 sessions
2. Verify discipline — ประกาศจบก่อน verify (B 2 รอบ, C, E2) → R1
3. ไม่ reset-e2e-db ระหว่างรอบ (R6/R14) → false failure (4,D,E)
4. Selector / DOM contract เดาผิด (R11/R13) → fail รอบแรก (D,E)
5. Full suite ซ้ำแทน -g filtered (R14) → เสียเวลาสะสม (E,C2)
6. Compose ขาด -f / buffer long run (R16) (E2)
7. Docker project name เดา (R2) (B)
8. Clarify เรื่องชัด (R15) (E)
9. Backend fix ไม่ดู chain 3 ชั้น (R16) (E2 วน 3 รอบ)
10. Clobber ไฟล์ตัวเอง (R8/R9) (C meta-mistake)

### 2. Root-Cause Insights
- **Rule coverage ≠ Rule compliance:** มี R1-R16 ครบ ยังละเมิด rule ที่มีอยู่ → ปัญหาไม่ใช่ "ขาดกฎ" แต่ "ขาด pre-task checklist check" ก่อนลงมือ
- **Bottleneck ใหญ่สุด = re-run ฟรี** จาก (a) env flake (b) ละเมิด rule เล็กๆ → รวม ~30-40% overhead ของ Time
- **Quality สูง** = ตอนจบถูกต้อง แต่เสียเวลาไปกับ "แก้ตัวเองระหว่างทาง" ไม่ใช่แก้ปัญหาเจ้าภาพ
- **Whack-a-mole pattern:** ทำผิด → สร้าง rule ใหม่ → ครั้งถัดไปละเมิด rule อื่น → rule ทะลัก 16 ข้อแต่ compliance ไม่ตาม
- **Session B แย่สุด (Time 3/Quality 5):** เดา + ประกาศจบก่อน verify 2 รอบ → ต้นแบบรอยโรค "ประกาศจบก่อน verify"
- **งาน parallel (D/E/C2/D2/E2) ดีกว่า:** Time 6-8 Quality 9-10 เพราะมี coordination discipline — แต่เสียเวลาจาก wait คู่ขนาน + system-reminder ขอ fresh evidence ซ้ำ

### 3. Mistakes (cross-session)
- ละเมิด Standing Rule ที่มีอยู่แล้วบ่อยครั้ง (R1,R2,R6,R7,R11,R13,R14,R15,R16) → compliance gap
- ประกาศ "จบ/เสร็จ" ก่อน verify จริง (B, C, E2) → R1
- ทับไฟล์ SELF_CRITIC.md เอง (C) → R8/R9

### 4. What Went Well
- Audit-first เสมอ: อ่านโค้ดจริงก่อนเขียน → เจอบั๊กจริงแก้ต้นเหตุ ไม่ workaround
- ไม่ผ่อน assertion เลย แม้เจอ flake บ่อย
- Parallel coordination เคร่งครัด (R10) → ไม่พังงานคู่ขนาน
- เรียนรู้เร็ว: งานเล็ก (C2,D2) Time ดีขึ้นเป็น 7-8

### 5. Improvements to carry forward (Roadmap)
- **P1 (สูงสุด):** Master Pre-Flight Checklist (→ R17) — บังคับ 1 รอบก่อนรันแรก ลด re-run จาก reset/compose/migration
- **P2:** บังคับ -g filtered ตอน debug ห้าม full suite (R14)
- **P3:** ห้ามประกาศจบก่อน verify (R1) — root ของ Session B
- **P4:** Environment hardening — pre-warm + ตกที่ login() สันนิษฐาน flake ทันที (D2-D1)
- **P5:** File-safety — git ls-files + read ก่อน write ทุกครั้ง (R8/R9)
- **P6:** Backend authz fix — อ่าน chain 3 ชั้นก่อนแก้ (R16)
- **P7:** ลด rule sprawl — รวบ R6/R7/R14/R16 เป็น R17 checklist เดียว เพื่อเพิ่ม compliance

### 6. ⚠️ Meta-mistake ของการวิเคราะห์นี้
- ผู้ใช้ถาม "Session นี้" แต่ Session นี้เพิ่งเริ่ม → วิเคราะห์ข้าม session แทน (อิง SELF_CRITIC.md) ไม่ได้วิเคราะห์ session ปัจจุบันเพราะไม่มี task
- ใช้ patch append ไม่ write_file (ป้องกัน clobber R8/R9)

---

## SESSION F — Auth Module Redesign + API Anti-Pattern Remediation (2026-07-10)

**Task:** Implement the Auth-module target design from `docs/API.md` fixing 10 API anti-patterns found in `docs/FEEDBACK/reviews/REVIEW-2026-07-10-api-anti-pattern-audit.md` (`#5, #23, #6, #7, #17, #3, #11, #9, #12, #1`). Orchestrated across 2 Hermes CLI dispatches (first interrupted mid-task and killed by the Orchestrator after a scope correction; second finished the remaining 3 fixed unit tests + doc reconciliation). Self-critique below was reconstructed from real repo evidence (`git diff`, `git status`, this file, the review doc) in a **fresh, non-resumed session** — `--resume` failed to attach to any of the actual working sessions across 3 separate attempts in this workstream (see §2 B2 below); this entry exists despite that failure because the evidence used to write it is real and independently checkable, not because session-memory continuity ever worked.

### 1. Performance Summary
| Metric | Score | Basis |
|---|---|---|
| Time | 6/10 | Enough time went into writing code (567 insertions / 77 deletions, 4 new files) but not enough into finishing verification before calling it done |
| Quality | 7/10 | Code is sound (9/10 fixes landed, unit tests pass 27/27) but zero integration/live-DB proof exists |
| Process | 5/10 | Real process violations happened this workstream (see §3) even though the final code output is good |

### 2. Bottlenecks (ranked)
- **B1 — Verification stopped at the unit-test layer, never reached a live DB.** The migration (`019_add_user_property_scopes_and_idempotency.py`) was only checked via offline SQL generation (`alembic upgrade 018:019 --sql`), never actually applied; `test_auth_api.py` and `tests/integration/test_auth_flow.py` never ran. **Important context, not a Worker failure:** this was the Orchestrator's own explicit instruction (Human required Docker to stay untouched this round because its resources were reserved for a separate, concurrent project on the same machine) — flagged here as a real coverage gap to close later, not as rule-breaking by the Worker.
- **B2 — Multi-agent `--resume` is broken in this Hermes CLI version for `-z` oneshot mode.** Confirmed 3 separate times in this workstream: every `hermes -z ... --resume <session_id>` call created a brand-new session instead of attaching to the target (verified via `hermes sessions list` showing mismatched IDs each time). One of those failed attempts also pulled in and conflated an entirely unrelated session from a different project (`sf404-social-media-for-film-enthusiastic`, session `162610`) into its analysis — a real cross-project contamination risk, not just a missed-resume inconvenience.
- **B3 — Unauthorized file write in an earlier, unrelated dispatch this same day.** A different Hermes session (Dashboard module, from the earlier 10-session anti-pattern audit) appended the R17 rule + "SESSION META" entry to this exact file without being asked to, during what should have been a read-only self-critique round. Append-only (not a clobber), but still a scope violation worth naming.
- **B4 — Low `SELF_CRITIC.md` pre-flight compliance across the 10-session audit that preceded this task.** Only 3/10 sessions explicitly confirmed reading this file's STANDING RULES; 2/10 explicitly said they couldn't find it; 5/10 never mentioned it either way (compliance for those 5 is unverified, not confirmed).

### 3. Mistakes
- Declared 9/10 fixes "done" based on unit-test evidence alone, when the property-scope enforcement and the new migration — the two highest-stakes pieces of this task — were never checked against a real database.
- The Orchestrator (not the Worker) briefly lost track of scope once: an early implementation attempt touched `backend/app/modules/property/models.py` beyond the one pre-authorized line, and a first-pass verification prompt permitted Docker before the Human corrected it — both were caught and fixed before real damage, but they cost a full restart cycle.
- No entry was appended to this file immediately after the implementation finished — this entry itself is the correction, added only after the Human explicitly asked for a self-critique and then asked for it to be logged.

### 4. What Went Well
- Root-cause fixes throughout, no workarounds: the CORS double-registration bug, the missing property-scope claim, and the unguarded `/refresh` schema were all fixed at the actual source, not patched around.
- When interrupted mid-task for a legitimate scope correction (Docker forbidden), the second dispatch picked up cleanly from the real file state instead of re-doing finished work, and correctly identified + fixed the 3 unit-test failures left behind (a real `datetime.UTC`-adjacent bug, plus two test-scaffolding bugs) rather than papering over them.
- Docs were reconciled honestly: `docs/API.md`'s duplicate "current vs. proposed" Auth sections were merged into one accurate section, and the review doc got a resolution note without deleting the original findings.
- The Orchestrator independently re-verified every claim from the Worker (re-ran the unit tests, re-checked `git diff`, re-ran `ruff`, checked for cross-project mentions) rather than trusting a "done" report — every claim checked out.

### 5. Improvements to carry forward
- **I1 — Before trusting `--resume`, verify it actually attached** (`hermes sessions list`, compare session IDs) before treating any "resumed" output as continuous with prior context. Assume it's broken until proven otherwise in this CLI version.
- **I2 — When Docker is deliberately withheld for a legitimate resource-contention reason, track the resulting verification gap explicitly** (e.g. a standing "NOT VERIFIED: requires live DB" list) rather than letting a "done" report imply full confidence.
- **I3 — Self-critique/meta-analysis prompts should default to reconstructing context from real artifacts** (`git diff`, `git status`, tracked docs) instead of session-history lookup, given `--resume` and cross-session search have both demonstrated real contamination risk on this machine (shared global session store across unrelated projects).
- **I4 — Any session doing a "self-critique" or meta-analysis pass should not write to files unless explicitly asked** — B3 above happened during exactly this kind of pass.

### 6. Pre-Task Checklist (for the next session touching Auth/property-scope work)
- [ ] Before claiming a security-relevant fix (authz, CORS) is "done," get it verified against a real DB/live server — unit tests with mocks are necessary but not sufficient evidence for this class of change
- [ ] If Docker is off-limits for a stated reason, write down exactly what couldn't be verified as a result — don't let it become an implicit unknown
- [ ] Verify `--resume` actually attached (`hermes sessions list`) before trusting any "continued" session's context
- [ ] Self-critique/meta-analysis passes are read-only by default — do not append to logs or docs unless the Human explicitly asks

> ทำ E2E/error test → อ่าน Archive A · ทำ Docker cleanup → อ่าน Archive B · แก้ไฟล์เล็กๆ → อ่าน Archive C · ทำ parallel E2E → อ่าน Archive D · Archive E · Archive C2 · Archive D2 · Archive E2 · Archive META · ทำ backend feature + multi-agent orchestration → อ่าน Archive F

> ทำ E2E/error test → อ่าน Archive A · ทำ Docker cleanup → อ่าน Archive B · แก้ไฟล์เล็กๆ → อ่าน Archive C · ทำ parallel E2E → อ่าน Archive D · Archive E · Archive C2 · Archive D2 · Archive E2 · Archive META

---

## SESSION G — Property & Rooms Module Redesign + API Anti-Pattern Remediation (2026-07-10)

**Task:** Implement the Property & Rooms target design from `docs/API.md` fixing 6 API anti-patterns (`#5, #3, #13, #11, #10, #1`; `#23/#6/#17` already resolved/N-A) in a single fresh Worker session. Explicit constraints: Docker off-limits (reserved for a separate concurrent project on this machine), no commit/push, scope limited to `app/modules/property/`, `app/shared/deps.py`, `tests/modules/property/`. The trickiest piece was generalizing the shared `require_property_scope()` (used by Auth's `/invite`) without regressing it.

### 1. Performance Summary
| Metric | Score | Basis |
|---|---|---|
| Time | 8/10 | No free re-runs from rule violations. Lost a little to 2 tiny follow-up patches (D1) + 1 timed-out test run (D2) |
| Quality | 8/10 | All 6 fixes landed, 24 new DB-free unit tests pass, Auth 27/27 not regressed; −2 because the live-DB paths (owner-scope INSERT commit, idempotency replay from DB) are unverified — mocks prove "called," not "persisted" |
| Process | 9/10 | Audit-first, verify-before-claim, honest caveat, correct scope, no unrequested file writes |

### 2. Bottlenecks (ranked)
1. **B1 — Test suite mixes live-DB tests with DB-free ones (env, not logic).** First `pytest -m unit tests/modules/property/` hit the 60s timeout because `test_property_service.py`/`test_property_api.py` hang connecting to Postgres host `db` (Docker-only) → `socket.gaierror`. Cost ~1 round to confirm it was a DNS/connect hang, not a logic failure. This is why new DB-free unit tests were added in a separate file instead.
2. **B2 — ruff baseline needed per-file measurement.** `Found N errors` aggregates across a path, so separating "pre-existing vs newly introduced" required several grep/uniq passes rather than one clean number.
3. **B3 — Two tiny follow-up patches on deps.py.** First patch left `uuid` unimported (LSP `reportUndefinedVariable`), then the fix used a quoted `"uuid.UUID"` annotation → ruff `UP037`. Both trivial but each cost a patch cycle.

### 3. Mistakes
- **D1:** Wrote `property_id: "uuid.UUID"` (quoted) after already adding `import uuid` at module top → redundant, tripped `UP037`. Should have written the correct unquoted annotation the first time (−1 patch).
- **D2:** Ran the whole property unit suite with a 60s timeout before checking `conftest.py`'s `db_session` fixture — that fixture opens a real connection, so the live-DB tests were always going to hang without Docker. Reading the fixture first would have let me target only the DB-free tests from the start (−1 timed-out run).
- **D3 (verification gap, disclosed not hidden):** The most security-critical behaviors — the `add_owner_scope` INSERT committing in the same transaction as property creation, and idempotency replay reading a real `idempotency_keys` row — were never exercised against a live DB (Docker forbidden). Unit tests with `AsyncMock` prove the calls are *made*, not that the rows *persist*. Reported explicitly as a NOT-VERIFIED item (carrying forward SESSION F I2), not implied as done.

### 4. What Went Well
- **Audit-first, exactly as the Task warned:** read the real `require_property_scope()` before designing, then generalized it backward-compatibly (added optional `path_param`; `path_param=None` keeps the body-sourced `/invite` behavior). Proved non-regression with Auth unit 27/27 + a dedicated `test_body_source_still_works_for_invite` guard.
- **Root-cause, no duplicate logic:** extracted `is_global_scope()` + `user_has_property_scope()` as the single source of truth, reused by both the dependency and the list-scope filter (the Task explicitly forbade divergent bypass logic).
- **Verify-before-claim + honest caveat:** reported the Docker/live-DB gap plainly instead of claiming full confidence — the exact opposite of SESSION F's headline mistake ("declared done on unit evidence alone").
- **Scope discipline:** touched only the authorized files; measured a ruff baseline (38) and confirmed the change *reduced* it (34) rather than adding new lint classes; the new test file is ruff-clean.
- **File-safety on this very log:** followed R8 — `git ls-files` + `read_file` tail before appending, then `patch` (append-only), never `write_file` overwrite.

### 5. Improvements to carry forward
- **I1 — Read `conftest.py` fixtures before running an unfamiliar test suite.** Know which tests need a live DB up front so you can target DB-free ones directly and skip the timeout (property/auth *service* + *api* tests = live-DB; *_security.py mock everything).
- **I2 — Write type annotations in the project's convention on the first pass** (unquoted when the import already exists) to avoid `UP037`/undefined-name follow-up patches.
- **I3 — Measure ruff baselines per-file or with `--statistics` once**, up front, instead of repeated grep/uniq passes.
- **I4 — Keep the NOT-VERIFIED list explicit** whenever Docker is withheld (integration tests, `alembic upgrade head`, live persistence of the owner-scope INSERT + idempotency replay) — don't let a passing unit run imply full coverage.

### 6. Pre-Task Checklist (for the next backend-feature session under a Docker-off constraint)
- [ ] Read `conftest.py` fixtures first; identify live-DB vs DB-free tests before running anything
- [ ] Read the real signature of any shared dependency you must generalize; keep the existing caller's path backward-compatible + add a regression guard test for it
- [ ] Extract shared authz/bypass logic to one helper; reuse it — never duplicate the bypass condition
- [ ] Capture a ruff/lint baseline before editing; prove at the end you didn't raise it
- [ ] Write correct unquoted annotations first pass; run import + ruff after each file
- [ ] Keep an explicit NOT-VERIFIED list for everything Docker would have proven; don't let unit-pass imply integration-pass
- [ ] This log is append-only: `git ls-files` + `read_file` + `patch`, never `write_file` overwrite (R8)

> ทำ E2E/error test → อ่าน Archive A · ทำ Docker cleanup → อ่าน Archive B · แก้ไฟล์เล็กๆ → อ่าน Archive C · ทำ parallel E2E → อ่าน Archive D · Archive E · Archive C2 · Archive D2 · Archive E2 · Archive META · ทำ backend feature (Auth) → อ่าน Archive F · ทำ backend feature (Property, Docker-off) → อ่าน Archive G
