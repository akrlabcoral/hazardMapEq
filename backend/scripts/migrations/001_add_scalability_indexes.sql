-- Migration 001: Scalability Indexes
-- Resolves N+1 and Full Table Scan bottlenecks identified during Phase 4 Audit

-- 1. Index for the recovery poller (get_unsimulated_events)
-- Prevents full table scans when checking for missed simulations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_unsimulated 
ON earthquake_events(sim_triggered, ingested_at);

-- 2. Index for the daily cleanup worker (cleanup_old_data)
-- Prevents full table scans when deleting old events
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_ingested_at 
ON earthquake_events(ingested_at);

-- 3. Index for dedup cache cleanup (cleanup_old_data)
-- Prevents full table scans when pruning the deduplicator table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dedup_seen_at 
ON dedup_cache(seen_at);
