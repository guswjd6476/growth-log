-- 사용자마다 기록 전체를 한 줄로 저장
create table if not exists public.user_data (
    user_id uuid primary key default auth.uid() references auth.users on delete cascade,
    data jsonb not null,
    updated_at timestamptz not null default now()
);
alter table public.user_data enable row level security;
drop policy if exists "본인 기록만" on public.user_data;
create policy "본인 기록만" on public.user_data for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 기기별 푸시 구독
create table if not exists public.push_subs (
    endpoint text primary key,
    user_id uuid not null default auth.uid() references auth.users on delete cascade,
    sub jsonb not null,
    tz text not null default 'Asia/Seoul',
    created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
drop policy if exists "본인 구독만" on public.push_subs;
create policy "본인 구독만" on public.push_subs for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 저장: 서버 버전이 p_base 그대로일 때만 덮어쓴다. 그 사이 다른 기기가 올렸으면 null → 앱이 받아서 합친 뒤 다시 올린다
create or replace function public.save_data(p_data jsonb, p_base timestamptz)
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare t timestamptz;
begin
    insert into user_data (user_id, data, updated_at) values (auth.uid(), p_data, clock_timestamp())
    on conflict (user_id) do update set data = excluded.data, updated_at = excluded.updated_at
        where user_data.updated_at = p_base
    returning updated_at into t;
    return t;
end;
$$;
