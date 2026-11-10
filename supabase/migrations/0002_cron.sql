-- 1분마다 remind 함수를 부른다. 비밀값은 Vault 의 cron_secret (supabase/seed.sql 로 넣음, git 에는 안 올림)
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('remind') where exists (select 1 from cron.job where jobname = 'remind');
select cron.schedule('remind', '* * * * *', $$
    select net.http_post(
        url := 'https://zgqmzucqboluhyhcdevr.supabase.co/functions/v1/remind',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
        )
    )
$$);
