-- MagNet entitlements: one row per user, the single source of truth for tier.
-- Run in the Supabase SQL editor (or via the CLI) on the project.

create table public.entitlements (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  tier       text not null default 'free' check (tier in ('free','pro','studio')),
  expires_at date,
  updated_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;

-- Users may read ONLY their own row. There is intentionally no insert/update/
-- delete policy, so only the service role (Stripe webhook / admin) can grant a
-- paid tier.
create policy "read own entitlement" on public.entitlements
  for select using (auth.uid() = user_id);

-- Auto-create a free row whenever a new auth user signs up.
create function public.handle_new_user() returns trigger
  language plpgsql security definer as $$
begin
  insert into public.entitlements(user_id, tier) values (new.id, 'free')
  on conflict do nothing;
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
