-- Run only after backend configuration and the Vault worker secret are installed.
select cron.schedule('8apdf-background-school-push','* * * * *',$$
 select net.http_post(url:='https://uumqvvsfqwpwtwerdylv.supabase.co/functions/v1/school-push',headers:=jsonb_build_object('Content-Type','application/json','X-Worker-Secret',(select decrypted_secret from vault.decrypted_secrets where name='8apdf_school_push_worker')),body:='{"action":"poll"}'::jsonb,timeout_milliseconds:=90000);
$$);
