-- ═══════════════════════════════════════════════════════════════
-- refund_credits RPC — atomic mirror of deduct_credits.
-- Used by enhance-photo when any post-deduction step fails.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.refund_credits(
    p_user_id uuid,
    p_amount integer,
    p_description text default 'credit_refund',
    p_metadata jsonb default '{}'::jsonb
)
returns table (
    success boolean,
    remaining integer,
    customer_id uuid
)
language plpgsql
security definer
as $$
declare
    v_customer_id uuid;
    v_new_balance integer;
begin
    if p_amount <= 0 then
        return query select false, 0, null::uuid;
        return;
    end if;

    -- Atomic increment + return new balance
    update public.customers
    set credits = credits + p_amount,
        updated_at = timezone('utc'::text, now())
    where user_id = p_user_id
    returning id, credits into v_customer_id, v_new_balance;

    if v_customer_id is null then
        return query select false, 0, null::uuid;
        return;
    end if;

    -- Ledger entry in the same transaction
    insert into public.credits_history (
        customer_id, amount, type, description, metadata, created_at
    ) values (
        v_customer_id,
        p_amount,
        'add',
        p_description,
        p_metadata || jsonb_build_object('source', 'system_refund'),
        timezone('utc'::text, now())
    );

    return query select true, v_new_balance, v_customer_id;
end;
$$;

grant execute on function public.refund_credits(uuid, integer, text, jsonb) to service_role;
