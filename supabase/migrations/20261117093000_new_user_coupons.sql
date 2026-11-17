-- Coupons can be limited to accounts created in the last 7 days.
-- The New tag itself is calculated from profiles.created_at and does not need a stored flag.

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS new_users_only boolean NOT NULL DEFAULT false;
