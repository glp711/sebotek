create function private.valid_copy_photos(photos text[]) returns boolean language sql immutable
set search_path=pg_catalog as $$ select cardinality(photos)<=3 and not exists(select from unnest(photos) p where p is null or length(p)>2048 or p !~* '^https://') $$;
grant execute on function private.valid_copy_photos(text[]) to authenticated,anon;
alter table public.books
  add column condition_notes text not null default '' check(length(condition_notes)<=500),
  add column copy_photos text[] not null default '{}' check(private.valid_copy_photos(copy_photos));
grant update(condition_notes,copy_photos) on public.books to authenticated;

create table public.pickups (
  id uuid primary key default gen_random_uuid(),
  reader_id uuid default auth.uid() references public.profiles on delete set null,
  book_id uuid references public.books on delete restrict,
  store_id uuid not null references public.stores,
  title text not null, store_name text not null, condition text not null,
  price numeric not null, notes text not null,
  status text not null default 'RESERVED' check(status in ('RESERVED','CANCELLED','COLLECTED')),
  created_at timestamptz not null default now()
);
create unique index pickups_one_active_per_reader on public.pickups(reader_id,book_id) where status='RESERVED';
create index pickups_store_idx on public.pickups(store_id,created_at desc);
create index pickups_book_idx on public.pickups(book_id);
alter table public.pickups enable row level security;
revoke all on public.pickups from public,anon,authenticated;
grant select, insert(book_id), update(status) on public.pickups to authenticated;
create policy pickup_read on public.pickups for select to authenticated using (
  reader_id=(select auth.uid()) or exists(select from public.stores s where s.id=store_id and s.owner_id=(select auth.uid())));
create policy pickup_create on public.pickups for insert to authenticated with check(reader_id=(select auth.uid()));
create policy pickup_finish on public.pickups for update to authenticated using (
  status='RESERVED' and (reader_id=(select auth.uid()) or exists(select from public.stores s where s.id=store_id and s.owner_id=(select auth.uid()))))
  with check(status in ('CANCELLED','COLLECTED') and (reader_id=(select auth.uid()) or exists(select from public.stores s where s.id=store_id and s.owner_id=(select auth.uid()))));

create function private.stock_for_pickup() returns trigger language plpgsql security definer
set search_path=pg_catalog as $$
declare actor uuid:=auth.uid(); b public.books%rowtype;
begin
  if actor is null then raise exception 'Entre na sua conta.'; end if;
  if tg_op='INSERT' then
    update public.books x set quantity=quantity-1 where x.id=new.book_id and quantity>0
      and exists(select from public.stores s where s.id=x.store_id and s.approved and s.owner_id is distinct from actor)
      returning * into b;
    if not found then raise exception 'Exemplar indisponível para reserva.'; end if;
    new.reader_id:=actor; new.store_id:=b.store_id; new.title:=b.title;
    new.price:=b.price; new.condition:=b.condition; new.notes:=b.condition_notes;
    select name into new.store_name from public.stores where id=b.store_id;
  else
    if old.status<>'RESERVED' or not (
      (new.status='CANCELLED' and old.reader_id is not distinct from actor) or
      (new.status in ('COLLECTED','CANCELLED') and exists(select from public.stores where id=old.store_id and owner_id=actor))
    ) then raise exception 'Alteração de reserva não permitida.'; end if;
    if new.status='CANCELLED' then update public.books set quantity=quantity+1 where id=old.book_id; end if;
    new.book_id:=null; -- retain the snapshot, release the inventory FK
  end if;
  return new;
end $$;
revoke all on function private.stock_for_pickup() from public,anon,authenticated;
create trigger stock_for_pickup before insert or update of status on public.pickups
for each row execute function private.stock_for_pickup();

create function private.reader_demand() returns table(title text, readers bigint)
language sql stable security definer set search_path=pg_catalog as $$
  select min(btrim(w.title)),count(distinct w.user_id) from public.wishlists w
  where exists(select from public.stores where owner_id=auth.uid() and approved)
  group by lower(btrim(w.title)) order by 2 desc,1 limit 20;
$$;
create function public.reader_demand() returns table(title text, readers bigint)
language sql stable security invoker set search_path=pg_catalog as $$ select * from private.reader_demand() $$;
revoke all on function private.reader_demand(),public.reader_demand() from public,anon;
grant execute on function private.reader_demand(),public.reader_demand() to authenticated;
