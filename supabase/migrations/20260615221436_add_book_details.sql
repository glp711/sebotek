alter table public.books
  add column if not exists category text,
  add column if not exists summary text,
  add column if not exists publisher text,
  add column if not exists published_year integer;

create index if not exists books_category_idx on public.books (category);

drop index if exists public.books_search_trgm_idx;
create index if not exists books_search_trgm_idx
  on public.books using gin (
    (lower(
      title || ' ' ||
      author || ' ' ||
      coalesce(isbn, '') || ' ' ||
      coalesce(category, '') || ' ' ||
      coalesce(publisher, '')
    )) gin_trgm_ops
  );

grant update (
  category,
  summary,
  publisher,
  published_year,
  updated_at
) on public.books to authenticated;
