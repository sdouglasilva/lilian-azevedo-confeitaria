-- Gate 2: additive scheduler setup. Keep the historical schema migration intact.
-- Extension installation: https://supabase.com/docs/guides/cron/install
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;

-- A stable name makes cron.schedule upsert the same job when reapplied by the
-- migration role. Do not insert into cron.job or create unnamed schedules.
-- https://supabase.com/docs/guides/cron/quickstart
select cron.schedule(
  'la-process-pending-orders',
  '*/10 * * * *',
  $job$
  do $run$
  declare
    v_app_public_url text;
    v_cron_secret text;
  begin
    -- Resolve Vault values at execution time, never while building job.command.
    -- This also allows URL/secret rotation without recreating the job.
    select nullif(btrim(decrypted_secret), '') into v_app_public_url
      from vault.decrypted_secrets where name = 'app_public_url';
    select decrypted_secret into v_cron_secret
      from vault.decrypted_secrets where name = 'cron_secret';

    -- Match the minimum secret length required by private.require_server.
    -- Fail without printing credentials or making an unauthenticated request.
    if v_app_public_url is null or v_cron_secret is null or length(v_cron_secret) < 32 then
      raise exception 'LA_CRON_VAULT_CONFIGURATION_MISSING';
    end if;

    perform net.http_post(
      url := rtrim(v_app_public_url, '/') || '/api/internal/process-pending-orders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_cron_secret
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  end;
  $run$;
  $job$
);
