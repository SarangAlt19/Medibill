export interface ShopDetails {
  id: string;
  shop_name: string;
  address: string;
  gst_number: string;
  phone: string;
  email: string;
  license_number: string;
  bill_number_prefix: string;
  bill_number_counter: number;
  default_hsn_code: string;
  default_discount: number;
  google_vision_api_key: string;
  created_at: string;
  updated_at: string;
}

export interface Bill {
  id: string;
  bill_number: string;
  bill_date: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  subtotal: number;
  cgst_percentage: number;
  cgst_amount: number;
  sgst_percentage: number;
  sgst_amount: number;
  grand_total: number;
  pdf_uri: string;
  created_at: string;
  updated_at: string;
}

export interface BillItem {
  id: string;
  bill_id: string;
  medicine_name: string;
  quantity: number;
  price_per_unit: number;
  total: number;
  hsn_code?: string;
  batch_no?: string;
  expiry_date?: string;
  ocr_confidence?: number;
  created_at: string;
}

export interface Medicine {
  id: string;
  name: string;
  usage_count: number;
  last_used_at: string;
  created_at: string;
}

export interface BillFormData {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  items: BillItemInput[];
  cgst_percentage: number;
  sgst_percentage: number;
}

export interface BillItemInput {
  id: string;
  medicine_name: string;
  quantity: string;
  price_per_unit: string;
  total: number;
  hsn_code?: string;
  batch_no?: string;
  expiry_date?: string;
  ocr_confidence?: number;
}

export interface BillWithItems extends Bill {
  items: BillItem[];
}

export interface OCRResult {
  medicine_name: string;
  quantity: string;
  price_per_unit: string;
  confidence: number;
}
