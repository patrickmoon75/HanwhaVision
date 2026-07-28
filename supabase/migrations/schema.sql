-- 1. Create pending_orders table with composite unique constraint
CREATE TABLE IF NOT EXISTS public.pending_orders (
    id BIGSERIAL PRIMARY KEY,
    warehouse_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    release_num TEXT,
    item_id TEXT NOT NULL,
    pieces_to_pick INTEGER NOT NULL DEFAULT 0,
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT pending_orders_order_item_unique UNIQUE (order_id, item_id)
);

-- Enable indexes for faster query filtering on dashboard
CREATE INDEX IF NOT EXISTS idx_pending_orders_collected_at ON public.pending_orders (collected_at);

-- 2. Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3. PostgreSQL function to update/create pg_cron schedule
CREATE OR REPLACE FUNCTION public.update_wms_cron_schedule(
    cron_expr TEXT,
    project_ref TEXT,
    service_role_key TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    job_id BIGINT;
    func_url TEXT;
    headers JSONB;
    cron_command TEXT;
BEGIN
    -- Validate cron expression
    IF cron_expr IS NULL OR length(cron_expr) < 9 THEN
        RAISE EXCEPTION 'Invalid cron expression format. Please provide a valid 5-field cron string.';
    END IF;

    IF project_ref IS NULL OR service_role_key IS NULL THEN
        RAISE EXCEPTION 'Both project_ref and service_role_key are required to set up the scheduler.';
    END IF;

    -- URL of the Edge Function
    func_url := 'https://' || project_ref || '.supabase.co/functions/v1/fetch-wms-orders';
    
    -- HTTP Headers containing the service role key for authentication
    headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
    );

    -- Prepare the pg_net POST command
    cron_command := format(
        'SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb, timeout_milliseconds := 60000)',
        func_url,
        headers::text,
        '{}'::text
    );

    -- Unschedule any existing job with this name to avoid duplicates
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'wms-fetch-job';

    -- Schedule the new job
    SELECT cron.schedule('wms-fetch-job', cron_expr, cron_command) INTO job_id;

    RETURN 'Job successfully updated. Job ID: ' || job_id::text;
EXCEPTION
    WHEN OTHERS THEN
        RETURN 'Error updating schedule: ' || SQLERRM;
END;
$$;

-- 4. PostgreSQL function to retrieve the active pg_cron schedule
CREATE OR REPLACE FUNCTION public.get_wms_cron_schedule()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    sched TEXT;
BEGIN
    SELECT schedule INTO sched FROM cron.job WHERE jobname = 'wms-fetch-job' LIMIT 1;
    RETURN sched;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;
