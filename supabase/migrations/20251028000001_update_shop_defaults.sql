-- Add new columns for default HSN code and discount
ALTER TABLE shop_details 
ADD COLUMN IF NOT EXISTS default_hsn_code TEXT DEFAULT '3004',
ADD COLUMN IF NOT EXISTS default_discount NUMERIC DEFAULT 10;

-- Set default values for existing records
UPDATE shop_details 
SET default_hsn_code = '3004' 
WHERE default_hsn_code IS NULL;

UPDATE shop_details 
SET default_discount = 10 
WHERE default_discount IS NULL;

-- Drop old columns (commented out for safety - uncomment after verifying data migration)
-- ALTER TABLE shop_details DROP COLUMN IF EXISTS default_cgst;
-- ALTER TABLE shop_details DROP COLUMN IF EXISTS default_sgst;
