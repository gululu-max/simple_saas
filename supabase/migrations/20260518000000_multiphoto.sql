-- ═══════════════════════════════════════════════════════════════
-- Multi-photo post-pay pipeline
--
-- 改动：
-- 1. original_storage_keys text[] — 用户上传的 1-3 张原图 storage key
--    (老的 original_storage_key 保留含义改成"VLM 选中的主图 key"，
--     loadScanById 直接读它就行)
-- 2. chosen_main_index — VLM rerank 选中的主图在 keys 数组里的位置
-- 3. vlm_rerank_at — VLM rerank 完成时间（rerank 失败时为 null，
--    会退到 pre-pay scene_tags + index 0）
-- 4. enhance_failed_at / enhance_attempts — 失败重试用，
--    /scan-result/[id]/retry 清掉 failed_at 让下一轮重新触发
-- ═══════════════════════════════════════════════════════════════

alter table public.photo_scans
    add column if not exists original_storage_keys text[],
    add column if not exists chosen_main_index integer,
    add column if not exists vlm_rerank_at timestamptz,
    add column if not exists enhance_failed_at timestamptz,
    add column if not exists enhance_attempts integer default 0 not null;
