# File: 02-design/SDD/07-traceability.md
# Traceability Matrix
## Property Management System

---

## 8. Traceability Matrix

| FR ID | Module | File(s) | Function/Endpoint | Test File(s) | Docker Test Command |
|-------|--------|---------|-------------------|-------------|-------------------|
| FR-USER-01 | auth | `auth_router.py`, `auth_service.py` | `POST /login`, `AuthService.authenticate()` | `tests/modules/auth/test_auth_api.py` | `docker compose run --rm backend-test pytest tests/modules/auth/ -k login` |
| FR-USER-02 | auth | `invite_service.py` | `InviteService.create_invite()` | `tests/modules/auth/test_invite_service.py` | `docker compose run --rm backend-test pytest tests/modules/auth/ -k invite` |
| FR-PROP-01 | property | `property_router.py`, `property_service.py` | `PropertyService.create_property()`, `PropertyService.list_properties()`, `POST /properties`, `GET /properties` | `tests/modules/property/test_property_api.py` | `docker compose run --rm backend-test pytest tests/modules/property/ -k property` |
| FR-PROP-02 | property | `property_router.py`, `property_service.py` | `PropertyService.get_property_by_id()`, `GET /properties/{id}` | `tests/modules/property/test_property_api.py` | `docker compose run --rm backend-test pytest tests/modules/property/ -k detail` |
| FR-PROP-05 | property | `room_service.py`, `room_router.py` | `RoomService.create_room()`, `POST /rooms` | `tests/modules/property/test_room_api.py` | `docker compose run --rm backend-test pytest tests/modules/property/ -k room` |
| FR-METER-01~04 | billing | `meter_service.py`, `meter_router.py` | `MeterService.record_reading()`, `POST /meter-readings` | `tests/modules/billing/test_meter_api.py` | `docker compose run --rm backend-test pytest tests/modules/billing/ -k meter` |
| FR-METER-05,14 | billing | `invoice_service.py` | `InvoiceService.resolve_utility_rate()` | `tests/modules/billing/test_invoice_service.py::test_resolve_rate_cascade` | `docker compose run --rm backend-test pytest tests/modules/billing/ -k cascade` |
| FR-METER-06,07 | billing | `invoice_service.py`, `invoice_router.py` | `InvoiceService.generate_monthly_invoices()`, `POST /invoices/bulk-generate` | `tests/modules/billing/test_invoice_api.py` | `docker compose run --rm backend-test pytest tests/modules/billing/ -k bulk` |
| FR-METER-09 | billing | `payment_service.py`, `payment_router.py` | `PaymentService.record_payment()`, `POST /payments` | `tests/modules/billing/test_payment_api.py` | `docker compose run --rm backend-test pytest tests/modules/billing/ -k payment` |
| FR-METER-10 | billing | `schemas.py`, `invoice_router.py` | `InvoiceResponse`, `GET /invoices` | `tests/modules/billing/test_invoice_api.py::test_list_invoices` | `docker compose run --rm backend-test pytest tests/modules/billing/ -k list` |
| FR-METER-12,13 | billing | `utils/line_format.py` | `build_line_billing_preview()` | `tests/shared/test_line_format.py` | `docker compose run --rm backend-test pytest tests/shared/ -k line` |
| FR-CONTRACT-01 | contract | `contract_service.py` | `ContractService.create_contract()` | `tests/modules/contract/test_contract_service.py` | `docker compose run --rm backend-test pytest tests/modules/contract/ -k create` |
| FR-CONTRACT-02 | contract | `contract_service.py`, `schedulers.py` | `ContractService.check_near_expiry()`, daily scheduler job | `tests/modules/contract/test_contract_service.py::test_check_near_expiry` | `docker compose run --rm backend-test pytest tests/modules/contract/ -k expiry` |
| FR-TENANT-01,02 | tenant | `tenant_service.py` | `TenantService.create_tenant()` with encryption | `tests/modules/tenant/test_tenant_service.py::test_create_tenant_encrypts_id_card` | `docker compose run --rm backend-test pytest tests/modules/tenant/ -k encrypt` |
| FR-TENANT-04 | tenant | `tenant_router.py`, `repository.py` | `GET /tenants/search`, `TenantRepo.search()` | `tests/modules/tenant/test_tenant_api.py::test_search_tenants` | `docker compose run --rm backend-test pytest tests/modules/tenant/ -k search` |
| FR-DASH-01 | dashboard | `dashboard_service.py`, `dashboard_router.py` | `DashboardService.get_dashboard_summary()`, `GET /dashboard` | `tests/modules/dashboard/test_dashboard_api.py` | `docker compose run --rm backend-test pytest tests/modules/dashboard/ -k summary` |
| FR-MAINT-01~03 | maintenance | `maintenance_service.py`, `maintenance_router.py` | `MaintenanceService.create_request()`, `POST /maintenance` | `tests/modules/maintenance/test_maintenance_api.py` | `docker compose run --rm backend-test pytest tests/modules/maintenance/` |
| BR-01 | contract, room | `contract_service.py`, `RoomService.update_status()` | `ContractService.create_contract()` checks active contract | `tests/modules/contract/test_contract_service.py::test_create_contract_fails_if_room_occupied` | `docker compose run --rm backend-test pytest tests/modules/contract/ -k occupied` |
| BR-07 | billing | `meter_service.py` | `MeterService.record_reading()` validation | `tests/modules/billing/test_meter_service.py::test_validate_current_gte_previous` | `docker compose run --rm backend-test pytest tests/modules/billing/ -k validate` |
| BR-10 | billing | `invoice_service.py` | `InvoiceService.resolve_utility_rate()` cascade logic | `tests/modules/billing/test_invoice_service.py::test_resolve_rate_cascade` | `docker compose run --rm backend-test pytest tests/modules/billing/ -k cascade` |