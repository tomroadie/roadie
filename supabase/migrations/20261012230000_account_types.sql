-- More kinds of account than artist and venue: labels, promoters, agencies
-- and other businesses can be monitored in Tempo too. Keep in step with
-- src/lib/account-types.ts.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
    where con.conrelid = 'public.profiles'::regclass
      and con.contype = 'c'
      and att.attname = 'account_type'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_account_type_check
  check (account_type in ('artist', 'venue', 'label', 'promoter', 'agency', 'brand', 'other'));
