import { supabase } from '@/lib/supabase';
import { ShopDetails } from '@/types/database';

export const getShopDetails = async (): Promise<ShopDetails | null> => {
  const { data, error } = await supabase
    .from('shop_details')
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Error fetching shop details:', error);
    return null;
  }

  return data;
};

export const updateShopDetails = async (
  updates: Partial<ShopDetails>
): Promise<ShopDetails | null> => {
  const existing = await getShopDetails();

  if (!existing) {
    return null;
  }

  const { data, error } = await supabase
    .from('shop_details')
    .update(updates)
    .eq('id', existing.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating shop details:', error);
    return null;
  }

  return data;
};

export const incrementBillCounter = async (): Promise<number> => {
  const existing = await getShopDetails();

  if (!existing) {
    return 1;
  }

  const newCounter = existing.bill_number_counter + 1;

  await supabase
    .from('shop_details')
    .update({ bill_number_counter: newCounter })
    .eq('id', existing.id);

  return existing.bill_number_counter;
};
