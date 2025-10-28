import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { BillItemRow } from '@/components/BillItemRow';
import { BillItemInput, OCRResult } from '@/types/database';
import { getShopDetails } from '@/services/shopService';
import { createBill, getBillById, updateBill } from '@/services/billService';
import { calculateItemTotal, formatCurrency } from '@/utils/calculations';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Paths, File } from 'expo-file-system';
import { useTheme } from '@/hooks/ThemeContext';

export default function BillFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const isEditMode = params.editMode === 'true';
  const billId = params.billId as string | undefined;

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [items, setItems] = useState<BillItemInput[]>([
    {
      id: Date.now().toString(),
      medicine_name: '',
      quantity: '',
      price_per_unit: '',
      total: 0,
      hsn_code: '3004',
    },
  ]);
  const [discountPercentage, setDiscountPercentage] = useState('10');
  const [loading, setLoading] = useState(false);
  const [showCustomerSection, setShowCustomerSection] = useState(false);
  const [defaultHsnCode, setDefaultHsnCode] = useState('3004');

  useEffect(() => {
    if (isEditMode && billId) {
      loadBillForEdit();
    } else {
      loadDefaults();
    }
  }, []);

  useEffect(() => {
    if (params.ocrResults) {
      try {
        const ocrResults: OCRResult[] = JSON.parse(params.ocrResults as string);
        const newItems = ocrResults.map((result, index) => ({
          id: (Date.now() + index).toString(),
          medicine_name: result.medicine_name,
          quantity: result.quantity,
          price_per_unit: result.price_per_unit,
          total: calculateItemTotal(result.quantity, result.price_per_unit),
          ocr_confidence: result.confidence,
        }));
        setItems(newItems);
      } catch (error) {
        console.error('Error parsing OCR results:', error);
      }
    }
  }, [params.ocrResults]);

  const loadDefaults = async () => {
    const shopDetails = await getShopDetails();
    if (shopDetails) {
      // Load default discount and HSN code from shop settings
      const defaultDiscount = shopDetails.default_discount?.toString() || '10';
      const defaultHsn = shopDetails.default_hsn_code || '3004';
      
      setDiscountPercentage(defaultDiscount);
      setDefaultHsnCode(defaultHsn);
      
      // Update initial item with default HSN code
      setItems([
        {
          id: Date.now().toString(),
          medicine_name: '',
          quantity: '',
          price_per_unit: '',
          total: 0,
          hsn_code: defaultHsn,
        },
      ]);
    }
  };

  const loadBillForEdit = async () => {
    if (!billId) return;

    setLoading(true);
    const billData = await getBillById(billId);
    
    if (billData) {
      setCustomerName(billData.customer_name || '');
      setCustomerPhone(billData.customer_phone || '');
      setCustomerAddress(billData.customer_address || '');
      // Calculate discount percentage from stored CGST/SGST (for backward compatibility)
      const totalTaxPercent = billData.cgst_percentage + billData.sgst_percentage;
      setDiscountPercentage(totalTaxPercent > 0 ? totalTaxPercent.toString() : '10');
      setShowCustomerSection(!!billData.customer_name || !!billData.customer_phone || !!billData.customer_address);

      const loadedItems = billData.items.map((item) => ({
        id: item.id,
        medicine_name: item.medicine_name,
        quantity: item.quantity.toString(),
        price_per_unit: item.price_per_unit.toString(),
        total: item.total,
        ocr_confidence: item.ocr_confidence,
      }));

      setItems(loadedItems);
    } else {
      Alert.alert('Error', 'Failed to load bill');
      router.back();
    }
    
    setLoading(false);
  };

  const handlePhoneChange = (text: string) => {
    // Only allow digits and limit to 10 characters
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 10) {
      setCustomerPhone(cleaned);
    }
  };

  const handleUpdateItem = (id: string, field: keyof BillItemInput, value: string) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === 'quantity' || field === 'price_per_unit') {
            updated.total = calculateItemTotal(updated.quantity, updated.price_per_unit);
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleDeleteItem = (id: string) => {
    if (items.length === 1) {
      Alert.alert('Error', 'At least one item is required');
      return;
    }
    setItems((prevItems) => prevItems.filter((item) => item.id !== id));
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: Date.now().toString(),
        medicine_name: '',
        quantity: '',
        price_per_unit: '',
        total: 0,
        hsn_code: defaultHsnCode,
      },
    ]);
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const discountAmount = Math.round(subtotal * parseFloat(discountPercentage || '0')) / 100;
    const grandTotal = Math.round((subtotal - discountAmount) * 100) / 100;

    return { subtotal, discountAmount, grandTotal };
  };

  const validateForm = (): boolean => {
    const hasValidItem = items.some(
      (item) =>
        item.medicine_name.trim() &&
        parseFloat(item.quantity) > 0 &&
        parseFloat(item.price_per_unit) > 0
    );

    if (!hasValidItem) {
      Alert.alert('Error', 'Please add at least one valid item');
      return false;
    }

    return true;
  };

  const numberToWords = (num: number): string => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

    if (num === 0) return 'Zero';

    const convert = (n: number): string => {
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
      if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convert(n % 100) : '');
      if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
      if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
      return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '');
    };

    return convert(Math.floor(num)) + ' only';
  };

  const generatePDFContent = (billData: any, shopDetails: any) => {
    // Calculate discount details
    const discountPercentage = billData.sgst_percentage || 0; // Discount stored in sgst_percentage
    const discountAmount = billData.sgst_amount || 0; // Discount amount stored in sgst_amount
    
    const itemsHtml = billData.items
      .map(
        (item: any) => `
        <tr>
          <td style="border: 1px solid #000; padding: 8px 6px; text-align: center; font-size: 12px; width: 50px;">${item.quantity}</td>
          <td style="border: 1px solid #000; padding: 8px 10px; font-size: 12px; width: 350px; text-align: left;">${item.medicine_name}</td>
          <td style="border: 1px solid #000; padding: 8px 6px; text-align: center; font-size: 11px; width: 105px;">${item.price_per_unit.toFixed(0)}/-</td>
          <td style="border: 1px solid #000; padding: 8px 6px; text-align: center; font-size: 11px; width: 95px;">${item.hsn_code || ''}</td>
          <td style="border: 1px solid #000; padding: 8px 6px; text-align: center; font-size: 10px; width: 115px;">${item.batch_no || ''}<br>${item.expiry_date || ''}</td>
          <td style="border: 1px solid #000; padding: 8px 10px; text-align: right; font-size: 12px; font-weight: 600; width: 95px;">${item.total.toFixed(0)}</td>
        </tr>
      `
      )
      .join('');

    // Add empty rows to maintain consistent table height (minimum 10 rows)
    const emptyRowsCount = Math.max(0, 10 - billData.items.length);
    const emptyRows = Array(emptyRowsCount).fill(0).map(() => `
      <tr style="height: 36px;">
        <td style="border: 1px solid #000; padding: 8px 6px; width: 50px;">&nbsp;</td>
        <td style="border: 1px solid #000; padding: 8px 10px; width: 350px;">&nbsp;</td>
        <td style="border: 1px solid #000; padding: 8px 6px; width: 105px;">&nbsp;</td>
        <td style="border: 1px solid #000; padding: 8px 6px; width: 95px;">&nbsp;</td>
        <td style="border: 1px solid #000; padding: 8px 6px; width: 115px;">&nbsp;</td>
        <td style="border: 1px solid #000; padding: 8px 10px; width: 95px;">&nbsp;</td>
      </tr>
    `).join('');

    const totalInWords = numberToWords(billData.grand_total);
    const formattedDate = new Date(billData.bill_date).toLocaleDateString('en-GB').replace(/\//g, '.');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            @page {
              size: A4;
              margin: 2mm;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body { 
              font-family: 'Arial', 'Helvetica', sans-serif;
              font-size: 11px;
              line-height: 1.4;
              color: #000;
              background: white;
            }
            .invoice-container {
              width: 100%;
              max-width: 100%;
              margin: 0 auto;
              border: 2.5px solid #000;
              background: white;
              position: relative;
            }
            
            /* Header Section */
            .header-section {
              border-bottom: 2px solid #000;
              padding: 12px 16px;
              position: relative;
              min-height: 140px;
            }
            .header-top-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 6px;
            }
            .gstin-block {
              font-size: 9px;
              font-weight: 600;
            }
            .composition-box {
              border: 1.5px solid #000;
              padding: 4px 10px;
              font-size: 9px;
              font-weight: 700;
              text-align: center;
              line-height: 1.3;
            }
            .dl-numbers-row {
              display: flex;
              gap: 20px;
              font-size: 8.5px;
              margin-bottom: 2px;
            }
            .dl-numbers-row strong {
              font-weight: 700;
            }
            
            .company-name {
              text-align: center;
              font-size: 22px;
              font-weight: 700;
              letter-spacing: 0.5px;
              margin: 10px 0 6px 0;
              color: #000;
            }
            .subtitle-container {
              text-align: center;
              margin: 6px 0;
            }
            .subtitle {
              display: inline-block;
              border: 2px solid #000;
              border-radius: 15px;
              padding: 3px 12px;
              font-size: 11px;
              font-weight: 600;
            }
            .address-line {
              text-align: center;
              font-size: 9.5px;
              margin-top: 6px;
              line-height: 1.4;
            }
            
            /* Bill Info Box - Top Right */
            .bill-info-box {
              position: absolute;
              top: 14px;
              right: 16px;
              border: 1.5px solid #000;
              padding: 6px 12px;
              background: white;
              min-width: 140px;
            }
            .bill-info-label {
              font-size: 9px;
              text-align: center;
              margin-bottom: 4px;
              font-weight: 600;
            }
            .bill-info-row {
              display: flex;
              justify-content: space-between;
              gap: 8px;
              margin: 3px 0;
              font-size: 10px;
            }
            .bill-info-row .label {
              font-weight: 400;
            }
            .bill-info-row .value {
              font-weight: 700;
            }
            
            /* Customer Section */
            .customer-section {
              border-bottom: 1.5px solid #000;
              padding: 10px 16px;
            }
            .customer-field-row {
              display: flex;
              gap: 30px;
              margin-bottom: 8px;
              align-items: center;
            }
            .customer-field {
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 11px;
            }
            .customer-field strong {
              font-weight: 700;
              white-space: nowrap;
            }
            .customer-field .field-value {
              border-bottom: 1px solid #000;
              min-width: 200px;
              padding: 0 8px 2px 8px;
            }
            .customer-field.phone {
              margin-left: auto;
            }
            .customer-field.phone .field-value {
              min-width: 120px;
            }
            .customer-field.doctor {
              flex: 1;
            }
            .customer-field.doctor .field-value {
              flex: 1;
              min-width: 300px;
            }
            
            /* Table Section */
            .table-container {
              width: 100%;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }
            thead th {
              border: 1.5px solid #000;
              padding: 8px 6px;
              font-size: 10.5px;
              font-weight: 700;
              text-align: center;
              background-color: #fff;
              vertical-align: middle;
              line-height: 1.3;
            }
            tbody td {
              border: 1px solid #000;
              vertical-align: middle;
            }
            
            /* Totals Section */
            .totals-section {
              border-top: 2px solid #000;
              padding: 12px 16px;
              position: relative;
              min-height: 100px;
            }
            .total-words-row {
              font-size: 10.5px;
              margin-bottom: 8px;
            }
            .total-words-row strong {
              font-weight: 700;
            }
            
            /* Totals Breakdown */
            .totals-breakdown {
              margin-top: 8px;
              margin-bottom: 8px;
            }
            .breakdown-row {
              display: flex;
              justify-content: flex-start;
              align-items: center;
              gap: 16px;
              font-size: 11px;
              margin-bottom: 4px;
            }
            .breakdown-label {
              font-weight: 600;
              min-width: 150px;
            }
            .breakdown-value {
              font-weight: 700;
              font-size: 12px;
            }
            .discount-row {
              color: #dc2626;
            }
            .discount-row .breakdown-value {
              color: #dc2626;
            }
            
            /* Grand Total Box - Bottom Right */
            .grand-total-box {
              position: absolute;
              bottom: 16px;
              right: 16px;
              border: 2.5px solid #000;
              padding: 10px 16px;
              background: white;
              text-align: center;
              min-width: 140px;
            }
            .grand-total-label {
              font-size: 12px;
              font-weight: 700;
              margin-bottom: 4px;
            }
            .grand-total-value {
              font-size: 20px;
              font-weight: 700;
            }
            
            /* Footer Section */
            .footer-section {
              border-top: 1.5px solid #000;
              padding: 12px 16px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              min-height: 80px;
            }
            .terms-block {
              font-size: 8.5px;
              line-height: 1.5;
            }
            .terms-block .heading {
              font-weight: 700;
              margin-bottom: 4px;
            }
            .signature-block {
              text-align: right;
            }
            .for-company {
              font-size: 10.5px;
              font-style: italic;
              margin-bottom: 30px;
            }
            .auth-signatory {
              font-size: 9.5px;
              border-top: 1px solid #000;
              padding-top: 4px;
              min-width: 130px;
              display: inline-block;
            }
            
            @media print {
              body {
                margin: 0;
                padding: 0;
              }
              .invoice-container {
                border: 2.5px solid #000;
              }
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            
            <!-- Header Section -->
            <div class="header-section">
              <div class="header-top-row">
                <div class="gstin-block">
                  <strong>GSTIN No. ${shopDetails.gst_number || '09AEEZPC4412P3ZT'}</strong>
                </div>
                <div class="composition-box">
                  UNDER COMPOSITION<br>
                  <strong>(M) ${shopDetails.phone || '9358402048'}</strong>
                </div>
              </div>
              
              <div class="dl-numbers-row">
                <span><strong>D.L.No.</strong> MRP-02B UP1520002576</span>
                <span><strong>D.L.No.</strong> 21A-UP1521002185</span>
              </div>
              <div class="dl-numbers-row">
                <span>21- UP1621002576</span>
                <span>21B UP1521002544</span>
              </div>
              
              <div class="bill-info-box">
                <div class="bill-info-label">BILL OF SUPPLY</div>
                <div class="bill-info-row">
                  <span class="label">No.</span>
                  <span class="value">${billData.bill_number}</span>
                </div>
                <div class="bill-info-row">
                  <span class="label">Dated.</span>
                  <span class="value">${formattedDate}</span>
                </div>
              </div>
              
              <div class="company-name">Friend's Trading Co.</div>
              
              <div class="subtitle-container">
                <div class="subtitle">● Chemist Shop & Pharmaceutical Distributor ●</div>
              </div>
              
              <div class="address-line">
                71/3, Gihara Mohalla, Near Parth Public School, Kaseru Khera, Meerut Cantt.
              </div>
            </div>
            
            <!-- Customer Section -->
            <div class="customer-section">
              <div class="customer-field-row">
                <div class="customer-field">
                  <strong>Name</strong>
                  <span class="field-value">${billData.customer_name || ''}</span>
                </div>
                <div class="customer-field phone">
                  <strong>Mob.</strong>
                  <span class="field-value">${billData.customer_phone || ''}</span>
                </div>
              </div>
              <div class="customer-field-row">
                <div class="customer-field doctor">
                  <strong>Prescribed by Dr.</strong>
                  <span class="field-value">${billData.customer_address || ''}</span>
                </div>
              </div>
            </div>
            
            <!-- Items Table -->
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th style="width: 50px;">Qty</th>
                    <th style="width: 350px;">PARTICULARS</th>
                    <th style="width: 105px;">MRP<br>Per Unit</th>
                    <th style="width: 95px;">HSN CODE</th>
                    <th style="width: 115px;">Batch No.<br>Exp.</th>
                    <th style="width: 95px;">Amount<br>P.</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                  ${emptyRows}
                </tbody>
              </table>
            </div>
            
            <!-- Totals Section -->
            <div class="totals-section">
              <div class="total-words-row">
                <strong>Total Invoice Value (in Words) :</strong>
                <span>${totalInWords}</span>
              </div>
              
              <div class="totals-breakdown">
                <div class="breakdown-row">
                  <span class="breakdown-label">Subtotal:</span>
                  <span class="breakdown-value">₹ ${billData.subtotal.toFixed(0)}</span>
                </div>
                <div class="breakdown-row discount-row">
                  <span class="breakdown-label">Discount (${discountPercentage}%):</span>
                  <span class="breakdown-value">- ₹ ${discountAmount.toFixed(0)}</span>
                </div>
              </div>
              
              <div class="grand-total-box">
                <div class="grand-total-label">TOTAL</div>
                <div class="grand-total-value">${billData.grand_total.toFixed(0)}</div>
              </div>
            </div>
            
            <!-- Footer Section -->
            <div class="footer-section">
              <div class="terms-block">
                <div class="heading">TERMS & CONDITIONS :</div>
                <div>E. & O. E.</div>
                <div>1. All Disputes are Subject to Meerut Jurisdiction only.</div>
              </div>
              <div class="signature-block">
                <div class="for-company">For Friend's Trading Co.</div>
                <div class="auth-signatory">Authorised Signatory</div>
              </div>
            </div>
            
          </div>
        </body>
      </html>
    `;
  };

  const handleGenerateBill = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const validItems = items.filter(
        (item) =>
          item.medicine_name.trim() &&
          parseFloat(item.quantity) > 0 &&
          parseFloat(item.price_per_unit) > 0
      );

      const discount = parseFloat(discountPercentage);
      const formData = {
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        items: validItems,
        cgst_percentage: 0, // Store discount as CGST for backward compatibility
        sgst_percentage: discount, // Store discount in SGST field
      };

      let billData;
      if (isEditMode && billId) {
        billData = await updateBill(billId, formData);
      } else {
        billData = await createBill(formData);
      }

      if (!billData) {
        Alert.alert('Error', isEditMode ? 'Failed to update bill' : 'Failed to create bill');
        setLoading(false);
        return;
      }

      const shopDetails = await getShopDetails();
      if (!shopDetails) {
        Alert.alert('Error', 'Shop details not found');
        setLoading(false);
        return;
      }

      const htmlContent = generatePDFContent(billData, shopDetails);

      // Generate PDF first
      const { uri: tempUri } = await Print.printToFileAsync({ 
        html: htmlContent,
        base64: false,
      });

      // Generate proper PDF filename and move file
      const pdfFileName = `${billData.bill_number.replace(/[^a-zA-Z0-9]/g, '_')}_${billData.customer_name ? billData.customer_name.replace(/[^a-zA-Z0-9]/g, '_') + '_' : ''}${new Date(billData.bill_date).toISOString().split('T')[0]}.pdf`;
      const newFile = new File(Paths.cache, pdfFileName);
      
      // Delete if exists, then copy
      if (newFile.exists) {
        await newFile.delete();
      }
      
      const tempFile = new File(tempUri);
      await tempFile.copy(newFile);
      await tempFile.delete();

      const uri = newFile.uri;

      Alert.alert(
        isEditMode ? 'Bill Updated' : 'Bill Created',
        isEditMode ? 'Your bill has been updated successfully!' : 'Your bill has been generated successfully!',
        [
          {
            text: 'Share',
            onPress: async () => {
              const isAvailable = await Sharing.isAvailableAsync();
              if (isAvailable) {
                await Sharing.shareAsync(uri, {
                  UTI: 'com.adobe.pdf',
                  mimeType: 'application/pdf',
                });
              }
            },
          },
          {
            text: 'Done',
            onPress: () => router.replace('/(tabs)'),
          },
        ]
      );
    } catch (error) {
      console.error('Error generating bill:', error);
      Alert.alert('Error', 'Failed to generate bill. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  if (loading && isEditMode) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={28} color={colors.headerText} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.headerText }]}>Edit Bill</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading bill data...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={28} color={colors.headerText} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>
          {isEditMode ? 'Edit Bill' : 'New Bill'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <TouchableOpacity
          style={[styles.customerToggle, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
          onPress={() => setShowCustomerSection(!showCustomerSection)}>
          <Text style={[styles.customerToggleTitle, { color: colors.text }]}>Customer Details</Text>
          <Text style={[styles.toggleText, { color: colors.primary }]}>
            {showCustomerSection ? 'Hide' : 'Show'}
          </Text>
        </TouchableOpacity>

        {showCustomerSection && (
          <View style={styles.section}>
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Patient Name</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.text }]}
                placeholder="Enter patient name"
                placeholderTextColor={colors.textTertiary}
                value={customerName}
                onChangeText={setCustomerName}
              />
            </View>
            
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Mobile Number</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.text }]}
                placeholder="Enter mobile number (10 digits)"
                placeholderTextColor={colors.textTertiary}
                keyboardType="phone-pad"
                maxLength={10}
                value={customerPhone}
                onChangeText={handlePhoneChange}
              />
            </View>
            
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Prescribed by Dr.</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.text }]}
                placeholder="Enter doctor's name (e.g., Dr. Sharma, MD)"
                placeholderTextColor={colors.textTertiary}
                value={customerAddress}
                onChangeText={setCustomerAddress}
              />
            </View>
            
            <View style={[styles.infoBox, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
              <Text style={[styles.infoText, { color: colors.primary }]}>
                💡 These details will appear on the printed bill
              </Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Items</Text>

          {items.map((item, index) => (
            <BillItemRow
              key={item.id}
              item={item}
              index={index}
              onUpdate={handleUpdateItem}
              onDelete={handleDeleteItem}
            />
          ))}

          <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]} onPress={handleAddItem}>
            <Plus size={24} color={colors.primary} strokeWidth={2} />
            <Text style={[styles.addButtonText, { color: colors.primary }]}>Add Item</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.compactSection}>
          <View style={[styles.taxCompactRow, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.taxCompactLabel, { color: colors.textSecondary }]}>Discount:</Text>
            <View style={styles.taxInputGroup}>
              <TextInput
                style={[styles.discountInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                keyboardType="numeric"
                value={discountPercentage}
                onChangeText={setDiscountPercentage}
              />
              <Text style={[styles.taxPercent, { color: colors.textTertiary }]}>%</Text>
            </View>
          </View>
        </View>

        <View style={[styles.totalsSection, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.textTertiary }]}>Subtotal</Text>
            <Text style={[styles.totalValue, { color: colors.textSecondary }]}>{formatCurrency(totals.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.textTertiary }]}>Discount ({discountPercentage}%)</Text>
            <Text style={[styles.totalValue, { color: colors.error }]}>-{formatCurrency(totals.discountAmount)}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandTotalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.grandTotalLabel, { color: colors.text }]}>Total</Text>
            <Text style={[styles.grandTotalValue, { color: colors.primary }]}>
              {formatCurrency(totals.grandTotal)}
            </Text>
          </View>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.generateButton, { backgroundColor: colors.success }, loading && styles.generateButtonDisabled]}
        onPress={handleGenerateBill}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text style={styles.generateButtonText}>
            {isEditMode ? 'Update Bill' : 'Generate Bill'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 44,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  helpCard: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 13,
    lineHeight: 20,
  },
  customerToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  customerToggleTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 4,
  },
  infoBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 18,
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 16,
    marginTop: 8,
  },
  addButtonText: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  compactSection: {
    marginBottom: 16,
  },
  taxCompactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    gap: 16,
  },
  taxCompactLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  taxInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taxInputLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  taxCompactInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    width: 50,
    textAlign: 'center',
  },
  discountInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    width: 70,
    textAlign: 'center',
  },
  taxPercent: {
    fontSize: 14,
  },
  taxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  taxLabel: {
    fontSize: 20,
    fontWeight: '600',
  },
  taxInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    width: 100,
    textAlign: 'center',
  },
  totalsSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 100,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 15,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  grandTotalRow: {
    borderTopWidth: 2,
    paddingTop: 12,
    marginTop: 8,
  },
  grandTotalLabel: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  grandTotalValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  generateButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  generateButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
  },
});
