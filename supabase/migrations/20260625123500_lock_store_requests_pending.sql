drop policy if exists "users can create own store" on public.stores;

create policy "users can create own store"
on public.stores for insert
to authenticated
with check ((select auth.uid()) = owner_id and approved = false);
