-- ERMO database schema (MVP).
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: tables use "if not exists", functions and policies are replaced.
--
-- Money is stored in whole pence. All payments are SIMULATED (PRD 8.6): bookings move through
-- the real states and the ledger records every movement, but no real money moves.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Settings (PRD section 16 open decisions live here, so they change without a deploy)
-- ---------------------------------------------------------------------------

create table if not exists public.settings (
  id                    int primary key default 1 check (id = 1),
  client_fee_bps        int not null default 500,   -- 5% service fee paid by the client
  carer_commission_bps  int not null default 1000,  -- 10% commission deducted from the carer payout
  auto_release_hours    int not null default 48,
  dispute_window_hours  int not null default 48
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  role            text not null default 'client' check (role in ('client', 'carer', 'admin')),
  full_name       text,
  city            text,
  avatar_path     text,                 -- path inside the public "avatars" bucket
  id_verified_at  timestamptz,          -- simulated identity check (PRD 7.1 / 7.2)
  suspended_at    timestamptz,
  suspended_reason text,
  created_at      timestamptz not null default now()
);

create table if not exists public.carer_profiles (
  id                 uuid primary key references public.profiles(id) on delete cascade,
  headline           text,
  bio                text,
  gender             text check (gender in ('female', 'male', 'non_binary', 'prefer_not')),
  services           text[] not null default '{}',
  hourly_rate_pence  int check (hourly_rate_pence between 1000 and 10000),
  city               text,
  postcode           text,
  years_experience   int check (years_experience between 0 and 60),
  availability       text[] not null default '{}',   -- days: mon..sun
  status             text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected')),
  status_reason      text,
  rtw_verified_at    timestamptz,
  dbs_checked_at     timestamptz,                    -- last DBS Update Service status check
  dbs_next_check     date,
  submitted_at       timestamptz,
  approved_at        timestamptz,
  created_at         timestamptz not null default now()
);

create table if not exists public.carer_documents (
  id          uuid primary key default gen_random_uuid(),
  carer_id    uuid not null references public.carer_profiles(id) on delete cascade,
  kind        text not null check (kind in ('right_to_work', 'dbs', 'qualification', 'reference')),
  title       text not null,
  file_path   text,                     -- path inside the private "documents" bucket
  expires_on  date,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  review_note text,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);

-- The person receiving care: the client themself or someone they arrange care for (PRD 7.2).
create table if not exists public.care_recipients (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  relationship  text not null default 'self',
  needs         text,                -- only what a carer needs to know
  created_at    timestamptz not null default now()
);

-- Location (postcodes.io coordinates). Carers are matched by distance, within how far they will travel.
-- The postcode and coordinates are never shown publicly; only the area name and a rounded distance.
alter table public.carer_profiles add column if not exists lat double precision;
alter table public.carer_profiles add column if not exists lng double precision;
alter table public.carer_profiles add column if not exists travel_miles int not null default 10 check (travel_miles between 1 and 50);

create index if not exists carer_documents_carer_idx on public.carer_documents(carer_id);
create index if not exists care_recipients_client_idx on public.care_recipients(client_id);

-- ---------------------------------------------------------------------------
-- Messaging (PRD 7.5)
-- ---------------------------------------------------------------------------

create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles(id) on delete cascade,
  carer_id    uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (client_id, carer_id)
);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null check (length(body) between 1 and 4000),
  flagged         boolean not null default false,   -- contact details were masked
  created_at      timestamptz not null default now()
);

-- The unmasked text of flagged messages, readable by admins only.
create table if not exists public.message_flags (
  message_id  uuid primary key references public.messages(id) on delete cascade,
  original    text not null,
  created_at  timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Bookings and the simulated payment ledger (PRD 7.4, 8, 9)
-- ---------------------------------------------------------------------------

create table if not exists public.bookings (
  id                 uuid primary key default gen_random_uuid(),
  ref                text not null unique,
  client_id          uuid not null references public.profiles(id),
  carer_id           uuid not null references public.profiles(id),
  recipient_id       uuid references public.care_recipients(id) on delete set null,
  service            text not null,
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  hours              numeric(5, 2) not null,
  rate_pence         int not null,
  subtotal_pence     int not null,          -- rate x hours
  client_fee_pence   int not null,          -- service fee on top, paid by client
  client_total_pence int not null,          -- subtotal + client fee: what is held
  note               text,
  status             text not null default 'requested' check (status in (
                       'requested', 'declined', 'accepted', 'checked_in', 'checked_out',
                       'completed', 'disputed', 'resolved', 'cancelled', 'no_show')),
  payment_status     text not null default 'pending' check (payment_status in (
                       'pending', 'held', 'released', 'refunded', 'partially_refunded', 'none')),
  checked_in_at      timestamptz,
  check_in_lat       double precision,
  check_in_lng       double precision,
  checked_out_at     timestamptz,
  auto_checked_out   boolean not null default false,
  completed_at       timestamptz,
  auto_released      boolean not null default false,
  cancelled_by       text check (cancelled_by in ('client', 'carer')),
  cancel_reason      text,
  cancelled_at       timestamptz,
  dispute_reason     text,
  disputed_at        timestamptz,
  resolution         text check (resolution in ('release', 'partial', 'refund')),
  resolution_note    text,
  -- Settlement result, filled when money leaves "held".
  carer_payout_pence  int,
  platform_fee_pence  int,
  refund_pence        int,
  created_at         timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists bookings_client_idx on public.bookings(client_id, starts_at desc);
create index if not exists bookings_carer_idx on public.bookings(carer_id, starts_at desc);
create index if not exists bookings_status_idx on public.bookings(status);

create table if not exists public.payment_events (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references public.bookings(id) on delete cascade,
  kind          text not null check (kind in ('hold', 'release', 'fee', 'refund')),
  party         text not null check (party in ('client', 'carer', 'platform')),
  amount_pence  int not null check (amount_pence >= 0),
  note          text,
  created_at    timestamptz not null default now()
);
create index if not exists payment_events_booking_idx on public.payment_events(booking_id);

create table if not exists public.reviews (
  booking_id  uuid primary key references public.bookings(id) on delete cascade,
  client_id   uuid not null references public.profiles(id) on delete cascade,
  carer_id    uuid not null references public.profiles(id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  body        text check (length(body) <= 2000),
  created_at  timestamptz not null default now()
);
create index if not exists reviews_carer_idx on public.reviews(carer_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Safeguarding and admin audit (PRD 7.8, 7.9, 10)
-- ---------------------------------------------------------------------------

create table if not exists public.safeguarding_reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references public.profiles(id) on delete cascade,
  subject_id       uuid references public.profiles(id) on delete set null,
  booking_id       uuid references public.bookings(id) on delete set null,
  conversation_id  uuid references public.conversations(id) on delete set null,
  details          text not null check (length(details) between 10 and 5000),
  status           text not null default 'open' check (status in ('open', 'reviewing', 'closed')),
  admin_note       text,
  created_at       timestamptz not null default now()
);

create table if not exists public.admin_audit (
  id          bigserial primary key,
  admin_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  target_id   uuid,
  detail      text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- Raises unless the caller is signed in, not suspended, and (optionally) has the given role.
create or replace function public.require_user(p_role text default null)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  v_me profiles%rowtype;
begin
  select * into v_me from profiles where id = auth.uid();
  if v_me.id is null then raise exception 'Please sign in first.'; end if;
  if v_me.suspended_at is not null then raise exception 'This account is suspended.'; end if;
  if p_role is not null and v_me.role <> p_role then raise exception 'Only a % can do this.', p_role; end if;
  return v_me.id;
end;
$$;

create or replace function public.audit(p_action text, p_target uuid, p_detail text)
returns void language sql security definer set search_path = public as $$
  insert into admin_audit (admin_id, action, target_id, detail) values (auth.uid(), p_action, p_target, p_detail);
$$;

-- Whether the caller may see another person's profile: themselves, admins, live carers,
-- and anyone they already have a conversation or booking with.
create or replace function public.can_see_profile(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_id = auth.uid()
      or public.is_admin()
      or exists (select 1 from carer_profiles c join profiles p on p.id = c.id
                 where c.id = p_id and c.status = 'approved' and p.suspended_at is null)
      or exists (select 1 from conversations v
                 where (v.client_id = auth.uid() and v.carer_id = p_id) or (v.carer_id = auth.uid() and v.client_id = p_id))
      or exists (select 1 from bookings b
                 where (b.client_id = auth.uid() and b.carer_id = p_id) or (b.carer_id = auth.uid() and b.client_id = p_id));
$$;

-- Set once the person has chosen client or carer. Email sign-ups choose on the form; Google
-- sign-ups choose on the /welcome screen after their first sign-in.
alter table public.profiles add column if not exists onboarded_at timestamptz;
update public.profiles p set onboarded_at = p.created_at
 where p.onboarded_at is null
   and (p.role = 'admin' or exists (select 1 from auth.users u where u.id = p.id and u.raw_user_meta_data ? 'role'));

-- New sign-ups pick "client" or "carer". Admin is never self-assigned: promote in SQL (see README).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text := case when new.raw_user_meta_data->>'role' = 'carer' then 'carer' else 'client' end;
begin
  insert into public.profiles (id, role, full_name, onboarded_at)
  values (new.id, v_role, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
          case when new.raw_user_meta_data ? 'role' then now() end)
  on conflict (id) do nothing;
  if v_role = 'carer' then
    insert into public.carer_profiles (id) values (new.id) on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Onboarding and verification
-- ---------------------------------------------------------------------------

-- One-time choice for people who signed up with Google (no form to pick a role on).
create or replace function public.choose_role(p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare v_me profiles%rowtype;
begin
  select * into v_me from profiles where id = auth.uid();
  if v_me.id is null then raise exception 'Please sign in first.'; end if;
  if v_me.onboarded_at is not null then raise exception 'You have already chosen how you use ERMO.'; end if;
  if p_role not in ('client', 'carer') then raise exception 'Choose client or carer.'; end if;
  update profiles set role = p_role, onboarded_at = now() where id = v_me.id;
  if p_role = 'carer' then
    insert into carer_profiles (id) values (v_me.id) on conflict (id) do nothing;
  end if;
end;
$$;

-- SIMULATED identity check (document + selfie). Replace with Stripe Identity / Yoti / Onfido later.
create or replace function public.simulate_identity_check()
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.require_user();
begin
  update profiles set id_verified_at = now() where id = v_me;
end;
$$;

create or replace function public.submit_carer_for_review()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_user('carer');
  v_c carer_profiles%rowtype;
begin
  select * into v_c from carer_profiles where id = v_me;
  if v_c.status not in ('draft', 'rejected') then raise exception 'Your profile is already %.', v_c.status; end if;
  if coalesce(trim(v_c.bio), '') = '' or v_c.hourly_rate_pence is null or cardinality(v_c.services) = 0
     or v_c.gender is null or v_c.lat is null then
    raise exception 'Complete your profile (bio, gender, services, rate and area) first.';
  end if;
  if (select id_verified_at from profiles where id = v_me) is null then
    raise exception 'Verify your identity first.';
  end if;
  if not exists (select 1 from carer_documents where carer_id = v_me and kind = 'right_to_work' and status <> 'rejected') then
    raise exception 'Add your right to work document.';
  end if;
  if not exists (select 1 from carer_documents where carer_id = v_me and kind = 'dbs' and status <> 'rejected') then
    raise exception 'Add your DBS certificate and Update Service details.';
  end if;
  update carer_profiles set status = 'pending', status_reason = null, submitted_at = now() where id = v_me;
end;
$$;

create or replace function public.admin_review_document(p_doc uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_d carer_documents%rowtype;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update carer_documents
     set status = case when p_approve then 'approved' else 'rejected' end, review_note = p_note, reviewed_at = now()
   where id = p_doc returning * into v_d;
  if v_d.id is null then raise exception 'Document not found.'; end if;
  if p_approve and v_d.kind = 'right_to_work' then
    update carer_profiles set rtw_verified_at = now() where id = v_d.carer_id;
  elsif p_approve and v_d.kind = 'dbs' then
    -- Stands in for the DBS Update Service online status check; re-checked quarterly (PRD 7.1).
    update carer_profiles set dbs_checked_at = now(), dbs_next_check = current_date + 90 where id = v_d.carer_id;
  end if;
  perform public.audit(case when p_approve then 'document.approve' else 'document.reject' end, v_d.carer_id,
                       v_d.kind || ': ' || v_d.title || coalesce(' (' || p_note || ')', ''));
end;
$$;

create or replace function public.admin_review_carer(p_carer uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_c carer_profiles%rowtype;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  select * into v_c from carer_profiles where id = p_carer;
  if v_c.id is null then raise exception 'Carer not found.'; end if;
  if p_approve then
    if (select id_verified_at from profiles where id = p_carer) is null then raise exception 'Identity is not verified.'; end if;
    if v_c.rtw_verified_at is null then raise exception 'Approve the right to work document first.'; end if;
    if v_c.dbs_checked_at is null then raise exception 'Approve the DBS check first.'; end if;
    update carer_profiles set status = 'approved', status_reason = null, approved_at = now() where id = p_carer;
  else
    if coalesce(trim(p_reason), '') = '' then raise exception 'Give a reason so the carer knows what to fix.'; end if;
    update carer_profiles set status = 'rejected', status_reason = p_reason where id = p_carer;
  end if;
  perform public.audit(case when p_approve then 'carer.approve' else 'carer.reject' end, p_carer, p_reason);
end;
$$;

create or replace function public.admin_set_suspended(p_user uuid, p_suspend boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_user = auth.uid() then raise exception 'You cannot suspend yourself.'; end if;
  update profiles
     set suspended_at = case when p_suspend then now() end,
         suspended_reason = case when p_suspend then p_reason end
   where id = p_user;
  perform public.audit(case when p_suspend then 'user.suspend' else 'user.unsuspend' end, p_user, p_reason);
end;
$$;

-- ---------------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------------

create or replace function public.start_conversation(p_carer uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_user('client');
  v_id uuid;
begin
  if not exists (select 1 from carer_profiles where id = p_carer and status = 'approved') then
    raise exception 'This carer is not available.';
  end if;
  insert into conversations (client_id, carer_id) values (v_me, p_carer)
  on conflict (client_id, carer_id) do nothing;
  select id into v_id from conversations where client_id = v_me and carer_id = p_carer;
  return v_id;
end;
$$;

-- Contact details stay hidden until the pair has a confirmed booking (PRD 7.5, 7.6).
create or replace function public.send_message(p_conversation uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_user();
  v_c conversations%rowtype;
  v_body text := trim(p_body);
  v_masked text;
  v_id uuid;
begin
  select * into v_c from conversations where id = p_conversation;
  if v_c.id is null or v_me not in (v_c.client_id, v_c.carer_id) then raise exception 'Conversation not found.'; end if;
  if v_body = '' then raise exception 'Message is empty.'; end if;

  v_masked := v_body;
  if not exists (select 1 from bookings b
                 where b.client_id = v_c.client_id and b.carer_id = v_c.carer_id
                   and b.status in ('accepted', 'checked_in', 'checked_out', 'completed', 'disputed', 'resolved')) then
    v_masked := regexp_replace(v_masked, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[contact hidden]', 'g');
    v_masked := regexp_replace(v_masked, '(https?://|www\.)\S+', '[link hidden]', 'gi');
    v_masked := regexp_replace(v_masked, '\+?\d[\d\s().-]{8,}\d', '[number hidden]', 'g');
  end if;

  insert into messages (conversation_id, sender_id, body, flagged)
  values (v_c.id, v_me, v_masked, v_masked <> v_body) returning id into v_id;
  if v_masked <> v_body then
    insert into message_flags (message_id, original) values (v_id, v_body);
  end if;
  update conversations set last_message_at = now() where id = v_c.id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Booking lifecycle
-- ---------------------------------------------------------------------------

create or replace function public.request_booking(
  p_carer uuid, p_service text, p_starts timestamptz, p_ends timestamptz,
  p_recipient uuid default null, p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_user('client');
  v_c carer_profiles%rowtype;
  v_s settings%rowtype;
  v_hours numeric(5, 2);
  v_sub int;
  v_fee int;
  v_id uuid;
begin
  if (select id_verified_at from profiles where id = v_me) is null then
    raise exception 'Verify your identity before your first booking.';
  end if;
  select * into v_c from carer_profiles where id = p_carer;
  if v_c.id is null or v_c.status <> 'approved' or (select suspended_at from profiles where id = p_carer) is not null then
    raise exception 'This carer is not available.';
  end if;
  if not (p_service = any (v_c.services)) then raise exception 'This carer does not offer that service.'; end if;
  if p_starts < now() then raise exception 'Choose a start time in the future.'; end if;
  if p_ends <= p_starts then raise exception 'The end time must be after the start time.'; end if;
  v_hours := round((extract(epoch from p_ends - p_starts) / 3600)::numeric, 2);
  if v_hours < 1 or v_hours > 24 then raise exception 'A booking must be between 1 and 24 hours.'; end if;
  if p_recipient is not null and not exists (select 1 from care_recipients where id = p_recipient and client_id = v_me) then
    raise exception 'Care recipient not found.';
  end if;

  select * into v_s from settings where id = 1;
  v_sub := round(v_c.hourly_rate_pence * v_hours);
  v_fee := round(v_sub * v_s.client_fee_bps / 10000.0);

  insert into bookings (ref, client_id, carer_id, recipient_id, service, starts_at, ends_at, hours,
                        rate_pence, subtotal_pence, client_fee_pence, client_total_pence, note)
  values ('ERM-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 5)),
          v_me, p_carer, p_recipient, p_service, p_starts, p_ends, v_hours,
          v_c.hourly_rate_pence, v_sub, v_fee, v_sub + v_fee, nullif(trim(p_note), ''))
  returning id into v_id;

  insert into conversations (client_id, carer_id) values (v_me, p_carer) on conflict do nothing;
  return v_id;
end;
$$;

-- Moves held money out: p_carer_share goes to the carer (less commission), the rest back to the
-- client. The client's service fee is kept only when care was delivered (p_keep_client_fee).
create or replace function public.settle_booking(
  p_id uuid, p_carer_share int, p_keep_client_fee boolean, p_status text, p_note text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_b bookings%rowtype;
  v_s settings%rowtype;
  v_share int;
  v_commission int;
  v_kept_fee int;
  v_refund int;
begin
  select * into v_b from bookings where id = p_id for update;
  select * into v_s from settings where id = 1;
  v_share := greatest(0, least(p_carer_share, v_b.subtotal_pence));
  v_commission := round(v_share * v_s.carer_commission_bps / 10000.0);
  v_kept_fee := case when p_keep_client_fee and v_share > 0 then v_b.client_fee_pence else 0 end;
  v_refund := v_b.client_total_pence - v_share - v_kept_fee;

  update bookings set
    status = p_status,
    payment_status = case when v_refund = 0 then 'released'
                          when v_share = 0 then 'refunded'
                          else 'partially_refunded' end,
    carer_payout_pence = v_share - v_commission,
    platform_fee_pence = v_commission + v_kept_fee,
    refund_pence = v_refund
  where id = p_id;

  if v_share > 0 then
    insert into payment_events (booking_id, kind, party, amount_pence, note) values (p_id, 'release', 'carer', v_share - v_commission, p_note);
  end if;
  if v_commission + v_kept_fee > 0 then
    insert into payment_events (booking_id, kind, party, amount_pence, note) values (p_id, 'fee', 'platform', v_commission + v_kept_fee, 'Platform fee');
  end if;
  if v_refund > 0 then
    insert into payment_events (booking_id, kind, party, amount_pence, note) values (p_id, 'refund', 'client', v_refund, p_note);
  end if;
end;
$$;
revoke execute on function public.settle_booking(uuid, int, boolean, text, text) from public, anon, authenticated;

create or replace function public.respond_booking(p_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_user('carer');
  v_b bookings%rowtype;
begin
  select * into v_b from bookings where id = p_id and carer_id = v_me for update;
  if v_b.id is null then raise exception 'Booking not found.'; end if;
  if v_b.status <> 'requested' then raise exception 'This booking has already been answered.'; end if;
  if p_accept then
    if v_b.starts_at < now() then raise exception 'This request has expired.'; end if;
    update bookings set status = 'accepted', payment_status = 'held' where id = p_id;
    insert into payment_events (booking_id, kind, party, amount_pence, note)
    values (p_id, 'hold', 'client', v_b.client_total_pence, 'Payment held until the shift is complete (simulated)');
  else
    update bookings set status = 'declined', payment_status = 'none' where id = p_id;
  end if;
end;
$$;

create or replace function public.check_in(p_id uuid, p_lat double precision default null, p_lng double precision default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_user('carer');
  v_b bookings%rowtype;
begin
  select * into v_b from bookings where id = p_id and carer_id = v_me for update;
  if v_b.id is null then raise exception 'Booking not found.'; end if;
  if v_b.status <> 'accepted' then raise exception 'You can only check in to an accepted booking.'; end if;
  if now() < v_b.starts_at - interval '1 hour' then raise exception 'Check-in opens 1 hour before the shift.'; end if;
  if now() > v_b.ends_at then raise exception 'This shift has already ended.'; end if;
  update bookings set status = 'checked_in', checked_in_at = now(), check_in_lat = p_lat, check_in_lng = p_lng where id = p_id;
end;
$$;

create or replace function public.check_out(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_user('carer');
  v_b bookings%rowtype;
begin
  select * into v_b from bookings where id = p_id and carer_id = v_me for update;
  if v_b.id is null then raise exception 'Booking not found.'; end if;
  if v_b.status <> 'checked_in' then raise exception 'You are not checked in to this booking.'; end if;
  update bookings set status = 'checked_out', checked_out_at = now() where id = p_id;
end;
$$;

create or replace function public.confirm_completion(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_user('client');
  v_b bookings%rowtype;
begin
  select * into v_b from bookings where id = p_id and client_id = v_me for update;
  if v_b.id is null then raise exception 'Booking not found.'; end if;
  if v_b.status <> 'checked_out' then raise exception 'You can confirm once the carer has checked out.'; end if;
  update bookings set completed_at = now() where id = p_id;
  perform public.settle_booking(p_id, v_b.subtotal_pence, true, 'completed', 'Released after client confirmed completion');
end;
$$;

-- Cancellation policy (PRD 8.4). Client: >48h full refund, 24-48h 50% to carer, <24h 100% to carer.
-- Carer: always a full refund, no penalty beyond the reliability figure.
create or replace function public.cancel_booking(p_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_user();
  v_b bookings%rowtype;
  v_by text;
  v_hours_left numeric;
  v_pct int;
begin
  select * into v_b from bookings where id = p_id and v_me in (client_id, carer_id) for update;
  if v_b.id is null then raise exception 'Booking not found.'; end if;
  v_by := case when v_me = v_b.client_id then 'client' else 'carer' end;

  if v_b.status = 'requested' then
    update bookings set status = 'cancelled', payment_status = 'none', cancelled_by = v_by,
                        cancel_reason = p_reason, cancelled_at = now() where id = p_id;
    return;
  end if;
  if v_b.status <> 'accepted' then raise exception 'This booking can no longer be cancelled.'; end if;

  update bookings set cancelled_by = v_by, cancel_reason = p_reason, cancelled_at = now() where id = p_id;
  if v_by = 'carer' then
    perform public.settle_booking(p_id, 0, false, 'cancelled', 'Full refund: carer cancelled');
  else
    v_hours_left := extract(epoch from v_b.starts_at - now()) / 3600;
    v_pct := case when v_hours_left > 48 then 0 when v_hours_left >= 24 then 50 else 100 end;
    perform public.settle_booking(p_id, round(v_b.subtotal_pence * v_pct / 100.0)::int, false, 'cancelled',
      case v_pct when 0 then 'Full refund: cancelled more than 48 hours before'
                 when 50 then 'Late cancellation (24 to 48 hours): 50% paid to carer'
                 else 'Late cancellation (under 24 hours): full rate paid to carer' end);
  end if;
end;
$$;

-- Disputes cover facts only: did the shift happen, and for how long (PRD 9).
create or replace function public.raise_dispute(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_user('client');
  v_b bookings%rowtype;
  v_s settings%rowtype;
begin
  select * into v_b from bookings where id = p_id and client_id = v_me for update;
  select * into v_s from settings where id = 1;
  if v_b.id is null then raise exception 'Booking not found.'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Say what happened.'; end if;
  if v_b.status = 'checked_out' then
    if now() > v_b.checked_out_at + make_interval(hours => v_s.dispute_window_hours) then
      raise exception 'The dispute window has closed.';
    end if;
  elsif not (v_b.status in ('accepted', 'checked_in') and now() > v_b.starts_at) then
    raise exception 'You can raise a dispute once the shift has started.';
  end if;
  update bookings set status = 'disputed', dispute_reason = p_reason, disputed_at = now() where id = p_id;
end;
$$;

create or replace function public.admin_resolve_dispute(p_id uuid, p_outcome text, p_hours numeric default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_b bookings%rowtype;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  select * into v_b from bookings where id = p_id for update;
  if v_b.status <> 'disputed' then raise exception 'This booking is not in dispute.'; end if;
  update bookings set resolution = p_outcome, resolution_note = p_note, completed_at = now() where id = p_id;
  if p_outcome = 'release' then
    perform public.settle_booking(p_id, v_b.subtotal_pence, true, 'resolved', 'Dispute resolved: full release');
  elsif p_outcome = 'partial' then
    if p_hours is null or p_hours <= 0 or p_hours >= v_b.hours then raise exception 'Enter the hours actually worked.'; end if;
    perform public.settle_booking(p_id, round(v_b.rate_pence * p_hours)::int, true, 'resolved',
                                  'Dispute resolved: paid for ' || p_hours || ' hours worked');
  elsif p_outcome = 'refund' then
    perform public.settle_booking(p_id, 0, false, 'resolved', 'Dispute resolved: full refund');
  else
    raise exception 'Unknown outcome.';
  end if;
  perform public.audit('dispute.' || p_outcome, p_id, p_note);
end;
$$;

-- Time-based rules. Runs every 10 minutes via pg_cron, and is also called when dashboards load,
-- so the MVP behaves correctly even if pg_cron is not enabled. Safe to run any number of times.
create or replace function public.run_maintenance()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_s settings%rowtype;
  r record;
begin
  select * into v_s from settings where id = 1;

  -- Requests nobody answered before the shift started.
  update bookings set status = 'cancelled', payment_status = 'none', cancel_reason = 'Request expired'
   where status = 'requested' and starts_at < now();

  -- Carer never checked in: no-show, full refund (PRD 8.5).
  for r in select id from bookings where status = 'accepted' and ends_at < now() loop
    perform public.settle_booking(r.id, 0, false, 'no_show', 'Full refund: carer did not check in');
  end loop;

  -- Carer forgot to check out: close at the booked end time so the client can confirm or dispute.
  update bookings set status = 'checked_out', checked_out_at = ends_at, auto_checked_out = true
   where status = 'checked_in' and ends_at + interval '2 hours' < now();

  -- Auto-release when the client neither confirms nor disputes in time (PRD 8.3).
  for r in select id, subtotal_pence from bookings
            where status = 'checked_out' and checked_out_at + make_interval(hours => v_s.auto_release_hours) < now() loop
    update bookings set auto_released = true, completed_at = now() where id = r.id;
    perform public.settle_booking(r.id, r.subtotal_pence, true, 'completed', 'Released automatically after ' || v_s.auto_release_hours || ' hours');
  end loop;

  -- Expired qualifications drop off the profile (PRD 7.1).
  update carer_documents set status = 'expired' where status = 'approved' and expires_on < current_date;
end;
$$;

create or replace function public.leave_review(p_booking uuid, p_rating int, p_body text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_user('client');
  v_b bookings%rowtype;
begin
  select * into v_b from bookings where id = p_booking and client_id = v_me;
  if v_b.id is null then raise exception 'Booking not found.'; end if;
  if v_b.status not in ('completed', 'resolved') then raise exception 'You can review once the booking is complete.'; end if;
  insert into reviews (booking_id, client_id, carer_id, rating, body)
  values (p_booking, v_me, v_b.carer_id, p_rating, nullif(trim(p_body), ''))
  on conflict (booking_id) do update set rating = excluded.rating, body = excluded.body;
end;
$$;

create or replace function public.report_concern(
  p_details text, p_subject uuid default null, p_booking uuid default null, p_conversation uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_user();
  v_id uuid;
begin
  insert into safeguarding_reports (reporter_id, subject_id, booking_id, conversation_id, details)
  values (v_me, p_subject, p_booking, p_conversation, trim(p_details)) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_update_report(p_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update safeguarding_reports set status = p_status, admin_note = coalesce(p_note, admin_note) where id = p_id;
  perform public.audit('safeguarding.' || p_status, p_id, p_note);
end;
$$;

create or replace function public.carer_private(p_id uuid)
returns table (postcode text, lat double precision, lng double precision)
language sql stable security definer set search_path = public as $$
  select c.postcode, c.lat, c.lng from carer_profiles c
  where c.id = p_id and (p_id = auth.uid() or public.is_admin());
$$;

-- Great-circle distance in miles.
create or replace function public.miles_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 3958.8 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)));
$$;

-- Live carers who travel as far as the given point, nearest first. Distance is rounded to the
-- nearest half mile (minimum 0.5) so a carer's exact home can't be worked out from searches.
create or replace function public.carers_near(
  p_lat double precision, p_lng double precision,
  p_service text default null, p_gender text default null, p_day text default null
) returns table (carer_id uuid, miles numeric)
language sql stable security definer set search_path = public as $$
  select c.id, greatest(0.5, round((public.miles_between(p_lat, p_lng, c.lat, c.lng) * 2)::numeric) / 2)
  from carer_profiles c join profiles p on p.id = c.id
  where c.status = 'approved' and p.suspended_at is null and c.lat is not null
    and public.miles_between(p_lat, p_lng, c.lat, c.lng) <= c.travel_miles
    and (p_service is null or p_service = any (c.services))
    and (p_gender is null or c.gender = p_gender)
    and (p_day is null or p_day = any (c.availability))
  order by 2, c.approved_at desc
  limit 60;
$$;

-- Public stats for carer cards: rating, review count, completed shifts and reliability (PRD 7.7).
create or replace function public.carer_stats(p_ids uuid[])
returns table (carer_id uuid, rating numeric, reviews int, completed int, reliability int)
language sql stable security definer set search_path = public as $$
  select c.id,
         (select round(avg(r.rating), 1) from reviews r where r.carer_id = c.id),
         (select count(*)::int from reviews r where r.carer_id = c.id),
         (select count(*)::int from bookings b where b.carer_id = c.id and b.status in ('completed', 'resolved')),
         (select case when count(*) = 0 then null
                      else round(100.0 * count(*) filter (where b.status in ('completed', 'resolved')) / count(*))::int end
            from bookings b where b.carer_id = c.id
             and (b.status in ('completed', 'resolved', 'no_show') or (b.status = 'cancelled' and b.cancelled_by = 'carer')))
  from unnest(p_ids) as c(id);
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security and column grants
-- Writes go through the functions above; only plain profile edits are direct.
-- ---------------------------------------------------------------------------

alter table public.settings             enable row level security;
alter table public.profiles             enable row level security;
alter table public.carer_profiles       enable row level security;
alter table public.carer_documents      enable row level security;
alter table public.care_recipients      enable row level security;
alter table public.conversations        enable row level security;
alter table public.messages             enable row level security;
alter table public.message_flags        enable row level security;
alter table public.bookings             enable row level security;
alter table public.payment_events       enable row level security;
alter table public.reviews              enable row level security;
alter table public.safeguarding_reports enable row level security;
alter table public.admin_audit          enable row level security;

revoke insert, update, delete on all tables in schema public from anon, authenticated;
grant update (full_name, city, avatar_path) on public.profiles to authenticated;
grant update (headline, bio, gender, services, hourly_rate_pence, city, postcode, years_experience, availability, lat, lng, travel_miles)
  on public.carer_profiles to authenticated;
-- A carer's postcode and coordinates are readable only through carer_private() (the carer and admins).
revoke select on public.carer_profiles from anon, authenticated;
grant select (id, headline, bio, gender, services, hourly_rate_pence, city, years_experience, availability, travel_miles,
              status, status_reason, rtw_verified_at, dbs_checked_at, dbs_next_check, submitted_at, approved_at, created_at)
  on public.carer_profiles to anon, authenticated;
grant insert (carer_id, kind, title, file_path, expires_on), delete on public.carer_documents to authenticated;
grant insert, update, delete on public.care_recipients to authenticated;

drop policy if exists "read settings" on public.settings;
create policy "read settings" on public.settings for select using (true);

drop policy if exists "see profiles" on public.profiles;
create policy "see profiles" on public.profiles for select using (public.can_see_profile(id));
drop policy if exists "edit own profile" on public.profiles;
create policy "edit own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "see carers" on public.carer_profiles;
create policy "see carers" on public.carer_profiles for select
  using (status = 'approved' or id = auth.uid() or public.is_admin());
drop policy if exists "edit own carer profile" on public.carer_profiles;
create policy "edit own carer profile" on public.carer_profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Clients see only approved qualifications (as badges); documents themselves stay private.
drop policy if exists "see documents" on public.carer_documents;
create policy "see documents" on public.carer_documents for select
  using (carer_id = auth.uid() or public.is_admin()
         or (status = 'approved' and kind = 'qualification'
             and exists (select 1 from carer_profiles c where c.id = carer_id and c.status = 'approved')));
drop policy if exists "add own documents" on public.carer_documents;
create policy "add own documents" on public.carer_documents for insert to authenticated
  with check (carer_id = auth.uid());
drop policy if exists "remove own pending documents" on public.carer_documents;
create policy "remove own pending documents" on public.carer_documents for delete to authenticated
  using (carer_id = auth.uid() and status in ('pending', 'rejected'));

drop policy if exists "own recipients" on public.care_recipients;
create policy "own recipients" on public.care_recipients for all to authenticated
  using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists "carer sees booked recipient" on public.care_recipients;
create policy "carer sees booked recipient" on public.care_recipients for select to authenticated
  using (exists (select 1 from bookings b where b.recipient_id = care_recipients.id and b.carer_id = auth.uid()
                 and b.status not in ('requested', 'declined', 'cancelled'))
         or public.is_admin());

drop policy if exists "participants" on public.conversations;
create policy "participants" on public.conversations for select to authenticated
  using (auth.uid() in (client_id, carer_id) or public.is_admin());

-- Admins read a conversation only when it was reported or the pair has a dispute (PRD 7.5).
drop policy if exists "read messages" on public.messages;
create policy "read messages" on public.messages for select to authenticated
  using (exists (select 1 from conversations v where v.id = conversation_id and auth.uid() in (v.client_id, v.carer_id))
         or (public.is_admin() and (
               exists (select 1 from safeguarding_reports s where s.conversation_id = messages.conversation_id)
            or exists (select 1 from conversations v join bookings b on b.client_id = v.client_id and b.carer_id = v.carer_id
                       where v.id = messages.conversation_id and b.disputed_at is not null))));

drop policy if exists "admin reads flags" on public.message_flags;
create policy "admin reads flags" on public.message_flags for select to authenticated using (public.is_admin());

drop policy if exists "booking parties" on public.bookings;
create policy "booking parties" on public.bookings for select to authenticated
  using (auth.uid() in (client_id, carer_id) or public.is_admin());

drop policy if exists "ledger parties" on public.payment_events;
create policy "ledger parties" on public.payment_events for select to authenticated
  using (exists (select 1 from bookings b where b.id = booking_id and (auth.uid() in (b.client_id, b.carer_id) or public.is_admin())));

drop policy if exists "public reviews" on public.reviews;
create policy "public reviews" on public.reviews for select using (true);

drop policy if exists "reports" on public.safeguarding_reports;
create policy "reports" on public.safeguarding_reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists "audit" on public.admin_audit;
create policy "audit" on public.admin_audit for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: private "documents" (DBS, right to work, certificates) and public "avatars"
-- Files live under a folder named after the owner's user id.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;

drop policy if exists "ermo documents upload" on storage.objects;
create policy "ermo documents upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "ermo documents read" on storage.objects;
create policy "ermo documents read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "ermo documents delete" on storage.objects;
create policy "ermo documents delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ermo avatars upload" on storage.objects;
create policy "ermo avatars upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "ermo avatars update" on storage.objects;
create policy "ermo avatars update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "ermo avatars read" on storage.objects;
create policy "ermo avatars read" on storage.objects for select
  using (bucket_id = 'avatars');

-- ---------------------------------------------------------------------------
-- Realtime chat and scheduled jobs
-- ---------------------------------------------------------------------------

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

-- Needs the pg_cron extension (Dashboard -> Database -> Extensions). Skipped quietly if missing.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('ermo-maintenance', '*/10 * * * *', 'select public.run_maintenance()');
exception when others then
  raise notice 'pg_cron not available; run_maintenance() still runs when dashboards load.';
end $$;
