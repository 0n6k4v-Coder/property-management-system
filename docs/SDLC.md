# AI-Native SDLC — Continuous Flow Model

> **Reference Document for AI-Native Development Life Cycle**       
>       
> **Version:** 1.0      
> **Status:** Active        
> **Last Updated:** 2026-07-06      
> **Owner:** @kawee

---

## 🎯 Philosophy

**AI-Native SDLC is not Waterfall, not Scrum, not Kanban — it's a Continuous Flow of 6 Concurrent Loops powered by AI Agents.**

> **Core Insight:** Traditional SDLC assumes human speed. AI-Native SDLC assumes AI speed (seconds/minutes) with human strategic oversight (async, minutes/hours).

---

## ⚡ Core Principles

| Principle | Traditional | AI-Native |
|-----------|-------------|-----------|
| **Decision Granularity** | Big upfront ADRs | **Micro-decisions** (5-30 min, reversible) |
| **Feedback Loop** | Days/Weeks | **Seconds/Minutes** (CI + AI review) |
| **Documentation** | Phase-gated artifacts | **Living docs** (updated per commit) |
| **Testing** | Phase-gated | **Continuous** (every keystroke → AI review) |
| **Decisions** | Big bets, hard to reverse | **Micro-bets**, instant revert |
| **Human Role** | Gatekeeper | **Strategist + Reviewer** (async) |
| **AI Role** | Tool | **Pair Programmer + Reviewer + Tester** |

---

## 🔄 The 6 Concurrent Loops (Not Sequential Phases)

All loops run **CONCURRENTLY** — No "Phase 1 done → Phase 2 starts"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CONTINUOUS DISCOVERY                                     │
│  Problems ↔ Hypotheses ↔ Validation (Continuous)                           │
│  ▸ Human defines outcomes  ▸ AI explores solutions                         │
│  ▸ Continuous requirements refinement  ▸ Living specs                      │
└──────────────────────────┬──────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  DESIGN LOOP    │ │  BUILD LOOP     │ │  VALIDATE LOOP  │
│  (Micro-ADRs)   │ │  (TDD + AI)     │ │  (Continuous)   │
│  ▸ 5-30 min     │ │  ▸ Seconds      │ │  ▸ Every commit │
│  ▸ Reversible   │ │  ▸ Parallel     │ │  ▸ Auto-test    │
│  ▸ Living docs  │ │  ▸ AI pair      │ │  ▸ Contract test│
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
          ┌──────────────────┴──────────────────┐
          ▼                                     ▼
┌─────────────────────────┐           ┌─────────────────────────┐
│    INTEGRATION LOOP     │           │    FEEDBACK LOOP        │
│  ▸ Every push           │           │  ▸ Human review (async) │
│  ▸ Auto-merge if green  │           │  ▸ Metrics → Insights   │
│  ▸ Deploy preview       │           │  ▸ Retro → Improve      │
└─────────────────────────┘           └─────────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │      DELIVER LOOP       │
                    │  ▸ Release when ready   │
                    │  ▸ Canary → Progressive │
                    │  ▸ Observability → Auto-rollback
                    └─────────────────────────┘
```

### Loop Specifications

| Loop | Cadence | Trigger | Output | AI Role | Human Role |
|------|---------|---------|--------|---------|------------|
| **1. Discover** | Continuous | New info / Human input | Hypotheses, Outcomes | Research, Synthesize | Define outcomes |
| **2. Design** | Per micro-decision (5-30m) | New requirement / Change | Micro-ADR, Contract diff | Propose options, Validate | Pick / Modify (async) |
| **3. Build** | Per commit (seconds) | Code change | Working code + Tests | Pair program, Generate tests | Review (optional) |
| **4. Validate** | Every commit (seconds) | Push / PR | Pass/Fail, Contract check | Auto-test, Contract test | Review failures |
| **5. Integrate** | Every push (minutes) | Green build | Deployed preview | Deploy, Smoke test | Monitor |
| **6. Feedback** | Async continuous | Metrics / Human | Insights → Improvements | Analyze, Suggest | Review insights |
| **7. Deliver** | On demand | Human trigger | Release candidate | Canary, Monitor, Rollback | Trigger release |

> **Key:** All loops run **CONCURRENTLY** — No "Phase 1 done → Phase 2 starts"

---

## 📋 Artifact Strategy (Living, Not Phase-Gated)

| Artifact | Update Trigger | Format | Location | Mutability |
|----------|---------------|--------|----------|------------|
| **Outcomes/OKRs** | Human updates | Markdown | `docs/outcomes/` | 🔄 Living |
| **Micro-ADRs** | Per decision (5-30m) | Markdown (append-only) | `docs/decisions/` | 📝 Append-only |
| **Architecture Doc** | Per commit (auto) | Markdown (generated) | `docs/ARCHITECTURE.md` | 🔄 Generated |
| **API Contract** | Per commit (auto) | OpenAPI (generated) | `openapi.json` | 🔄 Generated |
| **Data Model** | Per migration | SQL/Markdown | `docs/data-model/` | 🔄 Living |
| **Sprint Backlog** | Per sprint | Markdown | `docs/sprints/SPRINT_N.md` | 🔄 Living |
| **Test Results** | Per commit | JSON/HTML (CI) | CI artifacts | 📊 Generated |
| **Decision Log** | Per decision | Append-only | `docs/decisions/` | 📝 Append-only |

> **Rule:** If it can be generated → Generate it. If human writes → Living markdown.

---

## 🤖 AI Agent Workflow (Per Commit)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AGENT WORKFLOW PER COMMIT                                │
└─────────────────────────────────────────────────────────────────────────────┘

1. HUMAN: "Add feature X" (Outcome, not implementation)
    │
    ▼
2. AI: Explore → Propose 3 options (Micro-ADR) [30 sec]
    │   ┌─ Option A: Pros/Cons/Risk/Reversibility
    │   ├─ Option B: ...
    │   └─ Option C: ...
    │
    ▼
3. HUMAN: Pick one / Modify [Async, minutes]
    │
    ▼
4. AI: Implement + Generate Tests + Update Docs [Parallel]
    │   ├─ Code
    │   ├─ Unit Tests
    │   ├─ Integration Tests
    │   ├─ Contract Tests
    │   └─ Update Living Docs (Architecture, API, Data Model)
    │
    ▼
5. CI: Run All Loops (Build → Test → Contract → Deploy Preview) [Auto]
    │
    ▼
6. GREEN → Auto-merge → Deploy Preview → Notify Human
    │
    ▼
7. HUMAN: Async Review (Optional) → Approve / Request Changes
    │
    ▼
8. DELIVER: On-demand Release → Canary → Monitor → Rollback if needed
```

---

## 📁 File Structure (Loop-Based)

```
docs/
├── OUTCOMES/                 # Continuous discovery
│   ├── outcomes.md           # Current OKRs/Outcomes
│   └── hypotheses/           # Validated/Invalidated
│
├── DECISIONS/                # Micro-ADRs (Append-only)
│   ├── README.md             # Index
│   ├── 0001-api-versioning.md
│   ├── 0002-auth-strategy.md
│   └── templates/
│       └── micro-adr-template.md
│
├── ARCHITECTURE.md           # Generated per commit (source of truth)
├── ARCHITECTURE.source.md    # Human-maintained sections
│
├── CONTRACTS/                # Generated per commit
│   ├── openapi.json
│   ├── graphql-schema.graphql
│   └── asyncapi.yaml
│
├── DATA-MODEL/               # Per migration
│   ├── current.sql
│   ├── migrations/
│   └── erd.md
│
├── SPRINTS/                  # Sprint = 1-2 weeks (cadence, not phase)
│   ├── README.md             # Sprint index
│   ├── SPRINT_N.md           # Goal, Tasks, Review, Retro
│   └── templates/
│       └── sprint-template.md
│
├── FEEDBACK/                 # Continuous feedback
│   ├── metrics/              # Auto-collected
│   ├── reviews/              # Human reviews
│   └── retros/               # Sprint retros
│
└── RELEASES/                 # Deliver loop
    ├── CHANGELOG.md          # Generated
    ├── RELEASE_NOTES.md      # Per release
    └── deploy-scripts/
```

---

## ⚡ Key Metrics (AI-Native)

| Metric | Target | Why |
|--------|--------|-----|
| **Decision → Code** | < 5 min | Micro-ADR → Implementation |
| **Commit → Deploy Preview** | < 3 min | Fast feedback |
| **Test Coverage** | > 90% (auto-enforced) | Quality gate |
| **Contract Test Pass** | 100% (required) | Breaking change prevention |
| **Human Review Time** | < 15 min (async) | Bottleneck removal |
| **Rollback Time** | < 30 sec | Safety |
| **Decision Reversibility** | 100% (all micro) | Learning culture |

---

## 🔗 Integration with Existing Project

### Current Project Mapping

| Existing | DLC Equivalent | Notes |
|----------|----------------|-------|
| `AGENTS.md` | Rules & Workflow (SSOT) | Updated to reference DLC |
| `INDEX.md` | Navigation Map | Updated to reference DLC |
| `docs/DECISIONS/` | Micro-ADRs + Legacy ADRs | Legacy ADRs kept for history |
| `docs/SPRINTS/` | Sprint Cadence | Sprint = 1-2 weeks cadence |
| `docs/ARCHITECTURE.md` | Generated per commit | Source of truth |
| `docs/DECISIONS/001-...` | Legacy ADR | Kept for history, new decisions = Micro-ADRs |

### Migration Path

1. **Keep existing** `docs/DECISIONS/000-...` and `001-...` as historical ADRs
2. **New decisions** → Micro-ADRs in `docs/decisions/` (new folder)
3. **Sprints** → `docs/sprints/SPRINT_N.md` (rename from SPRINTS/)
4. **Architecture** → Auto-generate from source + human sections
5. **API Contracts** → Auto-generate from code

---

## 🚀 Getting Started

### For New Features
```bash
# 1. Human states outcome
# 2. AI proposes Micro-ADR (30 sec)
# 3. Human picks (async)
# 4. AI implements + tests + docs (parallel)
# 5. CI runs all loops (auto)
# 5. Green → auto-merge → preview deploy
# 7. Human async review (optional)
# 8. Deliver on demand
```

### For Bug Fixes
```bash
# 1. AI analyzes → proposes fix options
# 2. Human picks
# 3. AI implements + regression tests
# 4. CI validates (auto)
# 5. Deploy → monitor
```

### For Refactoring
```bash
# 1. AI analyzes impact → proposes strategy
# 2. Human approves scope
# 3. AI executes in small reversible steps
# 4. Continuous validation
# 5. Deploy when confident
```

---

## 📚 References

- [AI-Native Development](https://hermes-agent.nousresearch.com/docs/concepts/ai-native)
- [Micro-ADR Pattern](https://github.com/NousResearch/hermes-agent/blob/main/docs/concepts/micro-adr.md)
- [Continuous Delivery](https://continuousdelivery.com/)
- [Trunk-Based Development](https://trunkbaseddevelopment.com/)

---

## 📝 Changelog

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-07-06 | Initial AI-Native SDLC Continuous Flow Model | @hermes-agent (nemotron-3-ultra-550b-a55b) |

---

> **Remember:** This is a living document. Update it as the AI-Native workflow evolves. The best process is the one that works for your team — iterate continuously.