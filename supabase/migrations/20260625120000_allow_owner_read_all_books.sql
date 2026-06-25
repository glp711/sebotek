drop policy if exists "public can read books from approved stores" on public.books;

create policy "public can read books from approved stores"
on public.books for select
to anon, authenticated
using (
  exists (
    select 1
    from public.stores s
    where s.id = books.store_id
      and (
        s.owner_id = (select auth.uid())
        or (
          s.approved = true
          and books.quantity > 0
        )
      )
  )
);
