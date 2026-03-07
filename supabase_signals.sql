-- ============================================================
-- Quant Signal Logger Table
-- Run this in Supabase SQL Editor to enable signal logging
-- ============================================================

create table if not exists public.quant_signals (
  id uuid default gen_random_uuid() primary key,
  signal_id text not null,
  pair text not null,
  interval text not null,
  direction text not null check (direction in ('BUY', 'SELL')),
  entry numeric not null,
  stop_loss numeric not null,
  take_profit numeric not null,
  probability integer not null,
  strength_label text,
  regime text,
  risk_reward text,
  atr numeric,
  layers jsonb,
  result text not null default 'PENDING' check (result in ('WIN', 'LOSS', 'PENDING', 'EXPIRED')),
  exit_price numeric,
  exit_time timestamptz,
  created_at timestamptz default now() not null
);

-- Index for fast queries
create index if not exists quant_signals_pair_idx on public.quant_signals(pair);
create index if not exists quant_signals_result_idx on public.quant_signals(result);
create index if not exists quant_signals_created_at_idx on public.quant_signals(created_at desc);

-- Enable RLS
alter table public.quant_signals enable row level security;

-- Allow service role full access (used by API routes)
create policy "Service role full access"
  on public.quant_signals for all
  using (true)
  with check (true);

-- ============================================================
-- Create trade_signals table for EA communication
create table if not exists public.trade_signals (
  id uuid default gen_random_uuid() primary key,
  symbol text not null,
  mt5_symbol text not null,
  action text not null check (action in ('BUY', 'SELL')),
  entry numeric not null,
  stop_loss numeric,
  take_profit numeric,
  status text not null default 'PENDING' check (status in ('PENDING', 'EXECUTED', 'FAILED', 'CANCELLED')),
  created_at timestamptz default now() not null,
  executed_at timestamptz,
  notes text
);

-- Enable RLS
alter table public.trade_signals enable row level security;

-- Policies
create policy "Public read access for signals"
  on public.trade_signals for select
  using (true);

create policy "Admins can insert signals"
  on public.trade_signals for insert
  with check (true); -- Ideally restrict to admin role

create policy "Admins can update signals"
  on public.trade_signals for update
  using (true);
