/*
  # Add Optional Fields to Bill Items

  ## Changes
  This migration adds optional fields to the bill_items table for medical shops
  that want to track additional product information:
  
  ### New Columns
  - `hsn_code` (text) - HSN (Harmonized System of Nomenclature) code for the medicine
  - `batch_no` (text) - Batch number of the medicine
  - `expiry_date` (text) - Expiry date of the medicine batch
  
  All fields are optional with empty string defaults to maintain backward compatibility.
*/

-- Add HSN code, batch number, and expiry date fields to bill_items table
ALTER TABLE bill_items
ADD COLUMN IF NOT EXISTS hsn_code text DEFAULT '',
ADD COLUMN IF NOT EXISTS batch_no text DEFAULT '',
ADD COLUMN IF NOT EXISTS expiry_date text DEFAULT '';

-- Add comments for documentation
COMMENT ON COLUMN bill_items.hsn_code IS 'HSN (Harmonized System of Nomenclature) code for the medicine';
COMMENT ON COLUMN bill_items.batch_no IS 'Batch number of the medicine';
COMMENT ON COLUMN bill_items.expiry_date IS 'Expiry date of the medicine batch';