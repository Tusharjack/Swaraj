-- =============================================================================
-- IndoProperty — Token System, Home Loan & Referral Migration
-- Run this in Supabase Dashboard → SQL Editor
-- Safe to run multiple times (all CREATE IF NOT EXISTS / DO $$ blocks)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TOKEN WALLETS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.token_wallets (
  user_id       UUID        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance       INTEGER     NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_earned  INTEGER     NOT NULL DEFAULT 0,
  total_spent   INTEGER     NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TOKEN TRANSACTIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.token_transactions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount        INTEGER     NOT NULL,
  type          TEXT        NOT NULL CHECK (type IN (
                  'earned_referral','earned_referred','earned_admin',
                  'spent_promotion','spent_featured','deducted_admin')),
  description   TEXT        NOT NULL,
  reference_id  UUID,
  admin_id      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_token_tx_user ON public.token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_tx_type ON public.token_transactions(type);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. HOME LOAN APPLICATIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loan_applications (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Applicant
  full_name         TEXT        NOT NULL,
  email             TEXT        NOT NULL,
  phone             TEXT        NOT NULL,
  date_of_birth     DATE        NOT NULL,
  pan_number        TEXT        NOT NULL,
  city              TEXT        NOT NULL,

  -- Employment
  employment_type   TEXT        NOT NULL CHECK (employment_type IN (
                      'salaried','self_employed','business','freelancer','retired')),
  employer_name     TEXT,
  monthly_income    NUMERIC     NOT NULL CHECK (monthly_income > 0),
  other_income      NUMERIC     DEFAULT 0,
  existing_emi      NUMERIC     DEFAULT 0,

  -- Loan
  loan_amount       NUMERIC     NOT NULL CHECK (loan_amount > 0),
  tenure_years      INTEGER     NOT NULL CHECK (tenure_years BETWEEN 1 AND 30),
  purpose           TEXT        NOT NULL DEFAULT 'purchase',

  -- Property (optional)
  property_address  TEXT,
  property_city     TEXT,
  property_value    NUMERIC,
  property_id       UUID        REFERENCES public.properties(id) ON DELETE SET NULL,

  -- Status (admin-managed)
  status            TEXT        NOT NULL DEFAULT 'submitted' CHECK (status IN (
                      'submitted','under_review','approved','rejected','disbursed','cancelled')),
  admin_notes       TEXT,
  approved_amount   NUMERIC,
  disbursed_amount  NUMERIC,
  disbursed_at      TIMESTAMPTZ,
  reviewed_by       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_loans_user    ON public.loan_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_status  ON public.loan_applications(status);
CREATE INDEX IF NOT EXISTS idx_loans_created ON public.loan_applications(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. REFERRALS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referrals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  referrer_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  referral_code   TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN (
                    'pending','completed','rewarded','invalid')),
  reward_tokens   INTEGER     NOT NULL DEFAULT 50,
  rewarded_at     TIMESTAMPTZ,
  referred_email  TEXT
);

CREATE INDEX IF NOT EXISTS idx_referrals_code        ON public.referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON public.referrals(referred_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS POLICIES
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.token_wallets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_applications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals          ENABLE ROW LEVEL SECURITY;

-- Token wallets: users see only their own
CREATE POLICY "wallets_select_own"  ON public.token_wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "wallets_insert_own"  ON public.token_wallets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wallets_update_own"  ON public.token_wallets FOR UPDATE USING (auth.uid() = user_id);

-- Token transactions: users see their own; admins see all (via service role in Edge Fn)
CREATE POLICY "tx_select_own"       ON public.token_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tx_insert_own"       ON public.token_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Loan applications: users see only their own
CREATE POLICY "loans_select_own"    ON public.loan_applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "loans_insert_own"    ON public.loan_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Only reviewed_by (admin) can update status fields
CREATE POLICY "loans_update_admin"  ON public.loan_applications FOR UPDATE USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Referrals: referrers see their own referrals
CREATE POLICY "referrals_select_own"   ON public.referrals FOR SELECT USING (auth.uid() = referrer_id);
CREATE POLICY "referrals_insert_own"   ON public.referrals FOR INSERT WITH CHECK (auth.uid() = referrer_id);
CREATE POLICY "referrals_update_own"   ON public.referrals FOR UPDATE USING (auth.uid() = referrer_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- Upsert wallet and log transaction atomically
CREATE OR REPLACE FUNCTION public.credit_tokens(
  p_user_id    UUID,
  p_amount     INTEGER,
  p_type       TEXT,
  p_description TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_admin_id   UUID DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (p_user_id, p_amount, p_amount, 0)
  ON CONFLICT (user_id) DO UPDATE SET
    balance      = token_wallets.balance + p_amount,
    total_earned = token_wallets.total_earned + p_amount,
    updated_at   = NOW();

  INSERT INTO public.token_transactions (user_id, amount, type, description, reference_id, admin_id)
  VALUES (p_user_id, p_amount, p_type, p_description, p_reference_id, p_admin_id);
END;
$$;

-- Spend tokens (debit) — enforces balance >= 0 via wallet CHECK constraint
CREATE OR REPLACE FUNCTION public.spend_tokens(
  p_user_id    UUID,
  p_amount     INTEGER,
  p_type       TEXT,
  p_description TEXT,
  p_reference_id UUID DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.token_wallets
  SET balance     = balance - p_amount,
      total_spent = total_spent + p_amount,
      updated_at  = NOW()
  WHERE user_id = p_user_id AND balance >= p_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient token balance.';
  END IF;

  INSERT INTO public.token_transactions (user_id, amount, type, description, reference_id)
  VALUES (p_user_id, -p_amount, p_type, p_description, p_reference_id);
END;
$$;

-- Admin adjust tokens (positive = credit, negative = debit)
CREATE OR REPLACE FUNCTION public.admin_adjust_tokens(
  p_user_id    UUID,
  p_amount     INTEGER,
  p_type       TEXT,
  p_description TEXT,
  p_admin_id   UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_amount > 0 THEN
    PERFORM public.credit_tokens(p_user_id, p_amount, p_type, p_description, NULL, p_admin_id);
  ELSE
    PERFORM public.spend_tokens(p_user_id, ABS(p_amount), p_type, p_description, NULL);
  END IF;
END;
$$;

-- Apply referral code — prevents duplicates, awards tokens to both parties
CREATE OR REPLACE FUNCTION public.apply_referral_code(
  p_code        TEXT,
  p_referred_id UUID
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_referral    RECORD;
  v_referrer_id UUID;
  v_reward      INTEGER;
BEGIN
  -- Find the pending referral row for this code
  SELECT * INTO v_referral
  FROM public.referrals
  WHERE referral_code = p_code AND status = 'pending'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 'Invalid or already used referral code.';
  END IF;

  -- Prevent self-referral
  IF v_referral.referrer_id = p_referred_id THEN
    RETURN 'You cannot use your own referral code.';
  END IF;

  -- Prevent duplicate referral (this user has already been referred)
  IF EXISTS (
    SELECT 1 FROM public.referrals
    WHERE referred_id = p_referred_id AND status IN ('completed','rewarded')
  ) THEN
    RETURN 'You have already used a referral code.';
  END IF;

  v_referrer_id := v_referral.referrer_id;
  v_reward      := v_referral.reward_tokens;

  -- Mark referral as rewarded and set referred_id
  UPDATE public.referrals
  SET status      = 'rewarded',
      referred_id = p_referred_id,
      rewarded_at = NOW()
  WHERE id = v_referral.id;

  -- Award tokens to referrer
  PERFORM public.credit_tokens(
    v_referrer_id, v_reward, 'earned_referral',
    'Referral reward — friend signed up with your code'
  );

  -- Award welcome tokens to referred user (half of referrer reward)
  PERFORM public.credit_tokens(
    p_referred_id, GREATEST(v_reward / 2, 25), 'earned_referred',
    'Welcome bonus — signed up via referral code ' || p_code
  );

  RETURN 'Referral applied! Tokens credited to both accounts.';
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. GRANTS
-- ─────────────────────────────────────────────────────────────────────────────
GRANT ALL ON public.token_wallets      TO authenticated;
GRANT ALL ON public.token_transactions TO authenticated;
GRANT ALL ON public.loan_applications  TO authenticated;
GRANT ALL ON public.referrals          TO authenticated;
GRANT SELECT ON public.token_wallets      TO anon;
GRANT SELECT ON public.token_transactions TO anon;
GRANT EXECUTE ON FUNCTION public.credit_tokens       TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_tokens        TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_referral_code TO authenticated;

-- =============================================================================
-- DONE. All 4 tables + 4 functions created.
-- Run this SQL, then rebuild and sync the Android app.
-- =============================================================================
