# Database Status & Migrations

## ✅ All Migrations Applied

### 1. Initial Schema (20251024015333)
Created the complete database structure:
- `shop_details` - Business information and configuration
- `bills` - Bill headers with customer and tax information
- `bill_items` - Line items for each bill
- `medicines` - Autocomplete suggestions

### 2. Add Optional Fields (20251026112224)
Added temporary fields for testing:
- `hsn_code`
- `batch_no`
- `expiry_date`

### 3. Remove Unused Fields (20251028070941)
**LATEST MIGRATION** - Cleaned up unused fields
- Removed `hsn_code` (not used in app)
- Removed `batch_no` (not used in app)
- Removed `expiry_date` (not used in app)

---

## Current Database Schema

### bill_items table (8 columns - FINAL)
1. `id` (uuid) - Primary key
2. `bill_id` (uuid) - Foreign key to bills table
3. `medicine_name` (text) - Medicine/product name
4. `quantity` (numeric) - Quantity purchased
5. `price_per_unit` (numeric) - Price per unit
6. `total` (numeric) - Line total (qty × price)
7. `ocr_confidence` (numeric, optional) - OCR confidence score
8. `created_at` (timestamp) - Record creation time

### Other tables remain unchanged:
- `shop_details` (14 columns)
- `bills` (15 columns)
- `medicines` (5 columns)

---

## API Configuration

### Google Vision API Key
✅ **Configured in database:** `AIzaSyDXvMuh9sZ_gE6sKGlDXu_GjTTCM2sTw3M`

⚠️ **Action Required:** Configure Android app restrictions in Google Cloud Console
- See `GOOGLE_VISION_SETUP.md` for detailed instructions
- Package: `com.friendmedical.billing`
- SHA-1: `E7:DE:95:E3:F2:5B:8D:D5:ED:95:59:FF:CA:09:C9:8E:E1:0B:3C:D1`

---

## Database is Ready ✅

All unused fields have been removed. The database schema now matches exactly what the app uses. No further migrations needed unless new features are added.
