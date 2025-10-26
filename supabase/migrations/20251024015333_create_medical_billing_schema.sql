/*
  # Friend Medical Billing - Database Schema

  ## Overview
  This migration creates the complete database structure for the Friend Medical Billing app,
  including tables for shop configuration, bills, bill items, and medicine autocomplete.

  ## New Tables
  
  ### 1. `shop_details`
  Stores the shop's business information and billing preferences.
  - `id` (uuid, primary key) - Unique identifier
  - `shop_name` (text) - Name of the medical shop (default: "Friend Medical")
  - `address` (text) - Shop address for bill header
  - `gst_number` (text) - GST registration number
  - `phone` (text) - Contact phone number
  - `email` (text, optional) - Email address
  - `license_number` (text, optional) - Medical shop license number
  - `bill_number_prefix` (text) - Prefix for bill numbers (default: "FM")
  - `bill_number_counter` (integer) - Auto-increment counter for bill numbers
  - `default_cgst` (decimal) - Default CGST percentage (default: 6.0)
  - `default_sgst` (decimal) - Default SGST percentage (default: 6.0)
  - `google_vision_api_key` (text, optional) - API key for OCR
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. `bills`
  Stores generated bills with customer and total information.
  - `id` (uuid, primary key) - Unique bill identifier
  - `bill_number` (text, unique) - Human-readable bill number (e.g., "FM-2025-0001")
  - `bill_date` (date) - Date of bill generation
  - `customer_name` (text, optional) - Customer name
  - `customer_phone` (text, optional) - Customer phone number
  - `customer_address` (text, optional) - Customer address
  - `subtotal` (decimal) - Sum of all items before tax
  - `cgst_percentage` (decimal) - CGST percentage applied
  - `cgst_amount` (decimal) - Calculated CGST amount
  - `sgst_percentage` (decimal) - SGST percentage applied
  - `sgst_amount` (decimal) - Calculated SGST amount
  - `grand_total` (decimal) - Final total including all taxes
  - `pdf_uri` (text, optional) - Local storage path to generated PDF
  - `created_at` (timestamptz) - Bill creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 3. `bill_items`
  Stores individual line items for each bill.
  - `id` (uuid, primary key) - Unique item identifier
  - `bill_id` (uuid, foreign key) - Reference to parent bill
  - `medicine_name` (text) - Name of medicine/product
  - `quantity` (decimal) - Quantity purchased
  - `price_per_unit` (decimal) - Price per unit in rupees
  - `total` (decimal) - Line item total (quantity × price_per_unit)
  - `ocr_confidence` (decimal, optional) - OCR extraction confidence (0-1)
  - `created_at` (timestamptz) - Record creation timestamp

  ### 4. `medicines`
  Stores unique medicine names for autocomplete functionality.
  - `id` (uuid, primary key) - Unique identifier
  - `name` (text, unique) - Medicine name
  - `usage_count` (integer) - Number of times used in bills
  - `last_used_at` (timestamptz) - Last usage timestamp
  - `created_at` (timestamptz) - Record creation timestamp

  ## Security
  - Enable Row Level Security (RLS) on all tables
  - Since this is a single-shop app without authentication, policies allow public access
  - In production, you would add proper authentication and restrict policies to authenticated users

  ## Indexes
  - Index on `bills.bill_number` for fast lookups
  - Index on `bills.bill_date` for date range queries
  - Index on `bills.customer_name` for search functionality
  - Index on `bill_items.bill_id` for efficient joins
  - Index on `medicines.name` for autocomplete searches
*/

-- Create shop_details table
CREATE TABLE IF NOT EXISTS shop_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_name text NOT NULL DEFAULT 'Friend Medical',
  address text NOT NULL DEFAULT '',
  gst_number text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text DEFAULT '',
  license_number text DEFAULT '',
  bill_number_prefix text NOT NULL DEFAULT 'FM',
  bill_number_counter integer NOT NULL DEFAULT 1,
  default_cgst decimal(5,2) NOT NULL DEFAULT 6.0,
  default_sgst decimal(5,2) NOT NULL DEFAULT 6.0,
  google_vision_api_key text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create bills table
CREATE TABLE IF NOT EXISTS bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number text UNIQUE NOT NULL,
  bill_date date NOT NULL DEFAULT CURRENT_DATE,
  customer_name text DEFAULT '',
  customer_phone text DEFAULT '',
  customer_address text DEFAULT '',
  subtotal decimal(10,2) NOT NULL DEFAULT 0,
  cgst_percentage decimal(5,2) NOT NULL DEFAULT 6.0,
  cgst_amount decimal(10,2) NOT NULL DEFAULT 0,
  sgst_percentage decimal(5,2) NOT NULL DEFAULT 6.0,
  sgst_amount decimal(10,2) NOT NULL DEFAULT 0,
  grand_total decimal(10,2) NOT NULL DEFAULT 0,
  pdf_uri text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create bill_items table
CREATE TABLE IF NOT EXISTS bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  medicine_name text NOT NULL,
  quantity decimal(10,2) NOT NULL,
  price_per_unit decimal(10,2) NOT NULL,
  total decimal(10,2) NOT NULL,
  ocr_confidence decimal(3,2) DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create medicines table for autocomplete
CREATE TABLE IF NOT EXISTS medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  usage_count integer NOT NULL DEFAULT 1,
  last_used_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bills_bill_number ON bills(bill_number);
CREATE INDEX IF NOT EXISTS idx_bills_bill_date ON bills(bill_date DESC);
CREATE INDEX IF NOT EXISTS idx_bills_customer_name ON bills(customer_name);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
CREATE INDEX IF NOT EXISTS idx_medicines_usage_count ON medicines(usage_count DESC);

-- Enable Row Level Security
ALTER TABLE shop_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (single-shop app without auth)
-- In production, replace 'true' with proper authentication checks

CREATE POLICY "Allow public read access to shop_details"
  ON shop_details FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to shop_details"
  ON shop_details FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to shop_details"
  ON shop_details FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public read access to bills"
  ON bills FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to bills"
  ON bills FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to bills"
  ON bills FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from bills"
  ON bills FOR DELETE
  USING (true);

CREATE POLICY "Allow public read access to bill_items"
  ON bill_items FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to bill_items"
  ON bill_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to bill_items"
  ON bill_items FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from bill_items"
  ON bill_items FOR DELETE
  USING (true);

CREATE POLICY "Allow public read access to medicines"
  ON medicines FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to medicines"
  ON medicines FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to medicines"
  ON medicines FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Insert default shop details
INSERT INTO shop_details (
  shop_name,
  address,
  phone,
  bill_number_prefix,
  default_cgst,
  default_sgst
) VALUES (
  'Friend Medical',
  'Enter your shop address here',
  'Enter phone number',
  'FM',
  6.0,
  6.0
) ON CONFLICT DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_shop_details_updated_at
  BEFORE UPDATE ON shop_details
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bills_updated_at
  BEFORE UPDATE ON bills
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();