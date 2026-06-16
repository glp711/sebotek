set search_path = public, extensions;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;

do $$
begin
  create type public.profile_role as enum ('CUSTOMER', 'STORE_OWNER', 'ADMIN');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.book_condition as enum ('NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Leitor',
  role public.profile_role not null default 'CUSTOMER',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  address text not null,
  city text not null,
  state text not null default 'RJ',
  zip_code text,
  phone text not null,
  opening_hours text,
  photo_url text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stores_owner_id_key unique (owner_id)
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  title text not null,
  author text not null,
  isbn text,
  condition public.book_condition not null default 'GOOD',
  price numeric(10, 2) not null check (price >= 0),
  quantity integer not null default 1 check (quantity >= 0),
  cover_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  constraint reviews_user_store_key unique (user_id, store_id)
);

create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  author text,
  notified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.wishlist_matches (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint wishlist_matches_wishlist_book_key unique (wishlist_id, book_id)
);

create index if not exists stores_approved_city_idx on public.stores (approved, city);
create index if not exists books_store_id_idx on public.books (store_id);
create index if not exists books_title_author_idx on public.books (title, author);
create index if not exists books_search_trgm_idx
  on public.books using gin ((lower(title || ' ' || author || ' ' || coalesce(isbn, ''))) gin_trgm_ops);
create index if not exists wishlists_user_id_idx on public.wishlists (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists stores_set_updated_at on public.stores;
create trigger stores_set_updated_at
before update on public.stores
for each row execute function public.set_updated_at();

drop trigger if exists books_set_updated_at on public.books;
create trigger books_set_updated_at
before update on public.books
for each row execute function public.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'Leitor')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.books enable row level security;
alter table public.reviews enable row level security;
alter table public.wishlists enable row level security;
alter table public.wishlist_matches enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.stores, public.books, public.reviews to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url, updated_at) on public.profiles to authenticated;
grant insert on public.stores, public.books, public.reviews, public.wishlists to authenticated;
grant select, update, delete on public.wishlists to authenticated;
grant select on public.wishlist_matches to authenticated;
grant update (
  name,
  slug,
  description,
  address,
  city,
  state,
  zip_code,
  phone,
  opening_hours,
  photo_url,
  latitude,
  longitude,
  updated_at
) on public.stores to authenticated;
grant update (
  title,
  author,
  isbn,
  condition,
  price,
  quantity,
  cover_url,
  updated_at
) on public.books to authenticated;
grant delete on public.books, public.reviews to authenticated;
grant update (rating, comment) on public.reviews to authenticated;

drop policy if exists "profiles can read own profile" on public.profiles;
create policy "profiles can read own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles can update own profile" on public.profiles;
create policy "profiles can update own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "public can read approved stores" on public.stores;
create policy "public can read approved stores"
on public.stores for select
to anon, authenticated
using (approved = true or (select auth.uid()) = owner_id);

drop policy if exists "users can create own store" on public.stores;
create policy "users can create own store"
on public.stores for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "owners can update own store" on public.stores;
create policy "owners can update own store"
on public.stores for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "public can read books from approved stores" on public.books;
create policy "public can read books from approved stores"
on public.books for select
to anon, authenticated
using (
  quantity > 0
  and exists (
    select 1
    from public.stores s
    where s.id = books.store_id
      and (s.approved = true or s.owner_id = (select auth.uid()))
  )
);

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
  )
)
with check (
  exists (
    select 1
    from public.stores s
    where s.id = books.store_id
      and s.owner_id = (select auth.uid())
  )
);

drop policy if exists "owners can delete own books" on public.books;
create policy "owners can delete own books"
on public.books for delete
to authenticated
using (
  exists (
    select 1
    from public.stores s
    where s.id = books.store_id
      and s.owner_id = (select auth.uid())
  )
);

drop policy if exists "public can read reviews for approved stores" on public.reviews;
create policy "public can read reviews for approved stores"
on public.reviews for select
to anon, authenticated
using (
  exists (
    select 1
    from public.stores s
    where s.id = reviews.store_id
      and s.approved = true
  )
);

drop policy if exists "users can review approved stores" on public.reviews;
create policy "users can review approved stores"
on public.reviews for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.stores s
    where s.id = reviews.store_id
      and s.approved = true
  )
);

drop policy if exists "users can update own reviews" on public.reviews;
create policy "users can update own reviews"
on public.reviews for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "users can delete own reviews" on public.reviews;
create policy "users can delete own reviews"
on public.reviews for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "users manage own wishlists" on public.wishlists;
create policy "users manage own wishlists"
on public.wishlists for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "users read own wishlist matches" on public.wishlist_matches;
create policy "users read own wishlist matches"
on public.wishlist_matches for select
to authenticated
using (
  exists (
    select 1
    from public.wishlists w
    where w.id = wishlist_matches.wishlist_id
      and w.user_id = (select auth.uid())
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('book-covers', 'book-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('store-photos', 'store-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public can read sebotek images" on storage.objects;
create policy "public can read sebotek images"
on storage.objects for select
to public
using (bucket_id in ('book-covers', 'store-photos'));

drop policy if exists "authenticated users can upload sebotek images" on storage.objects;
create policy "authenticated users can upload sebotek images"
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('book-covers', 'store-photos')
  and owner_id = (select auth.uid())::text
);

drop policy if exists "authenticated users can update own sebotek images" on storage.objects;
create policy "authenticated users can update own sebotek images"
on storage.objects for update
to authenticated
using (
  bucket_id in ('book-covers', 'store-photos')
  and owner_id = (select auth.uid())::text
)
with check (
  bucket_id in ('book-covers', 'store-photos')
  and owner_id = (select auth.uid())::text
);

drop policy if exists "authenticated users can delete own sebotek images" on storage.objects;
create policy "authenticated users can delete own sebotek images"
on storage.objects for delete
to authenticated
using (
  bucket_id in ('book-covers', 'store-photos')
  and owner_id = (select auth.uid())::text
);
