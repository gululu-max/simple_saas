-- ═══════════════════════════════════════════════════════════════
-- Paywall / no-login pivot — 一次性买卖（$4.99 promo / $12.99 regular）
--
-- 改造点：
-- 1. photo_scans / photo_enhancements 松开 user_id NOT NULL
--    （访客流程下 user_id 为 NULL）
-- 2. photo_scans 加付费状态字段：paid / paid_at / creem_order_id /
--    customer_email / ga_client_id
-- 3. enhance_started_at：付费回跳后触发 enhance 时的并发锁字段
-- 4. creem_order_id 加 unique partial index → webhook 天然幂等
--
-- 退款不管（交给 Creem dashboard），所以不加 refunded 字段。
-- 现有 7 天 expires_at TTL 保留不动。
-- ═══════════════════════════════════════════════════════════════

alter table public.photo_scans
    alter column user_id drop not null,
    add column if not exists paid boolean default false not null,
    add column if not exists paid_at timestamptz,
    add column if not exists creem_order_id text,
    add column if not exists customer_email text,
    add column if not exists ga_client_id text,
    add column if not exists enhance_started_at timestamptz;

create unique index if not exists photo_scans_creem_order_idx
    on public.photo_scans(creem_order_id)
    where creem_order_id is not null;

create index if not exists photo_scans_paid_idx
    on public.photo_scans(paid)
    where paid = true;

alter table public.photo_enhancements
    alter column user_id drop not null;
