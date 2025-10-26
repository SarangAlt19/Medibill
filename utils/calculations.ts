export const calculateItemTotal = (quantity: string, pricePerUnit: string): number => {
  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(pricePerUnit) || 0;
  return Math.round(qty * price * 100) / 100;
};

export const calculateSubtotal = (items: Array<{ total: number }>): number => {
  return items.reduce((sum, item) => sum + item.total, 0);
};

export const calculateTaxAmount = (subtotal: number, percentage: number): number => {
  return Math.round(subtotal * percentage) / 100;
};

export const calculateGrandTotal = (
  subtotal: number,
  cgstAmount: number,
  sgstAmount: number
): number => {
  return Math.round((subtotal + cgstAmount + sgstAmount) * 100) / 100;
};

export const formatCurrency = (amount: number): string => {
  return `₹${amount.toFixed(2)}`;
};

export const formatBillNumber = (prefix: string, counter: number, year: number): string => {
  const paddedCounter = String(counter).padStart(4, '0');
  return `${prefix}-${year}-${paddedCounter}`;
};

export const parseFloatSafe = (value: string): number => {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};
