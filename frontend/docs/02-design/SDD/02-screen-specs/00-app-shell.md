# SCR-APP-SHELL: Application Shell Layout with Expandable Sidebar

| Attribute | Detail |
|-----------|--------|
| **Route** | All protected routes (wrapper layout — `MainLayout.tsx`) |
| **Layout** | Collapsible icon-only sidebar + top header bar + card-panel content area |
| **Applies to** | Every authenticated page (`/dashboard`, `/property`, `/invoices`, etc.) |
| **UI Elements** | `Sidebar`, `SidebarToggle`, `NavIcon`, `TopHeader`, `Breadcrumb`, `SearchInput`, `PrimaryCTA`, `UserAvatar`, `ContentCard` |
| **State Mapping** | `sidebar.expanded` (localStorage persisted), `sidebar.mobileOpen` (transient) |
| **Accessibility** | Focus trap on mobile drawer, `aria-expanded` on toggle, keyboard nav, contrast ≥ 4.5:1 |

---

## 1. Design Characteristics

### 1.1 Layout & Architecture

- **Pattern:** Collapsible/Expandable Sidebar Layout (modern admin dashboard shell)
- **Spatial Organization:**
  - **Left Sidebar:** Compact icon-only navigation, grouped vertically into sections, conserving horizontal space for the main content area.
  - **Top Header:** Global toolbar with user context (greeting, breadcrumb) and a page-specific primary CTA.
  - **Main Content Area:** Large central region structured as a card panel with rounded corners, hosting tables, charts, or page-specific content.

### 1.2 Active State Hierarchy

- The selected menu item displays a pill-shaped (capsule) background highlight with a contrasting icon color, providing immediate visual confirmation of the current location.

---

## 2. Left Sidebar

### 2.1 Visual Grouping

| Section | Items | Description |
|---------|-------|-------------|
| **MENU** | Dashboard, Properties, Tenants, Meters, Invoices, Contracts, Maintenance, Reports | Primary navigation links arranged vertically |
| **USER** | Settings | System management link |
| **Bottom** | User Profile Avatar | Identifies the currently active account |

> **Note:** Menu items map directly to existing routes in the application. Items that do not correspond to real features (e.g., Calendar, Inbox, Files, Apps, Help & Support) have been excluded from the design.

### 2.2 Active State

- The active menu item (e.g., Dashboard) is rendered with a pill-shaped background highlight and a prominent icon color change, distinguishing it from inactive items.

### 2.3 Collapse/Expand Toggle

- A toggle arrow button (`[>]`) at the top-left corner of the sidebar controls expand/collapse behavior.
- When collapsed: sidebar shows icons only (~64px width).
- When expanded: sidebar shows icons + text labels (~240px width).
- State is persisted in `localStorage` for desktop sessions.

---

## 3. Top Header Bar

### 3.1 Greeting & Context

- Displays a heading-level greeting (e.g., "Welcome back, {userName}!") aligned to the left.
- A breadcrumb below the greeting indicates the current page location (e.g., `Dashboard`).

### 3.2 Action Elements

| Element | Style | Purpose |
|---------|-------|---------|
| **Search** | Icon button | Global quick search access |
| **Primary CTA** (e.g., "+ Add Property", "+ Add Tenant") | Solid primary color (filled blue) | Most important action on the current page, dynamically labeled based on the active route |

> **Note:** The "Attendance" secondary action and "Quick Filter" icon from the original reference design have been removed — they do not correspond to any feature in this product. The Primary CTA label changes contextually based on the current page (e.g., "+ Add Property" on `/property`, "+ Add Tenant" on `/tenants`, "+ New Invoice" on `/invoices`).

---

## 4. Main Content Area

- Large central region filling remaining space between sidebar and viewport edge.
- Structured as a card panel with rounded corners.
- Hosts page-specific content: data tables, charts, dashboards, forms.
- Content scrolls independently; sidebar and header remain fixed.

---

## 5. Responsive Behavior

### 5.1 Desktop View (≥1024px)

#### 5.1.1 Detailed Characteristics

| Property | Value |
|----------|-------|
| **Sidebar** | Fixed, visible at all times |
| **Sidebar width** | Collapsed: ~64px (icon-only) / Expanded: ~240px (icon + label) |
| **Sidebar position** | Static, left side, full viewport height |
| **Header bar** | Full width, spans from sidebar edge to viewport right edge |
| **Header content** | Greeting + breadcrumb (left), search + primary CTA (right) — all visible |
| **Content area** | Fills remaining horizontal space after sidebar |
| **Content padding** | 24px horizontal, 24px vertical |
| **Footer** | Not displayed |
| **Sidebar state** | Persisted in `localStorage` across sessions |
| **Toggle** | `[>]` button at sidebar top-left |

#### 5.1.2 ASCII Layout Model — Desktop

```text
+-------------------------------------------------------------------------------------------------------+
|  [>]                                                                                                  |
|                                Welcome back, {userName}                          [Q] [+ Add Property] |
|  MENU                          Dashboard                                                              |
|  +----+  +-----------------------------------------------------------------------------------------+  |
|  |(D) |  |                                                                                         |  |
|  +----+  |                                                                                         |  |
|   (P)    |                                                                                         |  |
|   (T)    |                                                                                         |  |
|   (M)    |                                                                                         |  |
|   (I)    |                                Main Content Area                                        |  |
|   (C)    |                            (Dashboard / Card Panel)                                     |  |
|   (Mt)   |                                                                                         |  |
|   (R)    |                                                                                         |  |
|          |                                                                                         |  |
|  USER    |                                                                                         |  |
|   (S)    |                                                                                         |  |
|          |                                                                                         |  |
|  [👤]    +-----------------------------------------------------------------------------------------+  |
+-------------------------------------------------------------------------------------------------------+
```

#### Legend

- `[>]` : Expand/collapse toggle arrow
- `(D)` : Dashboard (active state — pill highlight)
- `(P)` : Properties
- `(T)` : Tenants
- `(M)` : Meters
- `(I)` : Invoices
- `(C)` : Contracts
- `(Mt)` : Maintenance
- `(R)` : Reports
- `(S)` : Settings
- `[👤]` : User Profile Avatar
- `[Q]` : Quick Search
- `[+ Add Property]` : Primary CTA (solid color, label changes per page)

---

### 5.2 Tablet View (768px–1023px)

#### 5.2.1 Detailed Characteristics

| Property | Value |
|----------|-------|
| **Sidebar** | Fixed, visible but defaults to collapsed (icon-only) |
| **Sidebar width** | ~64px (collapsed only; expand is overlay, not push) |
| **Sidebar position** | Static, left side, full viewport height |
| **Sidebar expand** | When expanded, sidebar overlays content as a drawer (does not push content) with a semi-transparent backdrop scrim |
| **Header bar** | Full width, spans from sidebar edge to viewport right edge |
| **Header content** | Greeting shortened (first name only, e.g., "Welcome, {userName}"), breadcrumb visible, search + primary CTA visible |
| **Content area** | Fills remaining horizontal space after collapsed sidebar |
| **Content padding** | 16px horizontal, 20px vertical |
| **Footer** | Not displayed |
| **Sidebar state** | Collapsed by default; expand is transient (not persisted) |
| **Toggle** | `[>]` button at sidebar top-left |
| **Backdrop** | Semi-transparent black (rgba(0,0,0,0.4)) when sidebar expanded as overlay |
| **Close expanded** | Tap backdrop or select a menu item |

#### 5.2.2 ASCII Layout Model — Tablet (Collapsed, default)

```text
+------------------------------------------------------------------+
|  [>]                                                             |
|               Welcome, {userName}        [Q] [+ Add Property]    |
|  MENU         Dashboard                                          |
|  +----+  +---------------------------------------------------+   |
|  |(D) |  |                                                   |   |
|  +----+  |                                                   |   |
|   (P)    |                                                   |   |
|   (T)    |                                                   |   |
|   (M)    |               Main Content Area                   |   |
|   (I)    |            (Dashboard / Card Panel)               |   |
|   (C)    |                                                   |   |
|   (Mt)   |                                                   |   |
|   (R)    |                                                   |   |
|          |                                                   |   |
|  USER    |                                                   |   |
|   (S)    |                                                   |   |
|          |                                                   |   |
|  [👤]    +---------------------------------------------------+   |
+------------------------------------------------------------------+
```

#### ASCII Layout Model — Tablet (Expanded overlay)

```text
+----------+-------------------------------------------------------+
|          |██████████████████████████████████████████████████████ |
|  MENU    |██████████████████████████████████████████████████████ |
|  +----+  |██████████████████████████████████████████████████████ |
|  |(D)|  |██████████████████████████████████████████████████████ |
|  +----+  |████████████████████  Backdrop  ████████████████████ |
|  (P)     |██████████████████████████████████████████████████████ |
|  Properties |██████████████████  (tap to close)  ████████████████ |
|  (T)     |██████████████████████████████████████████████████████ |
|  Tenants |██████████████████████████████████████████████████████ |
|  (M)     |██████████████████████████████████████████████████████ |
|  Meters  |██████████████████████████████████████████████████████ |
|  (I)     |██████████████████████████████████████████████████████ |
|  Invoices|██████████████████████████████████████████████████████ |
|  (C)     |██████████████████████████████████████████████████████ |
|  Contracts|██████████████████████████████████████████████████████ |
|  (Mt)    |██████████████████████████████████████████████████████ |
|  Maintenance|██████████████████████████████████████████████████ |
|  (R)     |██████████████████████████████████████████████████████ |
|  Reports |██████████████████████████████████████████████████████ |
|          |██████████████████████████████████████████████████████ |
|  USER    |██████████████████████████████████████████████████████ |
|  (S)     |██████████████████████████████████████████████████████ |
|  Settings|██████████████████████████████████████████████████████ |
|          |██████████████████████████████████████████████████████ |
|  [👤] {userName}|██████████████████████████████████████████████████████ |
+----------+-------------------------------------------------------+
  ↑ Sidebar     ↑ Semi-transparent backdrop scrim
  (expanded,
   ~240px,
   overlay)
```

---

### 5.3 Mobile View (<768px)

#### 5.3.1 Detailed Characteristics

| Property | Value |
|----------|-------|
| **Sidebar** | Hidden by default; opens as overlay drawer |
| **Sidebar width** | ~240px when open (icon + label) |
| **Sidebar position** | Fixed overlay, left side, full viewport height |
| **Sidebar open trigger** | Hamburger button `[≡]` in header bar |
| **Sidebar close trigger** | Tap backdrop, select menu item, or swipe left |
| **Header bar** | Full viewport width, single row |
| **Header content** | Hamburger toggle (left), page title (center-left), CTA icon-only + avatar (right) |
| **Greeting text** | Hidden (no space); replaced by page title only |
| **Breadcrumb** | Hidden (no space); page title suffices |
| **Search** | Hidden by default; accessible via icon that opens a full-width search bar below header |
| **Primary CTA** | Visible but reduced to icon-only `[+]` |
| **User Avatar** | Moved to header bar right side (replaces sidebar bottom placement) |
| **Content area** | Full viewport width |
| **Content padding** | 16px horizontal, 16px vertical |
| **Footer** | Not displayed |
| **Sidebar state** | Transient (closed on navigation, not persisted) |
| **Backdrop** | Semi-transparent black (rgba(0,0,0,0.5)) when drawer open |
| **Focus trap** | Active when drawer is open (Tab/Shift+Tab cycles within drawer) |
| **Swipe gesture** | Swipe left on drawer or backdrop to close |
| **Animation** | Drawer slides in from left: `transform: translateX(-100%)` → `translateX(0)`, duration 200ms ease-out |

#### 5.3.2 ASCII Layout Model — Mobile (Default, sidebar closed)

```text
┌─────────────────────────────────┐
│ [≡]  Dashboard         [+] [👤] │
├─────────────────────────────────┤
│                                 │
│                                 │
│                                 │
│       Main Content Area         │
│       (full width, 16px pad)    │
│                                 │
│                                 │
│                                 │
│                                 │
└─────────────────────────────────┘
```

#### ASCII Layout Model — Mobile (Sidebar open as drawer)

```text
┌──────────┬──────────────────────┐
│          |██████████████████████│
│  MENU    |██████████████████████│
│  +----+  |██████████████████████│
│  |(D)|   |██████████████████████│
│  +----+  |██████████████████████│
│   (P)    |██████████████████████│
│Properties|██████  Backdrop  █████│
│   (T)    |████  (tap to close) ██│
│  Tenants |██████████████████████│
│   (M)    |██████████████████████│
│  Meters  |██████████████████████│
│   (I)    |██████████████████████│
│ Invoices |██████████████████████│
│   (C)    |██████████████████████│
│ Contracts|██████████████████████│
│   (Mt)   |██████████████████████│
│Maintenance|██████████████████│
│   (R)    |██████████████████████│
│  Reports |██████████████████████│
│          |██████████████████████│
│  USER    |██████████████████████│
│   (S)    |██████████████████████│
│ Settings |██████████████████████│
│          |██████████████████████│
│[👤]{userName}│██████████████████████│
└──────────┴──────────────────────┘
  ↑ Sidebar       ↑ Semi-transparent backdrop
  (drawer,
   ~240px,
   overlay,
   slide-in
   from left)
```

#### Mobile Header Bar — Detailed

```text
┌─────────────────────────────────────────┐
│ [≡]  Dashboard              [+] [👤]    │
│  ↑      ↑                    ↑    ↑     │
│ toggle  page title          CTA  avatar │
└─────────────────────────────────────────┘
```

---

## 6. Breakpoint Summary

| Breakpoint | Sidebar | Header | Content | Padding |
|------------|---------|--------|---------|---------|
| **Desktop** (≥1024px) | Fixed, icon-only or expanded | Full greeting + breadcrumb + search + primary CTA | Full remaining width | 24px H, 24px V |
| **Tablet** (768–1023px) | Collapsed (icon-only); expand = overlay | Short greeting + breadcrumb + search + primary CTA | Remaining width after 64px sidebar | 16px H, 20px V |
| **Mobile** (<768px) | Hidden; hamburger opens drawer overlay | Hamburger + page title + icon CTA + avatar | Full viewport width | 16px H, 16px V |
