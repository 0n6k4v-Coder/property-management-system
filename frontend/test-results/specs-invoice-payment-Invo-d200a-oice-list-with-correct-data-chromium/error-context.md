# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: specs/invoice-payment.spec.ts >> Invoice Payment Flow >> should display invoice list with correct data
- Location: e2e/specs/invoice-payment.spec.ts:180:3

# Error details

```
Error: Channel closed
```

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('body')
- Expected substring  - 1
+ Received string     + 6

- INV-2026-001
+
+     
+     
+   
+
+

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('body')
    4 × locator resolved to <body class="bg-surface-50 text-surface-900 antialiased">…</body>
      - unexpected value "
    Property ManagementDashboardPropertiesTenantsMetersInvoicesContractsMaintenanceReportsSettingsLogoutLoading…© 2026 Property Management System
    
  

"
    4 × locator resolved to <body class="bg-surface-50 text-surface-900 antialiased">…</body>
      - unexpected value "
    
    
  

"

```

```
Error: apiRequestContext._wrapApiCall: Target page, context or browser has been closed
```