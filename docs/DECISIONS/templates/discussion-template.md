# Discussion Template — Property Management System

**ใช้สำหรับ:** `docs/DECISIONS/000-discussion-<topic>.md`

---

## Metadata

```yaml
title: "<Short topic title>"
status: "🟡 Discussion"  # 🟡 Discussion | 🟢 Accepted | 🔴 Rejected
number: "000"
topic: "<kebab-case-topic>"
created: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
author: "@username"
participants:
  - "@reviewer1"
  - "@reviewer2"
related_decisions: []  # e.g., ["001-adopt-..."]
supersedes: []         # e.g., ["000-discussion-old-topic"]
tags: []               # e.g., ["ai-agent", "hermes", "multi-agent", "kanban"]
```

---

## 1. Context & Problem Statement (บริบทและปัญหา)

**What is the problem we're trying to solve?**
- อธิบายปัญหาหรือโอกาสที่นำไปสู่การพิจารณานี้
- ทำไมต้องทำตอนนี้ (timing, urgency)
- ผลกระทบต่อ project ถ้าไม่ทำ / ทำผิด

**Current State:**
- สถานะปัจจุบันเป็นอย่างไร
- Pain points ที่เจอ

**Desired State:**
- อยากให้เป็นอย่างไรหลังตัดสินใจ

---

## 2. Scope (ขอบเขต)

| In Scope | Out of Scope |
|----------|--------------|
| - Item 1 | - Item A |
| - Item 2 | - Item B |

---

## 3. Options Considered (ตัวเลือกที่พิจารณา)

สร้างตารางเปรียบเทียบอย่างน้อย 3 ตัวเลือก (รวม status quo)

| Option | Description | Pros | Cons | Effort | Risk |
|--------|-------------|------|------|--------|------|
| **A: Status Quo** | คงเดิม ไม่ทำอะไร | - รู้จักแล้ว<br>- ค่าใช้จ่าย 0 | - ปัญหาไม่หาย<br>- Technical debt เพิ่ม | Low | High |
| **B: <Option Name>** | รายละเอียดสั้นๆ | - ผลประโยชน์ 1<br>- ผลประโยชน์ 2 | - ข้อเสีย 1<br>- ข้อเสีย 2 | Medium | Medium |
| **C: <Option Name>** | รายละเอียดสั้นๆ | - ผลประโยชน์ 1<br>- ผลประโยชน์ 2 | - ข้อเสีย 1<br>- ข้อเสีย 2 | High | Low |

> **หมายเหตุ:** Option ที่แนะนำ ให้ bold (`**B: ...**`) และใส่ ✅ หรือ 🔥

---

## 4. Detailed Analysis (วิเคราะห์ละเอียด)

### Option B: <Option Name> (Recommended)

#### Technical Details
- Implementation approach
- Dependencies
- Migration path (if applicable)

#### Resource Requirements
| Resource | Estimate | Notes |
|----------|----------|-------|
| Time | X weeks | |
| People | X persons | |
| Infrastructure | | e.g., new servers, tools |
| Learning Curve | | Team training needed? |

#### Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Risk 1 | Medium | High | Mitigation plan |
| Risk 2 | Low | Medium | Mitigation plan |

---

## 5. Open Questions (คำถามที่ยังไม่มีคำตอบ)

- [ ] Question 1?
- [ ] Question 2?
- [ ] Question 3?

> ติด checkbox เพื่อ track ว่าได้คำตอบแล้วหรือยัง

---

## 6. Stakeholder Feedback (ความคิดเห็นจากผู้เกี่ยวข้อง)

| Stakeholder | Role | Feedback | Date |
|-------------|------|----------|------|
| @user1 | Backend Lead | "Concerned about X..." | YYYY-MM-DD |
| @user2 | Frontend Lead | "Looks good if..." | YYYY-MM-DD |

---

## 7. Related Documentation (เอกสารที่เกี่ยวข้อง)

- [Architecture Decision Log](README.md)
- [Related ADR: NNN-...](NNN-adopt-....md)
- [ARCHITECTURE.md](../ARCHITECTURE.md#relevant-section)
- [SDD: 09-deployment.md](../backend/docs/02-design/SDD/09-deployment.md)
- [OPERATIONS.md](../backend/docs/OPERATIONS.md)

---

## 8. Decision Outcome (ผลลัพธ์การตัดสินใจ) — *Update เมื่อมีการตัดสินใจ*

> **ยังไม่ตัดสินใจ** — รอ Human approve

| Field | Value |
|-------|-------|
| **Decision** | ✅ Accepted / ❌ Rejected / 🔄 Superseded |
| **Decision File** | `NNN-adopt-<topic>.md` or `NNN-reject-<topic>.md` |
| **Decided By** | @username |
| **Decision Date** | YYYY-MM-DD |
| **Implementation Target** | Sprint N / YYYY-MM-DD |

---

## 9. Changelog (การเปลี่ยนแปลง)

| Date | Version | Changes | By |
|------|---------|---------|-----|
| YYYY-MM-DD | 0.1 | Initial draft | @author |
| YYYY-MM-DD | 0.2 | Added Option C analysis | @reviewer |

---

## Usage Instructions

1. **Copy** this template → `docs/DECISIONS/000-discussion-<topic>.md`
2. **Fill** metadata (YAML frontmatter) + sections 1-7
3. **Share** for review (tag stakeholders)
4. **Iterate** based on feedback (update changelog)
5. **Decide** → Create decision file from `decision-template.md`
6. **Link** both files together (cross-references)
6. **Update** `README.md` index table

---

> 💡 **Tip:** Discussion file เป็น living document — อัปเดตตลอดการวิเคราะห์ Decision file เป็น immutable record — สร้างครั้งเดียวเมื่อตัดสินใจแล้ว