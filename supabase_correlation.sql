-- ============================================
-- Correlation Signals Table
-- Smart Correlation Scalping system
-- ============================================

CREATE TABLE IF NOT EXISTS public.correlation_signals (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  signal_id     TEXT NOT NULL UNIQUE,
  symbol        TEXT NOT NULL,
  label         TEXT NOT NULL,
  action        TEXT NOT NULL CHECK (action IN ('BUY', 'SELL')),
  entry         DOUBLE PRECISION NOT NULL,
  stop_loss     DOUBLE PRECISION NOT NULL,
  take_profit   DOUBLE PRECISION NOT NULL,
  confidence    DOUBLE PRECISION NOT NULL,
  lag_score     DOUBLE PRECISION NOT NULL,
  btc_change    DOUBLE PRECISION NOT NULL,
  btc_direction TEXT NOT NULL,
  correlation   DOUBLE PRECISION NOT NULL,
  risk_reward   DOUBLE PRECISION NOT NULL DEFAULT 0,
  reason        TEXT,
  result        TEXT NOT NULL DEFAULT 'PENDING' CHECK (result IN ('WIN', 'LOSS', 'BREAKEVEN', 'EMERGENCY', 'PENDING')),
  exit_price    DOUBLE PRECISION,
  exit_time     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_corr_signals_symbol ON public.correlation_signals (symbol);
CREATE INDEX IF NOT EXISTS idx_corr_signals_result ON public.correlation_signals (result);
CREATE INDEX IF NOT EXISTS idx_corr_signals_created ON public.correlation_signals (created_at DESC);

ALTER TABLE public.correlation_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on correlation_signals"
  ON public.correlation_signals
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
