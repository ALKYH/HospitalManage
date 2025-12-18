-- Add email column to profiles if missing
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL;
