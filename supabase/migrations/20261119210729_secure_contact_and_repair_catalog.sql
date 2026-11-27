-- The legacy Prisma tables are optional on fresh installations. The old
-- catalog fallback only needs approved stores and their available books.
do $$
declare t text;
begin
  foreach t in array array['User','Store','Book','Review','Wishlist','WishlistMatch'] loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from public, anon, authenticated', t);
    end if;
  end loop;
  if to_regclass('public."Store"') is not null then
    grant select on public."Store" to anon, authenticated;
    create policy legacy_public_stores on public."Store" for select to anon, authenticated using (approved);
  end if;
  if to_regclass('public."Book"') is not null then
    grant select on public."Book" to anon, authenticated;
    create policy legacy_public_books on public."Book" for select to anon, authenticated
      using (quantity > 0 and exists (select from public."Store" s where s.id = "storeId" and s.approved));
  end if;
end $$;

alter function public.set_updated_at() set search_path = pg_catalog;

-- Remove broad Supabase defaults before granting only the API fields used.
revoke all on public.contact_messages, public.donations from public, anon, authenticated;
grant insert (name,email,topic,message) on public.contact_messages to anon, authenticated;
grant select, update (resolved) on public.contact_messages to authenticated;
grant select, insert (store_id,donor_name,contact_phone,books_description,estimated_quantity,
  delivery_method,pickup_area,message), update (status,store_response) on public.donations to authenticated;
create index contact_messages_created_idx on public.contact_messages(created_at);
create index contact_messages_user_idx on public.contact_messages(user_id);

-- Serialize this small site's contact intake; count all senders even though
-- visitors cannot read messages. The global ceiling also bounds rotating emails.
create function private.limit_contact_intake() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
declare total int; sender int;
begin
  perform pg_advisory_xact_lock(736028, 1);
  select count(*), count(*) filter (where lower(btrim(email)) = lower(btrim(new.email))
      or user_id = new.user_id) into total, sender
    from public.contact_messages where created_at > statement_timestamp() - interval '10 minutes';
  if sender >= 3 or total >= 30 then
    raise exception using errcode = 'PT429', message = 'Limite de mensagens atingido. Tente novamente em 10 minutos.';
  end if;
  return new;
end $$;
revoke all on function private.limit_contact_intake() from public, anon, authenticated;
create trigger limit_contact_intake before insert on public.contact_messages
for each row execute function private.limit_contact_intake();

alter table public.books drop constraint books_cover_url_format;
alter table public.books add constraint books_cover_url_format check (
  cover_url is null or (length(cover_url) <= 2048 and
    (cover_url ~* '^https?://' or cover_url ~ '^/covers/[a-z0-9-]+\.png$')));
-- Keep the original malformed identifiers for manual edition lookup.
create table private.legacy_book_isbns as select id, isbn from public.books
  where length(regexp_replace(isbn,'[^0-9Xx]','','g')) not in (10,13);
revoke all on private.legacy_book_isbns from public, anon, authenticated;
update public.books b set isbn = null from private.legacy_book_isbns a where b.id=a.id;
alter table public.books validate constraint books_isbn_format;

-- A demo store has no real phone. Keep unknown distinct from a real number
-- while continuing to require a phone on new stores and protecting existing ones.
alter table public.stores alter column phone drop not null;
update public.stores set phone=null, zip_code=null
  where name='Divisão 2' and phone='999999999' and zip_code='999999999';
create function private.require_store_phone() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin
  if new.phone is null and (tg_op = 'INSERT' or old.phone is not null) then
    raise exception using errcode='23502', message='Informe o telefone do sebo.';
  end if;
  return new;
end $$;
create trigger require_store_phone before insert or update of phone on public.stores
for each row execute function private.require_store_phone();
alter table public.stores validate constraint stores_phone_format;
alter table public.stores validate constraint stores_zip_code_format;
