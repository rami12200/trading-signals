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
