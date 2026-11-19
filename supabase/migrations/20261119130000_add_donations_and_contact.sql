-- Doação de livros para sebos e mensagens de contato com a plataforma.
--
-- Doações
--   O leitor oferece livros para um sebo aprovado. O responsável pelo sebo
--   aceita ou recusa e, depois, marca a doação como recebida.
--   Fluxo de status (validado por trigger, não apenas pela interface):
--     PENDING  -> ACCEPTED | DECLINED   (sebo)
--     PENDING  -> CANCELLED             (doador)
--     ACCEPTED -> RECEIVED | DECLINED   (sebo)
--
-- Contato
--   Qualquer visitante, com ou sem conta, envia uma mensagem. Somente
--   administradores leem e marcam como resolvida.

do $$
begin
  create type public.donation_status as enum (
    'PENDING', 'ACCEPTED', 'DECLINED', 'RECEIVED', 'CANCELLED'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.donation_delivery as enum ('DROP_OFF', 'PICKUP');
exception
  when duplicate_object then null;
end
$$;

-- ---------------------------------------------------------------------------
-- Tabela de doações
-- ---------------------------------------------------------------------------
create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  -- Nome e telefone ficam salvos na doação porque o sebo não tem acesso
  -- ao perfil do doador (RLS de profiles).
  donor_name text not null,
  contact_phone text not null,
  books_description text not null,
  estimated_quantity integer not null default 1,
  delivery_method public.donation_delivery not null default 'DROP_OFF',
  pickup_area text,
  message text,
  status public.donation_status not null default 'PENDING',
  store_response text,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint donations_donor_name_length
    check (char_length(btrim(donor_name)) between 2 and 120),
  constraint donations_phone_format
    check (char_length(regexp_replace(contact_phone, '\D', '', 'g')) between 10 and 13),
  constraint donations_books_length
    check (char_length(btrim(books_description)) between 3 and 2000),
  constraint donations_quantity_range
    check (estimated_quantity between 1 and 500),
  constraint donations_pickup_area
    check (
      (delivery_method = 'DROP_OFF' and pickup_area is null)
      or (delivery_method = 'PICKUP' and char_length(btrim(pickup_area)) between 3 and 200)
    ),
  constraint donations_text_lengths
    check (
      coalesce(char_length(message), 0) <= 1000
      and coalesce(char_length(store_response), 0) <= 1000
    )
);

create index if not exists donations_store_status_idx
  on public.donations (store_id, status, created_at desc);
create index if not exists donations_donor_idx
  on public.donations (donor_id, created_at desc);

drop trigger if exists donations_set_updated_at on public.donations;
create trigger donations_set_updated_at
before update on public.donations
for each row execute function public.set_updated_at();

-- Máquina de estados: garante que cada papel só faça as transições permitidas.
create or replace function private.enforce_donation_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := (select auth.uid());
  is_store_owner boolean;
begin
  if new.status = old.status
     and new.store_response is not distinct from old.store_response then
    return new;
  end if;

  select exists (
    select 1 from public.stores s
    where s.id = old.store_id and s.owner_id = actor
  ) into is_store_owner;

  if is_store_owner then
    if not (
      (old.status = 'PENDING' and new.status in ('ACCEPTED', 'DECLINED'))
      or (old.status = 'ACCEPTED' and new.status in ('RECEIVED', 'DECLINED'))
      or (old.status = new.status and old.status in ('PENDING', 'ACCEPTED'))
    ) then
      raise exception 'Transição de doação não permitida: % -> %', old.status, new.status
        using errcode = 'check_violation';
    end if;
    if new.status <> old.status then
      new.responded_at := now();
    end if;
    return new;
  end if;

  if actor = old.donor_id then
    if not (old.status = 'PENDING' and new.status = 'CANCELLED')
       or new.store_response is distinct from old.store_response then
      raise exception 'O doador só pode cancelar uma doação pendente.'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- Migrations e o painel do Supabase (sem usuário autenticado) passam direto.
  if actor is null then
    return new;
  end if;

  raise exception 'Sem permissão para alterar esta doação.'
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists donations_enforce_transition on public.donations;
create trigger donations_enforce_transition
before update on public.donations
for each row execute function private.enforce_donation_transition();

alter table public.donations enable row level security;

grant select on public.donations to authenticated;
grant insert (
  store_id,
  donor_name,
  contact_phone,
  books_description,
  estimated_quantity,
  delivery_method,
  pickup_area,
  message
) on public.donations to authenticated;
grant update (status, store_response) on public.donations to authenticated;

drop policy if exists "donors create donations for approved stores" on public.donations;
create policy "donors create donations for approved stores"
on public.donations for insert
to authenticated
with check (
  donor_id = (select auth.uid())
  and status = 'PENDING'
  and store_response is null
  and exists (
    select 1
    from public.stores s
    where s.id = donations.store_id
      and s.approved = true
      and s.owner_id is distinct from (select auth.uid())
  )
);

drop policy if exists "donors, stores and admins read donations" on public.donations;
create policy "donors, stores and admins read donations"
on public.donations for select
to authenticated
using (
  donor_id = (select auth.uid())
  or exists (
    select 1
    from public.stores s
    where s.id = donations.store_id
      and s.owner_id = (select auth.uid())
  )
  or (select private.is_admin())
);

drop policy if exists "donors cancel own pending donations" on public.donations;
create policy "donors cancel own pending donations"
on public.donations for update
to authenticated
using (donor_id = (select auth.uid()) and status = 'PENDING')
with check (donor_id = (select auth.uid()));

drop policy if exists "stores answer received donations" on public.donations;
create policy "stores answer received donations"
on public.donations for update
to authenticated
using (
  exists (
    select 1
    from public.stores s
    where s.id = donations.store_id
      and s.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.stores s
    where s.id = donations.store_id
      and s.owner_id = (select auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- Mensagens de contato
-- ---------------------------------------------------------------------------
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references public.profiles(id) on delete set null,
  name text not null,
  email text not null,
  topic text not null default 'DUVIDA',
  message text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  constraint contact_name_length check (char_length(btrim(name)) between 2 and 120),
  constraint contact_email_format
    check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint contact_topic_values
    check (topic in ('DUVIDA', 'SEBO', 'DOACAO', 'PROBLEMA', 'SUGESTAO')),
  constraint contact_message_length check (char_length(btrim(message)) between 10 and 3000)
);

create index if not exists contact_messages_resolved_idx
  on public.contact_messages (resolved, created_at desc);

alter table public.contact_messages enable row level security;

grant insert (name, email, topic, message) on public.contact_messages to anon, authenticated;
grant select on public.contact_messages to authenticated;
grant update (resolved) on public.contact_messages to authenticated;

drop policy if exists "anyone can send contact messages" on public.contact_messages;
create policy "anyone can send contact messages"
on public.contact_messages for insert
to anon, authenticated
with check (
  resolved = false
  and user_id is not distinct from (select auth.uid())
);

drop policy if exists "admins read contact messages" on public.contact_messages;
create policy "admins read contact messages"
on public.contact_messages for select
to authenticated
using ((select private.is_admin()));

drop policy if exists "admins resolve contact messages" on public.contact_messages;
create policy "admins resolve contact messages"
on public.contact_messages for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));
