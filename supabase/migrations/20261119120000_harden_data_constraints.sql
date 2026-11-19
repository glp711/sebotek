-- Reforço de integridade e segurança dos dados.
--
-- 1. Limites e formatos validados no próprio banco (a interface também valida,
--    mas o banco é a proteção definitiva, inclusive contra chamadas diretas à API).
-- 2. Uploads no Storage restritos à pasta do próprio usuário.
-- 3. O responsável por um sebo não pode avaliar o próprio sebo.
--
-- As restrições usam NOT VALID: valem para todo INSERT/UPDATE novo, mas não
-- bloqueiam a migration caso algum registro antigo esteja fora do padrão.
-- Depois de conferir os dados antigos, é possível rodar
--   alter table ... validate constraint ...;
-- para validar também o histórico.

-- ---------------------------------------------------------------------------
-- Livros
-- ---------------------------------------------------------------------------
alter table public.books
  drop constraint if exists books_title_length,
  drop constraint if exists books_author_length,
  drop constraint if exists books_text_lengths,
  drop constraint if exists books_isbn_format,
  drop constraint if exists books_published_year_range,
  drop constraint if exists books_price_max,
  drop constraint if exists books_quantity_max,
  drop constraint if exists books_cover_url_format;

alter table public.books
  add constraint books_title_length
    check (char_length(btrim(title)) between 1 and 300) not valid,
  add constraint books_author_length
    check (char_length(btrim(author)) between 1 and 200) not valid,
  add constraint books_text_lengths
    check (
      coalesce(char_length(category), 0) <= 80
      and coalesce(char_length(publisher), 0) <= 200
      and coalesce(char_length(summary), 0) <= 5000
    ) not valid,
  add constraint books_isbn_format
    check (
      isbn is null
      or char_length(regexp_replace(isbn, '[^0-9Xx]', '', 'g')) in (10, 13)
    ) not valid,
  add constraint books_published_year_range
    check (published_year is null or published_year between 1400 and 2100) not valid,
  add constraint books_price_max
    check (price <= 100000) not valid,
  add constraint books_quantity_max
    check (quantity <= 10000) not valid,
  add constraint books_cover_url_format
    check (
      cover_url is null
      or (char_length(cover_url) <= 2048 and cover_url ~* '^https?://')
    ) not valid;

-- ---------------------------------------------------------------------------
-- Sebos
-- ---------------------------------------------------------------------------
-- Atenção: uma restrição NOT VALID também é conferida quando uma linha antiga é
-- atualizada (por exemplo, na aprovação pelo admin). Por isso a UF é
-- normalizada antes. Para listar outros registros antigos fora do padrão:
--   select id, name, state, phone, zip_code from public.stores
--   where state !~ '^[A-Z]{2}$'
--      or char_length(regexp_replace(phone, '\D', '', 'g')) not between 10 and 13
--      or (zip_code is not null and char_length(regexp_replace(zip_code, '\D', '', 'g')) <> 8);
update public.stores
set state = upper(btrim(state))
where state is distinct from upper(btrim(state));

alter table public.stores
  drop constraint if exists stores_name_length,
  drop constraint if exists stores_slug_format,
  drop constraint if exists stores_text_lengths,
  drop constraint if exists stores_state_format,
  drop constraint if exists stores_zip_code_format,
  drop constraint if exists stores_phone_format;

alter table public.stores
  add constraint stores_name_length
    check (char_length(btrim(name)) between 2 and 120) not valid,
  add constraint stores_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 90) not valid,
  add constraint stores_text_lengths
    check (
      coalesce(char_length(description), 0) <= 2000
      and char_length(address) <= 300
      and char_length(city) <= 120
      and coalesce(char_length(opening_hours), 0) <= 200
      and coalesce(char_length(photo_url), 0) <= 2048
    ) not valid,
  add constraint stores_state_format
    check (state ~ '^[A-Z]{2}$') not valid,
  add constraint stores_zip_code_format
    check (
      zip_code is null
      or char_length(regexp_replace(zip_code, '\D', '', 'g')) = 8
    ) not valid,
  add constraint stores_phone_format
    check (char_length(regexp_replace(phone, '\D', '', 'g')) between 10 and 13) not valid;

-- ---------------------------------------------------------------------------
-- Perfis, desejos e avaliações
-- ---------------------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_display_name_length;
alter table public.profiles
  add constraint profiles_display_name_length
    check (char_length(btrim(display_name)) between 1 and 80) not valid;

alter table public.wishlists
  drop constraint if exists wishlists_text_lengths;
alter table public.wishlists
  add constraint wishlists_text_lengths
    check (
      char_length(btrim(title)) between 1 and 300
      and coalesce(char_length(author), 0) <= 200
    ) not valid;

alter table public.reviews
  drop constraint if exists reviews_comment_length;
alter table public.reviews
  add constraint reviews_comment_length
    check (coalesce(char_length(comment), 0) <= 1000) not valid;

-- O responsável não pode avaliar o próprio sebo.
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
      and s.owner_id is distinct from (select auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- Storage: cada usuário só grava dentro da pasta com o próprio id.
-- Caminho esperado do arquivo: <bucket>/<auth.uid()>/<nome-do-arquivo>
-- ---------------------------------------------------------------------------
drop policy if exists "authenticated users can upload sebotek images" on storage.objects;
create policy "authenticated users can upload sebotek images"
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('book-covers', 'store-photos')
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
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
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
