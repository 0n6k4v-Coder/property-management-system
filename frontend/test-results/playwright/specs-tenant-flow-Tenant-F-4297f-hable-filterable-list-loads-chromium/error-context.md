# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: specs/tenant-flow.spec.ts >> Tenant Flow — Tenant List (/tenants) >> TENANT-01: List tenants → paginated, searchable, filterable list loads
- Location: e2e/specs/tenant-flow.spec.ts:210:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('h1').first()
Expected pattern: /Tenants/i
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 60000ms
  - waiting for locator('h1').first()

```

# Test source

```ts
  115 |         status: 200,
  116 |         contentType: 'application/json',
  117 |         body: JSON.stringify(
  118 |           wrapInData({
  119 |             data: paginated,
  120 |             meta: {
  121 |               total: filtered.length,
  122 |               page: pageNum,
  123 |               limit: 20,
  124 |               has_next: start + 20 < filtered.length,
  125 |               has_prev: pageNum > 1,
  126 |             },
  127 |           })
  128 |         ),
  129 |       });
  130 |     });
  131 | 
  132 |     // Setup create tenant mock
  133 |     await page.route('**/api/v1/tenants', async (route) => {
  134 |       if (route.request().method() !== 'POST') {
  135 |         return route.continue();
  136 |       }
  137 | 
  138 |       const postData = route.request().postData();
  139 |       let body: Record<string, unknown> = {};
  140 |       try {
  141 |         body = JSON.parse(postData || '{}');
  142 |       } catch {
  143 |         // Ignore parse error
  144 |       }
  145 | 
  146 |       // Validate required fields
  147 |       const requiredFields = ['full_name', 'id_card_number', 'phone', 'property_id'];
  148 |       for (const field of requiredFields) {
  149 |         if (!body[field]) {
  150 |           await route.fulfill({
  151 |             status: 400,
  152 |             contentType: 'application/json',
  153 |             body: JSON.stringify({ error: { code: 'VAL-400', message: `${field} is required` } }),
  154 |           });
  155 |           return;
  156 |         }
  157 |       }
  158 | 
  159 |       // Validate Thai ID card checksum
  160 |       const idCard = body.id_card_number as string;
  161 |       if (idCard.length !== 13 || !/^\d{13}$/.test(idCard)) {
  162 |         await route.fulfill({
  163 |           status: 400,
  164 |           contentType: 'application/json',
  165 |           body: JSON.stringify({ error: { code: 'VAL-400', message: 'Thai ID card must be exactly 13 digits' } }),
  166 |         });
  167 |         return;
  168 |       }
  169 | 
  170 |       // Validate phone format
  171 |       const phone = body.phone as string;
  172 |       if (phone.length !== 10 || !/^0\d{9}$/.test(phone)) {
  173 |         await route.fulfill({
  174 |           status: 400,
  175 |           contentType: 'application/json',
  176 |           body: JSON.stringify({ error: { code: 'VAL-400', message: 'Invalid Thai phone format (0XXXXXXXXX)' } }),
  177 |         });
  178 |         return;
  179 |       }
  180 | 
  181 |       // Success response
  182 |       await route.fulfill({
  183 |         status: 201,
  184 |         contentType: 'application/json',
  185 |         body: JSON.stringify(
  186 |           wrapInData({
  187 |             id: 't-new-' + Date.now(),
  188 |             full_name: body.full_name,
  189 |             id_card_number: body.id_card_number,
  190 |             phone: body.phone,
  191 |             email: body.email || null,
  192 |             emergency_contact_name: body.emergency_contact_name || null,
  193 |             emergency_contact_phone: body.emergency_contact_phone || null,
  194 |             property_id: body.property_id,
  195 |             room_id: null,
  196 |             is_active: true,
  197 |             created_at: new Date().toISOString(),
  198 |             updated_at: new Date().toISOString(),
  199 |           })
  200 |         ),
  201 |       });
  202 |     });
  203 | 
  204 |     states = await captureAllStates(page);
  205 |   });
  206 | 
  207 |   // --------------------------------------------------------------------------
  208 |   // TENANT-01: List tenants (Happy Path)
  209 |   // --------------------------------------------------------------------------
  210 |   test('TENANT-01: List tenants → paginated, searchable, filterable list loads', async ({ page }) => {
  211 |     await login(page);
  212 |     await page.goto('/tenants');
  213 |     await page.waitForLoadState('domcontentloaded');
  214 |     await page.waitForLoadState('networkidle');
> 215 |     await expect(page.locator('h1').first()).toContainText(/Tenants/i, { timeout: 60000 });
      |                                              ^ Error: expect(locator).toContainText(expected) failed
  216 | 
  217 |     // Verify heading
  218 |     await expect(page.locator('h1').first()).toContainText(/Tenants/i);
  219 | 
  220 |     // Verify search input exists
  221 |     await expect(page.locator('input[placeholder*="min. 3 chars"]').first()).toBeVisible();
  222 | 
  223 |     // Verify New Tenant button
  224 |     await expect(page.locator('button:has-text("New Tenant")').first()).toBeVisible();
  225 | 
  226 |     // Verify table loads with data
  227 |     await expect(page.locator('table').first()).toBeVisible();
  228 |     await expect(page.locator('text=สมชาย ใจดี').first()).toBeVisible();
  229 |     await expect(page.locator('text=0812345678').first()).toBeVisible();
  230 |     await expect(page.locator('text=somchai@example.com').first()).toBeVisible();
  231 | 
  232 |     // Verify pagination info
  233 |     await expect(page.locator('text=2 results').first()).toBeVisible();
  234 | 
  235 |     // State Verification
  236 |     expect(states.consoleErrors).toEqual([]);
  237 |     expect(states.jsErrors).toEqual([]);
  238 |     expect(states.networkErrors).toEqual([]);
  239 |     expect(states.hydrationErrors).toEqual([]);
  240 |   });
  241 | 
  242 |   // --------------------------------------------------------------------------
  243 |   // TENANT-02: Create tenant (Happy Path)
  244 |   // --------------------------------------------------------------------------
  245 |   test('TENANT-02: Create tenant → modal opens, encrypt ID card, save, toast success', async ({ page }) => {
  246 |     await login(page);
  247 |     await navigateTo(page, '/tenants', /Tenants/i);
  248 | 
  249 |     // Click New Tenant button
  250 |     await clickButton(page, /New Tenant/i);
  251 | 
  252 |     // Verify modal opens
  253 |     await expect(page.locator('h2:has-text("Create Tenant")').first()).toBeVisible({ timeout: 5000 });
  254 | 
  255 |     // Fill form with valid data
  256 |     await fillField(page, 'Full Name', 'ทดสอบ ใหม่');
  257 |     await fillField(page, 'ID Card (13 digits)', '1234567890125'); // Valid checksum
  258 |     await fillField(page, 'Phone (10 digits)', '0834567890');
  259 |     await fillField(page, 'Email (optional)', 'testnew@example.com');
  260 |     await fillField(page, 'Emergency Contact Name', 'ผู้ติดต่อฉุกเฉิน');
  261 |     await fillField(page, 'Emergency Contact Phone', '0845678901');
  262 | 
  263 |     // Submit
  264 |     await clickButton(page, /Create/i);
  265 | 
  266 |     // Verify toast success
  267 |     await expect(page.locator('text=Tenant created successfully').first()).toBeVisible({ timeout: 5000 });
  268 | 
  269 |     // Verify modal closes
  270 |     await expect(page.locator('h2:has-text("Create Tenant")').first()).not.toBeVisible({ timeout: 5000 });
  271 | 
  272 |     // State Verification
  273 |     expect(states.consoleErrors).toEqual([]);
  274 |     expect(states.jsErrors).toEqual([]);
  275 |     expect(states.networkErrors).toEqual([]);
  276 |     expect(states.hydrationErrors).toEqual([]);
  277 |   });
  278 | 
  279 |   // --------------------------------------------------------------------------
  280 |   // TENANT-03: Search by name/phone (Feature)
  281 |   // --------------------------------------------------------------------------
  282 |   test('TENANT-03: Search by name/phone → debounced search filters results', async ({ page }) => {
  283 |     await login(page);
  284 |     await navigateTo(page, '/tenants', /Tenants/i);
  285 | 
  286 |     // Search by name (partial)
  287 |     await fillField(page, 'Search by name, phone, or email (min. 3 chars)', 'สมชาย');
  288 |     await page.waitForTimeout(500); // Debounce
  289 | 
  290 |     await expect(page.locator('text=สมชาย ใจดี').first()).toBeVisible();
  291 |     await expect(page.locator('text=สมหญิง สวัสดี').first()).not.toBeVisible();
  292 | 
  293 |     // Clear search
  294 |     await fillField(page, 'Search by name, phone, or email (min. 3 chars)', '');
  295 |     await page.waitForTimeout(500);
  296 | 
  297 |     // Search by phone
  298 |     await fillField(page, 'Search by name, phone, or email (min. 3 chars)', '0823456789');
  299 |     await page.waitForTimeout(500);
  300 | 
  301 |     await expect(page.locator('text=สมหญิง สวัสดี').first()).toBeVisible();
  302 |     await expect(page.locator('text=สมชาย ใจดี').first()).not.toBeVisible();
  303 | 
  304 |     // State Verification
  305 |     expect(states.consoleErrors).toEqual([]);
  306 |     expect(states.jsErrors).toEqual([]);
  307 |     expect(states.networkErrors).toEqual([]);
  308 |     expect(states.hydrationErrors).toEqual([]);
  309 |   });
  310 | 
  311 |   // --------------------------------------------------------------------------
  312 |   // TENANT-04: Filter by property (Feature) - Not implemented in UI yet
  313 |   // --------------------------------------------------------------------------
  314 |   test.skip('TENANT-04: Filter by property → multi-select property filter', async ({ page }) => {
  315 |     // SKIPPED: TenantListPage.tsx does not have property filter UI yet
```