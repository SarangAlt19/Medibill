/*
  # Remove Unused Fields from Bill Items

  ## Changes
  This migration removes the optional fields that are not being used in the application:
  - `hsn_code` - HSN code field
  - `batch_no` - Batch number field
  - `expiry_date` - Expiry date field
  
  These fields were added earlier but are not used in the current implementation.
*/

-- Remove unused columns from bill_items table
ALTER TABLE bill_items
DROP COLUMN IF EXISTS hsn_code,
DROP COLUMN IF EXISTS batch_no,
DROP COLUMN IF EXISTS expiry_date;