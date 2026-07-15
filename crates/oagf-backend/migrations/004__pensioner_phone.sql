-- Adds the beneficiary's own phone number, distinct from the existing next-of-kin phone.
ALTER TABLE pensioners ADD COLUMN IF NOT EXISTS phone TEXT;
