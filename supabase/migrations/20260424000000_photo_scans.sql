-- ═══════════════════════════════════════════════════════════════
-- photo_scans: server-side state for analyze → enhance handoff.
-- Scanner creates a row, enhance reads it via scan_id.
-- 7-day TTL; cleanup runs daily via pg_cron (if installed).
--
-- photo_enhancements: extra columns for 3-variant grouping and
-- scene-match observability.
-- ═══════════════════════════════════════════════════════════════

-- ─── photo_scans ─────────────────────────────────────────────────
create table public.photo_scans (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    original_storage_key text,
    mime_type text,
    analysis_json jsonb,
    scene_tags jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    expires_at timestamp with time zone
        default (timezone('utc'::text, now()) + interval '7 days') not null
);

create index photo_scans_user_id_idx on public.photo_scans(user_id);
create index photo_scans_expires_at_idx on public.photo_scans(expires_at);

alter table public.photo_scans enable row level security;

create policy "Users can view their own scans"
    on public.photo_scans for select
    using (auth.uid() = user_id);

create policy "Service role can manage scans"
    on public.photo_scans for all
    using (auth.role() = 'service_role');

grant all on public.photo_scans to service_role;

-- ─── photo_enhancements additions ─────────────────────────────────
-- Base table already exists with: id, user_id, storage_key, mime_type,
-- is_free_trial, downloaded, created_at, expires_at, original_storage_key.
alter table public.photo_enhancements
    add column if not exists scan_id uuid references public.photo_scans(id) on delete set null,
    add column if not exists group_id uuid,
    add column if not exists variant_index integer,
    add column if not exists mode text,
    add column if not exists engine text,
    add column if not exists matched_scene_id text,
    add column if not exists match_relaxation_level integer,
    add column if not exists match_score integer;

create index if not exists photo_enhancements_scan_id_idx on public.photo_enhancements(scan_id);
create index if not exists photo_enhancements_group_id_idx on public.photo_enhancements(group_id);
create index if not exists photo_enhancements_matched_scene_idx
    on public.photo_enhancements(matched_scene_id)
    where matched_scene_id is not null;

-- ─── Scheduled cleanup ────────────────────────────────────────────
-- Safe to run whether or not pg_cron is installed. If pg_cron is
-- missing, we raise a notice and skip. Enable pg_cron in Supabase
-- Dashboard (Database → Extensions → pg_cron) then re-run this block.
--
-- This only deletes DB rows. Orphaned storage objects are handled by
-- a separate reconciliation job.
do $outer$
begin
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
        perform cron.schedule(
            'cleanup-expired-photo-scans',
            '0 3 * * *',
            'delete from public.photo_scans where expires_at < timezone(''utc''::text, now())'
        );
        raise notice 'pg_cron job scheduled: cleanup-expired-photo-scans @ 03:00 UTC daily';
    else
        raise notice 'pg_cron not installed — scheduled cleanup skipped. Enable pg_cron in Supabase Dashboard then re-run this migration.';
    end if;
end
$outer$;
