-- =============================================================================
-- scripts/init-prod-db.sql — Production Database Initialization
-- Property Management System Backend
--
-- Runs on first container start via docker-entrypoint-initdb.d/
-- :pgha8a9a8a9p
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set timezone
ALTER DATABASE pms_prod SET timezone TO 'Asia/Bangkok';

-- Create schema (public is default, but explicit for clarity)
CREATE SCHEMA IF NOT EXISTS public;
GRANT ALL ON SCHEMA public TO user;

-- Optimize PostgreSQL for asyncpg + PMS workload
ALTER SYSTEM SET max_connections = '200';
ALTER SYSTEM SET shared_buffers = '512MB';
ALTER SYSTEM SET effective_cache_size = '2GB';
ALTER SYSTEM SET work_mem = '8MB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';
ALTER SYSTEM SET random_page_cost = '1.1';  -- SSD-optimized
ALTER SYSTEM SET effective_io_concurrency = '200';  -- SSD with parallel IO

-- Enable pg_stat_statements for query monitoring
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";