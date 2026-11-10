-- 공부 메이트: 각자 오늘 요약(공부 시간·연속일·할 일 수, 켜면 오늘 할 일 목록)만 올리고, 메이트끼리만 서로 본다
create table if not exists public.mate_profiles (
    user_id uuid primary key default auth.uid() references auth.users on delete cascade,
    code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
    summary jsonb not null default '{}',
    updated_at timestamptz not null default now()
);
-- 양방향으로 두 줄 저장 (나→너, 너→나)
create table if not exists public.mates (
    user_id uuid not null references auth.users on delete cascade,
    mate_id uuid not null references auth.users on delete cascade,
    primary key (user_id, mate_id)
);
alter table public.mate_profiles enable row level security;
alter table public.mates enable row level security;

drop policy if exists "나와 메이트만 보기" on public.mate_profiles;
create policy "나와 메이트만 보기" on public.mate_profiles for select
    using (user_id = auth.uid() or exists (select 1 from public.mates m where m.user_id = auth.uid() and m.mate_id = mate_profiles.user_id));
drop policy if exists "본인 요약만 올리기" on public.mate_profiles;
create policy "본인 요약만 올리기" on public.mate_profiles for insert with check (user_id = auth.uid());
drop policy if exists "본인 요약만 고치기" on public.mate_profiles;
create policy "본인 요약만 고치기" on public.mate_profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "내 메이트 목록" on public.mates;
create policy "내 메이트 목록" on public.mates for select using (user_id = auth.uid());
-- 맺기·끊기는 아래 함수로만 (양쪽 줄을 같이 다루려고)

create or replace function public.add_mate(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare other uuid;
begin
    if auth.uid() is null then return false; end if;
    select user_id into other from mate_profiles where code = upper(trim(p_code));
    if other is null or other = auth.uid() then return false; end if;
    insert into mates values (auth.uid(), other), (other, auth.uid()) on conflict do nothing;
    return true;
end;
$$;

create or replace function public.remove_mate(p_mate uuid)
returns void
language sql
security definer
set search_path = public
as $$
    delete from mates where (user_id = auth.uid() and mate_id = p_mate) or (user_id = p_mate and mate_id = auth.uid());
$$;

revoke execute on function public.add_mate(text) from public, anon;
revoke execute on function public.remove_mate(uuid) from public, anon;
grant execute on function public.add_mate(text) to authenticated;
grant execute on function public.remove_mate(uuid) to authenticated;
