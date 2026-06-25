create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'ADMIN'
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

grant update (approved, updated_at) on public.stores to authenticated;

drop policy if exists "profiles can read own profile" on public.profiles;
create policy "profiles can read own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id or (select private.is_admin()));

drop policy if exists "public can read approved stores" on public.stores;
create policy "public can read approved stores"
on public.stores for select
to anon, authenticated
using (
  approved = true
  or (select auth.uid()) = owner_id
  or (select private.is_admin())
);

drop policy if exists "owners can update own store" on public.stores;
create policy "owners can update own store"
on public.stores for update
to authenticated
using ((select auth.uid()) = owner_id and approved = false)
with check ((select auth.uid()) = owner_id and approved = false);

drop policy if exists "admins can review stores" on public.stores;
create policy "admins can review stores"
on public.stores for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "owners can insert books into own store" on public.books;
create policy "owners can insert books into own store"
on public.books for insert
to authenticated
with check (
  exists (
    select 1
    from public.stores s
    where s.id = books.store_id
      and s.owner_id = (select auth.uid())
      and s.approved = true
  )
);

drop policy if exists "owners can update own books" on public.books;
create policy "owners can update own books"
on public.books for update
to authenticated
using (
  exists (
    select 1
    from public.stores s
    where s.id = books.store_id
      and s.owner_id = (select auth.uid())
      and s.approved = true
  )
)
with check (
  exists (
    select 1
    from public.stores s
    where s.id = books.store_id
      and s.owner_id = (select auth.uid())
      and s.approved = true
  )
);
