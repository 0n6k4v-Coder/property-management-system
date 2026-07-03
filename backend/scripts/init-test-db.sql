-- =============================================================================
-- File: backend/scripts/init-test-db.sql
-- Purpose: Initialize PostgreSQL test database with MVP schema + optimizations
-- 2026 Best Practices: Template-based test isolation, pg_trgm for ILIKE, least-privilege roles
-- =============================================================================

-- =============================================================================
-- Phase 1: Extensions (load before any table creation)
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "pg_trgm" SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;

-- =============================================================================
-- Phase 2: Enum Types (create before tables that reference them)
-- =============================================================================
DO $$ BEGIN
    CREATE TYPE room_status_enum AS ENUM ('available', 'occupied', 'maintenance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE room_type_enum AS ENUM ('studio', 'single', 'double', 'suite');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE invoice_status_enum AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_method_enum AS ENUM ('cash', 'bank_transfer', 'qr_code', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE contract_status_enum AS ENUM ('active', 'terminated', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE utility_scope_type_enum AS ENUM ('property', 'building', 'floor', 'room');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- Phase 3-5: MIGRATION-OWNED SCHEMA
--
-- Note: table DDL is intentionally removed here because docker-compose's test
-- stack upgrades schema via `alembic upgrade head`. Leaving both init.sql and
-- Alembic to create tables caused `DuplicateTableError` on fresh DBs.
-- This file now only prepares extensions/enums and optional test-data anchors.
-- =============================================================================

-- =============================================================================
-- Phase 6: Performance settings for test environment
-- =============================================================================
SET work_mem = '64MB';
SET maintenance_work_mem = '256MB';
SET temp_buffers = '32MB';
