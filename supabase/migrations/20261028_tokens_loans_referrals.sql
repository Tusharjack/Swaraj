-- =============================================================================
-- MIGRATION: 20261028_tokens_loans_referrals.sql
-- IndoProperty Token System, Home Loan Facilitation & Referral System
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. TOKEN WALLETS
--    Platform credits (not cryptocurrency) for each registered user.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.token_wallets (
  user_id        UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance        INTEGER NOT NULL DEFAULT 25 CHECK (balance >= 0),
  total_earned   INTEGER NOT NULL DEFAULT 25 CHECK (total_earned >= 0),
  total_spent    INTEGER NOT NULL DEFAULT 0 CHECK (total_spent >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. TOKEN TRANSACTIONS
--    Immutable audit trail of all token credits and debits.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.token_transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount         INTEGER NOT NULL, -- positive for credit, negative for debit
  type           TEXT NOT NULL CHECK (type IN (
                   'earned_referral',
                   'earned_referred',
                   'earned_admin',
                   'spent_promotion',
                   'spent_featured',
                   'deducted_admin'
                 )),
  description    TEXT NOT NULL,
  reference_id   TEXT,             -- property_id, reel_id, or referral_id
  admin_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_token_tx_user ON public.token_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_token_tx_created ON public.token_transactions (created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. HOME LOAN APPLICATIONS
--    Enquiry and application tracking with authorized lender assessment.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loan_applications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Applicant Details
  full_name        TEXT NOT NULL,
  email            TEXT NOT NULL,
  phone            TEXT NOT NULL,
  date_of_birth    DATE NOT NULL,
  pan_number       TEXT NOT NULL,
  city             TEXT NOT NULL,

  -- Employment & Income
  employment_type  TEXT NOT NULL CHECK (employment_type IN ('salaried', 'self_employed', 'business', 'freelancer', 'retired')),
  employer_name    TEXT,
  monthly_income   NUMERIC NOT NULL CHECK (monthly_income > 0),
  other_income     NUMERIC DEFAULT 0,
  existing_emi     NUMERIC DEFAULT 0,

  -- Loan Requirements
  loan_amount      NUMERIC NOT NULL CHECK (loan_amount > 0),
  tenure_years     INTEGER NOT NULL CHECK (tenure_years >= 1 AND tenure_years <= 35),
  purpose          TEXT NOT NULL,

  -- Property Details (Optional / linked listing)
  property_address TEXT,
  property_city    TEXT,
  property_value   NUMERIC,
  property_id      UUID REFERENCES public.properties(id) ON DELETE SET NULL,

  -- Status & Admin Tracking (Lender verification required for approval/disbursement)
  status           TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
                     'submitted', 'under_review', 'approved', 'rejected', 'disbursed', 'cancelled'
                   )),
  admin_notes      TEXT,
  approved_amount  NUMERIC,
  disbursed_amount NUMERIC,
  disbursed_at     TIMESTAMPTZ,
  reviewed_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_loans_user ON public.loan_applications (user_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON public.loan_applications (status);
CREATE INDEX IF NOT EXISTS idx_loans_created ON public.loan_applications (created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. REFERRALS
--    Unique referral tracking, shareable links, and duplicate prevention.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referrals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  referrer_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  referral_code  TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rewarded', 'invalid')),
  reward_tokens  INTEGER NOT NULL DEFAULT 50,
  rewarded_at    TIMESTAMPTZ,
  referred_email TEXT
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals (referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals (UPPER(referral_code));
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_code_unique ON public.referrals (referral_code) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_referred_unique ON public.referrals (referred_id) WHERE status IN ('completed', 'rewarded');

-- ---------------------------------------------------------------------------
-- 5. PRIVATE STORAGE BUCKET FOR LOAN DOCUMENTS (PAN, Salary slips, etc.)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('loan_documents', 'loan_documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- ---------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS)
-- ---------------------------------------------------------------------------
ALTER TABLE public.token_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Helper check for admin role
CREATE OR REPLACE FUNCTION public.is_admin(p_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_uid AND role = 'admin'
  );
$$;

-- A. Token Wallets Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'wallets_select' AND tablename = 'token_wallets') THEN
    CREATE POLICY "wallets_select" ON public.token_wallets
      FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'wallets_admin_update' AND tablename = 'token_wallets') THEN
    CREATE POLICY "wallets_admin_update" ON public.token_wallets
      FOR UPDATE USING (public.is_admin(auth.uid()));
  END IF;
END $$;

-- B. Token Transactions Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'transactions_select' AND tablename = 'token_transactions') THEN
    CREATE POLICY "transactions_select" ON public.token_transactions
      FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'transactions_admin_insert' AND tablename = 'token_transactions') THEN
    CREATE POLICY "transactions_admin_insert" ON public.token_transactions
      FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

-- C. Loan Applications Policies (Confidential applicant details & statistics)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'loans_select' AND tablename = 'loan_applications') THEN
    CREATE POLICY "loans_select" ON public.loan_applications
      FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'loans_insert' AND tablename = 'loan_applications') THEN
    CREATE POLICY "loans_insert" ON public.loan_applications
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'loans_admin_update' AND tablename = 'loan_applications') THEN
    CREATE POLICY "loans_admin_update" ON public.loan_applications
      FOR UPDATE USING (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'loans_admin_delete' AND tablename = 'loan_applications') THEN
    CREATE POLICY "loans_admin_delete" ON public.loan_applications
      FOR DELETE USING (public.is_admin(auth.uid()));
  END IF;
END $$;

-- D. Referrals Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'referrals_select' AND tablename = 'referrals') THEN
    CREATE POLICY "referrals_select" ON public.referrals
      FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id OR public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'referrals_insert' AND tablename = 'referrals') THEN
    CREATE POLICY "referrals_insert" ON public.referrals
      FOR INSERT WITH CHECK (auth.uid() = referrer_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'referrals_admin_all' AND tablename = 'referrals') THEN
    CREATE POLICY "referrals_admin_all" ON public.referrals
      FOR ALL USING (public.is_admin(auth.uid()));
  END IF;
END $$;

-- E. Loan Documents Storage Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'loan_doc_select' AND tablename = 'objects') THEN
    CREATE POLICY "loan_doc_select" ON storage.objects
      FOR SELECT USING (
        bucket_id = 'loan_documents' AND
        ( (storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid()) )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'loan_doc_insert' AND tablename = 'objects') THEN
    CREATE POLICY "loan_doc_insert" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'loan_documents' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7. SECURE DATABASE RPC FUNCTIONS (SECURITY DEFINER)
-- ---------------------------------------------------------------------------

-- 7.1 spend_tokens
-- Allows a user to spend platform credit tokens (e.g., to promote a property).
CREATE OR REPLACE FUNCTION public.spend_tokens(
  p_user_id      UUID,
  p_amount       INTEGER,
  p_type         TEXT,
  p_description  TEXT,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_curr_balance INTEGER;
  v_new_balance  INTEGER;
BEGIN
  -- Authenticated user must spend their own tokens (or admin)
  IF auth.uid() IS NULL OR (auth.uid() != p_user_id AND NOT public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized to spend tokens for this account.';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Spend amount must be greater than zero.';
  END IF;

  -- Ensure wallet exists
  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (p_user_id, 25, 25, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Lock row for update
  SELECT balance INTO v_curr_balance
  FROM public.token_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_curr_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient token balance (required %, available %).', p_amount, v_curr_balance;
  END IF;

  -- Deduct
  UPDATE public.token_wallets
  SET balance     = balance - p_amount,
      total_spent = total_spent + p_amount,
      updated_at  = NOW()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  -- Record transaction
  INSERT INTO public.token_transactions (user_id, amount, type, description, reference_id)
  VALUES (p_user_id, -p_amount, p_type, p_description, p_reference_id);

  -- If spending on property promotion, mark property as featured
  IF p_type = 'spent_promotion' AND p_reference_id IS NOT NULL THEN
    BEGIN
      UPDATE public.properties
      SET featured = TRUE,
          updated_at = NOW()
      WHERE id = p_reference_id::UUID;
    EXCEPTION WHEN OTHERS THEN
      -- In case reference_id is not a direct UUID
      NULL;
    END;
  END IF;

  RETURN v_new_balance;
END;
$$;

-- 7.2 admin_adjust_tokens
-- Allows admins to award or deduct tokens for any user securely.
CREATE OR REPLACE FUNCTION public.admin_adjust_tokens(
  p_user_id      UUID,
  p_amount       INTEGER,
  p_type         TEXT,
  p_description  TEXT,
  p_admin_id     UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
  v_actual_admin UUID;
BEGIN
  v_actual_admin := COALESCE(auth.uid(), p_admin_id);

  IF v_actual_admin IS NULL OR NOT public.is_admin(v_actual_admin) THEN
    RAISE EXCEPTION 'Only platform administrators can manually adjust token balances.';
  END IF;

  -- Ensure target wallet exists
  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (p_user_id, 25, 25, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Update wallet with bounds checking
  UPDATE public.token_wallets
  SET balance      = GREATEST(0, balance + p_amount),
      total_earned = total_earned + CASE WHEN p_amount > 0 THEN p_amount ELSE 0 END,
      total_spent  = total_spent + CASE WHEN p_amount < 0 THEN ABS(p_amount) ELSE 0 END,
      updated_at   = NOW()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  -- Record audit transaction
  INSERT INTO public.token_transactions (user_id, amount, type, description, admin_id)
  VALUES (p_user_id, p_amount, p_type, p_description, v_actual_admin);

  RETURN v_new_balance;
END;
$$;

-- 7.3 apply_referral_code
-- Applies a referral code for a newly registered user, preventing duplicates & self-referrals.
CREATE OR REPLACE FUNCTION public.apply_referral_code(
  p_code        TEXT,
  p_referred_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_code    TEXT;
  v_referrer_id   UUID;
  v_referral_id   UUID;
  v_ref_status    TEXT;
  v_reward_tokens INTEGER := 50;
  v_welcome_bonus INTEGER := 25;
BEGIN
  -- Validate caller
  IF auth.uid() IS NULL OR (auth.uid() != p_referred_id AND NOT public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized to apply referral code for this user.';
  END IF;

  v_clean_code := UPPER(TRIM(p_code));

  IF v_clean_code = '' THEN
    RAISE EXCEPTION 'Please provide a valid referral code.';
  END IF;

  -- 1. Anti-abuse check: Has this user already received a referral reward?
  IF EXISTS (
    SELECT 1 FROM public.referrals
    WHERE referred_id = p_referred_id AND status IN ('completed', 'rewarded')
  ) THEN
    RAISE EXCEPTION 'You have already redeemed a referral reward on this account.';
  END IF;

  -- 2. Find the referral record or owner of the code
  SELECT id, referrer_id, status, reward_tokens
  INTO v_referral_id, v_referrer_id, v_ref_status, v_reward_tokens
  FROM public.referrals
  WHERE UPPER(referral_code) = v_clean_code
    AND status != 'invalid'
  ORDER BY created_at ASC
  LIMIT 1;

  -- If not in referrals table, check if code matches deterministic pattern IP-XXXXXX of a profile
  IF v_referrer_id IS NULL THEN
    SELECT id INTO v_referrer_id
    FROM public.profiles
    WHERE 'IP-' || UPPER(SUBSTRING(REPLACE(id::TEXT, '-', '') FROM 1 FOR 6)) = v_clean_code;
  END IF;

  IF v_referrer_id IS NULL THEN
    RAISE EXCEPTION 'Referral code "%" was not found or is invalid.', v_clean_code;
  END IF;

  -- 3. Anti-abuse check: Self-referral prohibited
  IF v_referrer_id = p_referred_id THEN
    RAISE EXCEPTION 'You cannot use your own referral code.';
  END IF;

  -- 4. Reward Referrer (+50 tokens)
  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (v_referrer_id, 25, 25, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.token_wallets
  SET balance      = balance + v_reward_tokens,
      total_earned = total_earned + v_reward_tokens,
      updated_at   = NOW()
  WHERE user_id = v_referrer_id;

  INSERT INTO public.token_transactions (user_id, amount, type, description, reference_id)
  VALUES (v_referrer_id, v_reward_tokens, 'earned_referral', 'Referral reward for inviting a new user', p_referred_id::TEXT);

  -- 5. Reward Referred User (+25 bonus tokens)
  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (p_referred_id, 25, 25, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.token_wallets
  SET balance      = balance + v_welcome_bonus,
      total_earned = total_earned + v_welcome_bonus,
      updated_at   = NOW()
  WHERE user_id = p_referred_id;

  INSERT INTO public.token_transactions (user_id, amount, type, description, reference_id)
  VALUES (p_referred_id, v_welcome_bonus, 'earned_referred', 'Bonus tokens for signing up with referral code ' || v_clean_code, v_referrer_id::TEXT);

  -- 6. Record Referral status
  IF v_referral_id IS NOT NULL AND v_ref_status = 'pending' THEN
    UPDATE public.referrals
    SET referred_id = p_referred_id,
        status = 'rewarded',
        rewarded_at = NOW()
    WHERE id = v_referral_id;
  ELSE
    INSERT INTO public.referrals (referrer_id, referred_id, referral_code, status, reward_tokens, rewarded_at)
    VALUES (v_referrer_id, p_referred_id, v_clean_code, 'rewarded', v_reward_tokens, NOW());
  END IF;

  -- 7. Add notification for both users if notifications table exists
  BEGIN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      v_referrer_id,
      'Referral Reward Credited! 🎉',
      'A user joined using your referral code. +' || v_reward_tokens || ' tokens credited to your wallet.',
      'system'
    );

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      p_referred_id,
      'Welcome Bonus Credited! 🎁',
      'Referral code applied successfully. +' || v_welcome_bonus || ' tokens have been added to your wallet!',
      'system'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN 'Referral applied successfully! ' || v_welcome_bonus || ' bonus tokens have been credited to your wallet.';
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. EXTEND handle_new_user TRIGGER
--    Auto-creates token wallet with 25 welcome tokens and default referral code.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref_code TEXT;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name, role, avatar_url, city)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=' || NEW.email
    ),
    COALESCE(NEW.raw_user_meta_data->>'city', 'Mumbai')
  )
  ON CONFLICT (id) DO NOTHING;

  -- Initialize Token Wallet with 25 welcome credits
  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (NEW.id, 25, 25, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Record Welcome Transaction
  INSERT INTO public.token_transactions (user_id, amount, type, description)
  VALUES (NEW.id, 25, 'earned_referred', 'Welcome bonus platform credits')
  ON CONFLICT DO NOTHING;

  -- Generate unique default referral code for new user
  v_ref_code := 'IP-' || UPPER(SUBSTRING(REPLACE(NEW.id::TEXT, '-', '') FROM 1 FOR 6));
  INSERT INTO public.referrals (referrer_id, referral_code, status, reward_tokens)
  VALUES (NEW.id, v_ref_code, 'pending', 50)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Recreate trigger if needed
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 9. PERMISSIONS
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_tokens(UUID, INTEGER, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_tokens(UUID, INTEGER, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(TEXT, UUID) TO authenticated;
