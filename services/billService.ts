import { supabase } from '@/lib/supabase';
import { Bill, BillItem, BillWithItems, BillFormData } from '@/types/database';
import { incrementBillCounter, getShopDetails } from './shopService';
import { formatBillNumber } from '@/utils/calculations';

export const createBill = async (formData: BillFormData): Promise<BillWithItems | null> => {
  try {
    const shopDetails = await getShopDetails();
    if (!shopDetails) {
      throw new Error('Shop details not found');
    }

    const counter = await incrementBillCounter();
    const year = new Date().getFullYear();
    const billNumber = formatBillNumber(shopDetails.bill_number_prefix, counter, year);

    const subtotal = formData.items.reduce((sum, item) => sum + item.total, 0);
    // cgst_percentage is 0, sgst_percentage stores discount
    const discountAmount = Math.round(subtotal * formData.sgst_percentage) / 100;
    const grandTotal = Math.round((subtotal - discountAmount) * 100) / 100;

    const { data: billData, error: billError } = await supabase
      .from('bills')
      .insert({
        bill_number: billNumber,
        bill_date: new Date().toISOString().split('T')[0],
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        customer_address: formData.customer_address,
        subtotal,
        cgst_percentage: formData.cgst_percentage, // 0
        cgst_amount: 0,
        sgst_percentage: formData.sgst_percentage, // discount percentage
        sgst_amount: discountAmount, // discount amount
        grand_total: grandTotal,
      })
      .select()
      .single();

    if (billError) {
      console.error('Error creating bill:', billError);
      return null;
    }

    const itemsToInsert = formData.items.map((item) => ({
      bill_id: billData.id,
      medicine_name: item.medicine_name,
      quantity: parseFloat(item.quantity),
      price_per_unit: parseFloat(item.price_per_unit),
      total: item.total,
      hsn_code: item.hsn_code || '',
      batch_no: item.batch_no || '',
      expiry_date: item.expiry_date || '',
      ocr_confidence: item.ocr_confidence,
    }));

    const { data: itemsData, error: itemsError } = await supabase
      .from('bill_items')
      .insert(itemsToInsert)
      .select();

    if (itemsError) {
      console.error('Error creating bill items:', itemsError);
      await supabase.from('bills').delete().eq('id', billData.id);
      return null;
    }

    await updateMedicineUsage(formData.items.map((item) => item.medicine_name));

    return {
      ...billData,
      items: itemsData,
    };
  } catch (error) {
    console.error('Error in createBill:', error);
    return null;
  }
};

export const getBills = async (
  limit: number = 100,
  offset: number = 0
): Promise<Bill[]> => {
  const { data, error } = await supabase
    .from('bills')
    .select('*')
    .order('bill_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching bills:', error);
    return [];
  }

  return data || [];
};

export const getBillById = async (id: string): Promise<BillWithItems | null> => {
  const { data: billData, error: billError } = await supabase
    .from('bills')
    .select('*')
    .eq('id', id)
    .single();

  if (billError) {
    console.error('Error fetching bill:', billError);
    return null;
  }

  const { data: itemsData, error: itemsError } = await supabase
    .from('bill_items')
    .select('*')
    .eq('bill_id', id)
    .order('created_at', { ascending: true });

  if (itemsError) {
    console.error('Error fetching bill items:', itemsError);
    return null;
  }

  return {
    ...billData,
    items: itemsData || [],
  };
};

export const searchBills = async (searchTerm: string): Promise<Bill[]> => {
  const { data, error } = await supabase
    .from('bills')
    .select('*')
    .or(`bill_number.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%`)
    .order('bill_date', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error searching bills:', error);
    return [];
  }

  return data || [];
};

export const updateMedicineUsage = async (medicineNames: string[]): Promise<void> => {
  const uniqueNames = [...new Set(medicineNames)];

  for (const name of uniqueNames) {
    const { data: existing } = await supabase
      .from('medicines')
      .select('*')
      .eq('name', name)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('medicines')
        .update({
          usage_count: existing.usage_count + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('medicines').insert({
        name,
        usage_count: 1,
        last_used_at: new Date().toISOString(),
      });
    }
  }
};

export const getMedicineSuggestions = async (searchTerm: string): Promise<string[]> => {
  if (!searchTerm || searchTerm.length < 2) {
    return [];
  }

  const { data, error } = await supabase
    .from('medicines')
    .select('name')
    .ilike('name', `${searchTerm}%`)
    .order('usage_count', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching medicine suggestions:', error);
    return [];
  }

  return data?.map((m) => m.name) || [];
};

export const deleteBill = async (billId: string): Promise<boolean> => {
  try {
    // First delete bill items
    const { error: itemsError } = await supabase
      .from('bill_items')
      .delete()
      .eq('bill_id', billId);

    if (itemsError) {
      console.error('Error deleting bill items:', itemsError);
      return false;
    }

    // Then delete the bill
    const { error: billError } = await supabase
      .from('bills')
      .delete()
      .eq('id', billId);

    if (billError) {
      console.error('Error deleting bill:', billError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteBill:', error);
    return false;
  }
};

export const deleteBillsOlderThan = async (date: Date): Promise<number> => {
  try {
    const dateString = date.toISOString().split('T')[0];
    
    // Get bills to delete
    const { data: billsToDelete, error: fetchError } = await supabase
      .from('bills')
      .select('id')
      .lt('bill_date', dateString);

    if (fetchError || !billsToDelete) {
      console.error('Error fetching bills to delete:', fetchError);
      return 0;
    }

    const billIds = billsToDelete.map(b => b.id);
    
    if (billIds.length === 0) {
      return 0;
    }

    // Delete bill items first
    const { error: itemsError } = await supabase
      .from('bill_items')
      .delete()
      .in('bill_id', billIds);

    if (itemsError) {
      console.error('Error deleting bill items:', itemsError);
      return 0;
    }

    // Delete bills
    const { error: billsError } = await supabase
      .from('bills')
      .delete()
      .in('id', billIds);

    if (billsError) {
      console.error('Error deleting bills:', billsError);
      return 0;
    }

    return billIds.length;
  } catch (error) {
    console.error('Error in deleteBillsOlderThan:', error);
    return 0;
  }
};

export const updateBill = async (
  billId: string,
  formData: BillFormData
): Promise<BillWithItems | null> => {
  try {
    const subtotal = formData.items.reduce((sum, item) => sum + item.total, 0);
    // cgst_percentage is 0, sgst_percentage stores discount
    const discountAmount = Math.round(subtotal * formData.sgst_percentage) / 100;
    const grandTotal = Math.round((subtotal - discountAmount) * 100) / 100;

    // Update the bill
    const { data: billData, error: billError } = await supabase
      .from('bills')
      .update({
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        customer_address: formData.customer_address,
        subtotal,
        cgst_percentage: formData.cgst_percentage, // 0
        cgst_amount: 0,
        sgst_percentage: formData.sgst_percentage, // discount percentage
        sgst_amount: discountAmount, // discount amount
        grand_total: grandTotal,
      })
      .eq('id', billId)
      .select()
      .single();

    if (billError) {
      console.error('Error updating bill:', billError);
      return null;
    }

    // Delete existing bill items
    const { error: deleteError } = await supabase
      .from('bill_items')
      .delete()
      .eq('bill_id', billId);

    if (deleteError) {
      console.error('Error deleting old bill items:', deleteError);
      return null;
    }

    // Insert new bill items
    const itemsToInsert = formData.items.map((item) => ({
      bill_id: billId,
      medicine_name: item.medicine_name,
      quantity: parseFloat(item.quantity),
      price_per_unit: parseFloat(item.price_per_unit),
      total: item.total,
      hsn_code: item.hsn_code || '',
      batch_no: item.batch_no || '',
      expiry_date: item.expiry_date || '',
      ocr_confidence: item.ocr_confidence,
    }));

    const { data: itemsData, error: itemsError } = await supabase
      .from('bill_items')
      .insert(itemsToInsert)
      .select();

    if (itemsError) {
      console.error('Error creating bill items:', itemsError);
      return null;
    }

    await updateMedicineUsage(formData.items.map((item) => item.medicine_name));

    return {
      ...billData,
      items: itemsData,
    };
  } catch (error) {
    console.error('Error in updateBill:', error);
    return null;
  }
};
