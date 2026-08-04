// File: src/types/api.d.ts
// API type definitions matching Backend v1.0.0 modules.
// Run `npx openapi-typescript http://localhost:8000/openapi.json -o src/types/api.d.ts` to auto-generate.

declare namespace API {
  // ── Common ───────────────────────────────────────────────

  interface SuccessResponse<T> {
    data: T;
  }

  interface ErrorResponse {
    error: {
      code: string;
      message: string;
      details?: Record<string, string>;
    };
  }

  type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

  interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    has_next: boolean;
  }

  interface PaginatedResponse<T> {
    data: T[];
    meta: PaginationMeta;
  }

  // ── Auth ─────────────────────────────────────────────────

  interface LoginRequest {
    email: string;
    password: string;
  }

  interface RegisterRequest {
    invite_token: string;
    full_name: string;
    password: string;
    phone: string;
  }

  interface UserResponse {
    id: string;
    email: string;
    full_name: string;
    property_scopes: string[];
    is_active: boolean;
  }

  interface TokenData {
    access_token: string;
    refresh_token: string;
    user: UserResponse;
  }

  interface RefreshData {
    access_token: string;
  }

  // ── Property ─────────────────────────────────────────────

  interface PropertyRequest {
    name: string;
    address: string;
    billing_due_day: number;
    min_deposit_months: number;
  }

  interface PropertyResponse {
    id: string;
    name: string;
    address: string;
    billing_due_day: number;
    min_deposit_months: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  }

  interface RoomResponse {
    id: string;
    property_id: string;
    building_id: string;
    floor_id: string | null;
    room_number: string;
    room_type: string;
    base_rent: number;
    status: string;
    images: Record<string, unknown> | null;
  }

  interface PropertyWithRoomsResponse {
    property: PropertyResponse;
    rooms: RoomResponse[];
  }

  // ── Tenant ───────────────────────────────────────────────

  interface TenantRequest {
    property_id: string;
    full_name: string;
    id_card_number: string;
    phone: string;
    email?: string | null;
    emergency_contact_name?: string | null;
    emergency_contact_phone?: string | null;
  }

  interface TenantResponse {
    id: string;
    property_id: string;
    full_name: string;
    phone: string;
    email: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    created_at: string;
  }

  // ── Contract ─────────────────────────────────────────────

  interface ContractRequest {
    room_id: string;
    tenant_id: string;
    property_id: string;
    start_date: string;
    end_date: string;
    monthly_rent: number;
    deposit_amount: number;
    special_conditions?: string | null;
  }

  interface TerminateContractRequest {
    reason: string;
    termination_date?: string | null;
    notes?: string | null;
  }

  interface ContractResponse {
    id: string;
    room_id: string;
    tenant_id: string;
    property_id: string;
    start_date: string;
    end_date: string;
    monthly_rent: number;
    deposit_amount: number;
    status: string;
    special_conditions: string | null;
    is_renewal: boolean;
    renewed_from_id: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    termination: ContractTerminationResponse | null;
    extensions: LeaseExtensionResponse[];
  }

  interface ContractTerminationResponse {
    id: string;
    reason: string;
    termination_date: string;
    notes: string | null;
    terminated_by: string | null;
    created_at: string;
  }

  interface LeaseExtensionResponse {
    id: string;
    previous_end_date: string;
    extended_to: string;
    reason: string | null;
    extended_by: string | null;
    created_at: string;
  }

  interface LeaseHistoryItem {
    id: string;
    tenant_id: string;
    start_date: string;
    end_date: string;
    monthly_rent: number;
    status: string;
    is_renewal: boolean;
    created_at: string;
    termination_reason: string | null;
    termination_date: string | null;
  }

  // ── Meter Reading ──────────────────────────────────────

  interface MeterReadingRequest {
    room_id: string;
    billing_month: number;
    billing_year: number;
    electric_previous: number;
    electric_current: number;
    water_previous: number;
    water_current: number;
  }

  interface MeterReadingResponse {
    id: string;
    room_id: string;
    billing_month: number;
    billing_year: number;
    electric_previous: number;
    electric_current: number;
    electric_used: number;
    water_previous: number;
    water_current: number;
    water_used: number;
    read_date: string;
  }

  /** Queue item stored in IndexedDB for offline meter readings */
  interface MeterReadingQueueItem {
    id?: number;
    payload: MeterReadingRequest;
    createdAt: string;
    status: 'pending' | 'syncing' | 'failed';
    error?: string;
  }

  // ── Invoice & Payment ───────────────────────────────────

  interface GenerateInvoiceRequest {
    property_id: string;
    billing_month: number;
    billing_year: number;
  }

  interface InvoiceResponse {
    id: string;
    invoice_number: string;
    contract_id: string;
    room_id: string;
    tenant_id: string;
    property_id: string;
    billing_month: number;
    billing_year: number;
    due_date: string;
    status: string;
    total_amount: number;
    paid_amount: number;
    notes: string | null;
    created_at: string | null;
  }

  interface InvoiceLineItemResponse {
    id: string;
    invoice_id: string;
    line_type: string;
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }

  interface InvoiceDetailResponse {
    invoice: InvoiceResponse;
    line_items: InvoiceLineItemResponse[];
  }

  interface PaymentRequest {
    invoice_id: string;
    amount: number;
    method: string;
    reference_number?: string | null;
    slip_image_url?: string | null;
    notes?: string | null;
  }

  interface PaymentResponse {
    id: string;
    invoice_id: string;
    amount: number;
    payment_date: string;
    method: string;
    reference_number: string | null;
    slip_image_url: string | null;
    notes: string | null;
  }

  // ── Maintenance ─────────────────────────────────────────

  interface CreateMaintenanceRequest {
    room_id: string;
    property_id: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
  }

  interface UpdateMaintenanceStatusRequest {
    status: 'pending' | 'in_progress' | 'resolved' | 'cancelled';
  }

  interface AssignMaintenanceRequest {
    assigned_to: string;
  }

  interface MaintenanceResponse {
    id: string;
    property_id: string;
    room_id: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    status: 'pending' | 'in_progress' | 'resolved' | 'cancelled';
    assigned_to: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  }

  // ── Admin ───────────────────────────────────────────────

  interface AuditLogResponse {
    id: string;
    user_id: string | null;
    action: string;
    resource_type: string;
    resource_id: string | null;
    property_id: string | null;
    metadata: Record<string, unknown> | null;
    ip_address: string | null;
    timestamp: string;
  }

  interface AuditLogListResponse {
    data: AuditLogResponse[];
    meta: Record<string, unknown> | null;
  }

  interface SystemConfigResponse {
    key: string;
    value: string;
    masked: boolean;
  }

  interface SystemConfigListResponse {
    data: SystemConfigResponse[];
  }

  interface UpdateSystemConfigRequest {
    value: string;
  }

  // ── Maintenance List Response ─────────────────────────────────

  interface MaintenanceListResponse {
    data: MaintenanceResponse[];
    meta: Record<string, unknown> | null;
  }

  // ── Contract List Response ────────────────────────────────────

  interface ContractListResponse {
    data: ContractResponse[];
    meta: Record<string, unknown> | null;
  }

  // ── Dashboard & Reports ─────────────────────────────────

  interface DashboardSummaryResponse {
    total_rooms: number;
    occupied_rooms: number;
    occupancy_rate: number;
    active_contracts: number;
    total_revenue: number;
    overdue_count: number;
    overdue_amount: number;
    pending_maintenance: number;
    overdue_invoices: number;
  }

  interface RevenueMetricResponse {
    period: string;
    collected: number;
    outstanding: number;
    total_billed: number;
  }

  interface OccupancyResponse {
    property_id: string;
    total_rooms: number;
    occupied_rooms: number;
    occupancy_rate: number;
    active_contracts: number;
  }
}

export type { API };