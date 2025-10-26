-- Add HSN code, batch number, and expiry date fields to bill_items table
ALTER TABLE bill_items
ADD COLUMN IF NOT EXISTS hsn_code text DEFAULT '',
ADD COLUMN IF NOT EXISTS batch_no text DEFAULT '',
ADD COLUMN IF NOT EXISTS expiry_date text DEFAULT '';

-- Add comment
COMMENT ON COLUMN bill_items.hsn_code IS 'HSN (Harmonized System of Nomenclature) code for the medicine';
COMMENT ON COLUMN bill_items.batch_no IS 'Batch number of the medicine';
COMMENT ON COLUMN bill_items.expiry_date IS 'Expiry date of the medicine batch';
