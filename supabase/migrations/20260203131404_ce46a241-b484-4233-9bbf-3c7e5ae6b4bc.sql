-- Backfill NULL token_created_at values with the record's created_at timestamp
-- This ensures all existing tokens have a valid creation date for expiration checks
UPDATE public.equipments 
SET token_created_at = created_at 
WHERE token_created_at IS NULL AND confirmation_token IS NOT NULL;