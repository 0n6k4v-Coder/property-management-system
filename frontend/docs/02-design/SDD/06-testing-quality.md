# File: frontend/docs/02-design/SDD/06-testing-quality.md
# Testing & Quality Strategy
## Property Management System (Client-Side)

---

## 8. Testing & Quality Strategy

### 8.1 Automated Quality Gates (ESLint + React Doctor + Auto-Fix Loop)
เพื่อลด Technical Debt ตั้งแต่บรรทัดแรก โค้ดทุกบรรทัดต้องผ่านกฎนี้ก่อน Commit:

| ขั้นตอน | เครื่องมือ | การทำงาน | ผลลัพธ์ที่ต้องการ |
|--------|-----------|--------|------------------|
| **1. IDE Auto-Fix** | VS Code ESLint + `eslint-plugin-react-doctor` | บันทึกไฟล์ → รัน ESLint + React Doctor rules → แก้ไข Warning/Error อัตโนมัติ | ไม่มี Red Squiggly, Code ตรงตาม React Best Practices |
| **2. Pre-Commit Check** | `lint-staged` + `husky` | `git commit` → รันเฉพาะไฟล์ที่เปลี่ยน → `--fix` → หากยัง Error → ปฏิเสธ Commit | Commit ได้เฉพาะเมื่อผ่าน 100% |
| **3. CI Gate** | GitHub Actions + `react-doctor` CLI | PR เปิด → รัน full scan → แสดง health score + inline annotations → หาก < 90 → Block Merge | Main branch มี health score ≥ 90 เสมอ |

> ℹ️ **React Doctor คืออะไร?**  
> เป็น CLI static analysis tool จากทีม Million.js ที่ใช้ Oxlint (Rust) สแกนโค้ดแบบเร็วมาก (หลักวินาที) ตรวจหา anti-patterns, performance issues, accessibility gaps, security risks ในโค้ด React [[1]][[2]]  
> ให้ผลลัพธ์เป็น **Health Score 0-100** พร้อมคำแนะนำแก้ไขที่ชัดเจน และรองรับการติดตั้งเป็น "skill" ให้ AI coding agents เรียนรู้จากปัญหาที่พบ [[9]]

#### 🔧 ESLint + React Doctor Flat Config (`eslint.config.js`)
```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactDoctor from 'eslint-plugin-react-doctor';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  reactDoctor.configs.recommended,      // Framework-agnostic React rules
  reactDoctor.configs.next,             // Next.js App Router rules (ถ้าใช้)
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { project: './tsconfig.json' },
    },
    rules: {
      // Override rules if needed
      'react-doctor/no-fetch-in-effect': 'error',
      'react-doctor/no-array-index-key': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  { ignores: ['dist/', 'node_modules/', 'coverage/', 'src/types/api.d.ts'] }
);
```

#### 🔧 VS Code Settings for Auto-Fix (`.vscode/settings.json`)
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "eslint.validate": ["typescript", "typescriptreact"],
  "eslint.run": "onSave"
}
```

#### 🔧 Pre-Commit Hook (`lint-staged.config.js`)
```js
export default {
  'src/**/*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write',
    'tsc --noEmit --pretty'
  ]
};
```

#### 🔧 React Doctor CLI in CI (`.github/workflows/frontend-quality.yml`)
```yaml
jobs:
  react-doctor-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - name: Install deps
        run: npm ci
      - name: Run React Doctor scan
        run: npx react-doctor@latest --threshold 90 --format github
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Fail if score < 90
        run: |
          SCORE=$(npx react-doctor@latest --json | jq -r '.score')
          if [ "$SCORE" -lt 90 ]; then
            echo "❌ Health score $SCORE < 90 threshold"
            exit 1
          fi
```

> ✅ **Workflow ที่เกิดขึ้นจริง:** 
> 1. Dev/AI สร้าง/แก้ไฟล์ → กด `Save` → VS Code รัน ESLint + React Doctor rules → แก้ Warning อัตโนมัติ
> 2. หากยังเหลือ Error ที่แก้ไม่ได้ → VS Code แสดงใน Problems Panel → แก้ไขมือ → `Save` → ตรวจสอบซ้ำทันที
> 3. `git commit` → `lint-staged` รันรอบที่ 2 บนไฟล์ที่เปลี่ยน → หากยัง Fail → ปฏิเสธ Commit
> 4. PR เปิด → GitHub Actions รัน `react-doctor` CLI → แสดง health score + inline annotations → หาก < 90 → Block Merge
> 5. **ผลลัพธ์:** Technical Debt ไม่สะสม เพราะทุกการเปลี่ยนแปลงต้องผ่าน Quality Gate ก่อนเข้า repo

---

### 8.2 Recommended Additional Checks (ป้องกัน Tech Debt ซ่อนเร้น)
นอกจาก ESLint + React Doctor ควรเพิ่มสิ่งนี้เพื่อครอบคลุมคุณภาพจริง:

| มิติ | เครื่องมือ | ทำไมต้องเพิ่ม | วิธีรัน |
|------|-----------|--------------|--------|
| **Type Safety** | `tsc --noEmit` | ESLint/React Doctor จับ Type Error ไม่ครบ 100% | `pre-commit` + CI |
| **Code Formatting** | `Prettier` | ลด diff ไร้สาระใน PR, ทำให้ Code Review โฟกัส Logic | `onSave` + `lint-staged` |
| **Bundle Size** | `vite-bundle-analyzer` | ป้องกัน `node_modules` ลักพา Bundle เกิน 150KB | CI `build` step |
| **Dependency Security** | `npm audit` | ตรวจ CVE ใน `package.json` ก่อน Deploy | CI `audit` step |
| **Dead Code / Unused Exports** | `knip` | ลบไฟล์/Import ที่ไม่ได้ใช้ ลด Maintenance Cost | `npm run lint:knip` (สัปดาห์ละครั้ง) |

---

### 8.3 Test Pyramid & CI Pipeline
| ระดับ | เครื่องมือ | ขอบเขต | Target Coverage |
|------|----------|--------|----------------|
| **Unit** | Vitest + React Testing Library | Hooks, Utils, Isolated Components | ≥80% |
| **Integration** | MSW + Vitest | API flows, Form validation, State updates | ≥75% |
| **E2E** | Playwright | Login → Meter → Dashboard, Offline Sync, Payment | 3 Critical Flows |
| **A11y** | `axe-core` + `jest-axe` | Keyboard nav, Screen reader, Contrast | 0 violations |
| **Performance** | Lighthouse CI | FCP < 1.5s, TTI < 3s, Bundle < 150KB (gzip) | ≥90 score |

#### Full CI Pipeline (Frontend Quality Gates)
```yaml
jobs:
  frontend-quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - name: Install deps
        run: npm ci
      
      # Stage 1: Fast checks (fail fast)
      - name: Lint + React Doctor rules
        run: eslint . --max-warnings 0
      - name: Type check
        run: tsc --noEmit
      
      # Stage 2: Tests
      - name: Unit + Integration tests
        run: vitest run --coverage
      - name: Coverage gate
        run: npx check-coverage --lines 80 --branches 75 --functions 80
      
      # Stage 3: Build + Bundle
      - name: Build + Bundle analysis
        run: vite build && npm run bundle-size-check
      
      # Stage 4: Full React Doctor scan (slow but thorough)
      - name: React Doctor full scan
        run: npx react-doctor@latest --threshold 90 --format github
        env: { GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} }
```

> ✅ **กฎเหล็ก:** 
> 1. **ห้าม Push ถ้า Local Lint/Type Fail** → VS Code + Pre-commit ดักไว้แล้ว
> 2. **Warning = Error ใน CI** (`--max-warnings 0`) → บังคับให้แก้ทันที ไม่สะสม
> 3. **Health Score < 90 → Block Merge** → บังคับให้รักษาคุณภาพโค้ด
> 4. **Dead Code > 7 วัน → ลบทันที** → ใช้ `knip` ตรวจสอบทุกสัปดาห์

---

### 8.4 When Quality Check Fails (AI/Human Workflow)
```text
❌ ESLint/React Doctor พบ Error/Warning:
   1. รัน `eslint --fix` → ตรวจสอบว่าแก้ไม่ทำลาย Logic
   2. รัน `tsc --noEmit` → ยืนยัน Type ยังตรงกัน
   3. Commit ใหม่ → Pre-commit ตรวจสอบซ้ำ
   4. หากแก้แล้ว Logic เปลี่ยน → แจ้ง Human ใน PR Description

❌ React Doctor แจ้ง Performance Anti-Pattern:
   • "Unnecessary useEffect for derived state" → คำนวณค่าใน render แทน
   • "Heavy library import" → ใช้ `React.lazy()` + `Suspense` สำหรับ code splitting
   • "Missing alt attribute" → เพิ่ม `alt` ที่มีความหมาย หรือ `alt=""` สำหรับ decorative images
   • "Prop drilling > 3 levels" → พิจารณาใช้ Context หรือเปลี่ยนโครงสร้างคอมโพเนนต์

❌ Health Score < 90 ใน CI:
   1. เปิดรายงานจาก React Doctor (`npx react-doctor@latest --json`)
   2. จัดลำดับความสำคัญ: Security > Accessibility > Performance > Architecture
   3. แก้ไขทีละจุด → รัน `eslint --fix` + `react-doctor` ใหม่ → ยืนยันว่าคะแนนเพิ่ม
   4. หากคะแนนยังต่ำ → แจ้ง Human เพื่อตัดสินใจว่าจะ relax threshold ชั่วคราวหรือไม่

❌ Bundle Size เกิน 150KB:
   1. รัน `npm run bundle-analyze` → หาไฟล์ใหญ่สุด
   2. เปลี่ยน `import * from 'x'` → `import { specific } from 'x'`
   3. ใช้ `React.lazy()` + `Suspense` สำหรับหน้า/โมดอลที่จำเป็นตอนโหลดแรก
   4. อัปเดต SDD §10 Performance Budget หากจำเป็น
```

> ℹ️ **หมายเหตุ:** Quality Gates นี้ออกแบบมาเพื่อ **Zero Tech Debt Accumulation** โดยใช้ React Doctor เป็น "health monitor" ที่วัดผลได้จริง
> 🔄 **Change Control:** เพิ่มกฎ React Doctor → อัปเดต `eslint.config.js` + CI workflow → แจ้งทีม
> 🤖 **สำหรับ AI Agent:** รัน `eslint --fix && tsc --noEmit` ทุกครั้งก่อนเสนอ PR → หาก Fail ให้แก้แล้วรันซ้ำจนผ่าน → หาก React Doctor แจ้งปัญหา ให้ศึกษาคำแนะนำและแก้ไขตาม