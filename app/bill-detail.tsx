import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Share2, Printer, Edit3 } from 'lucide-react-native';
import { getBillById } from '@/services/billService';
import { getShopDetails } from '@/services/shopService';
import { BillWithItems } from '@/types/database';
import { formatCurrency } from '@/utils/calculations';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Paths, File } from 'expo-file-system';
import { useTheme } from '@/hooks/ThemeContext';

export default function BillDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const [bill, setBill] = useState<BillWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    loadBill();
  }, [params.id]);

  const loadBill = async () => {
    if (!params.id) {
      Alert.alert('Error', 'Bill ID not provided');
      router.back();
      return;
    }

    const data = await getBillById(params.id as string);
    if (data) {
      setBill(data);
    } else {
      Alert.alert('Error', 'Bill not found');
      router.back();
    }
    setLoading(false);
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

  const generatePDFContent = (billData: BillWithItems, shopDetails: any) => {
    const itemsHtml = billData.items
      .map(
        (item) => `
        <tr>
          <td style="border: 1px solid #000; padding: 8px 6px; text-align: center; font-size: 12px; width: 50px;">${item.quantity}</td>
          <td style="border: 1px solid #000; padding: 8px 10px; font-size: 12px; width: 320px; text-align: left;">${item.medicine_name}</td>
          <td style="border: 1px solid #000; padding: 8px 6px; text-align: center; font-size: 11px; width: 100px;">${item.price_per_unit.toFixed(0)}/-</td>
          <td style="border: 1px solid #000; padding: 8px 6px; text-align: center; font-size: 11px; width: 90px;">${item.hsn_code || ''}</td>
          <td style="border: 1px solid #000; padding: 8px 6px; text-align: center; font-size: 10px; width: 110px;">${item.batch_no || ''}<br>${item.expiry_date || ''}</td>
          <td style="border: 1px solid #000; padding: 8px 10px; text-align: right; font-size: 12px; font-weight: 600; width: 90px;">${item.total.toFixed(0)}</td>
        </tr>
      `
      )
      .join('');

    // Add empty rows to maintain consistent table height (minimum 10 rows)
    const emptyRowsCount = Math.max(0, 10 - billData.items.length);
    const emptyRows = Array(emptyRowsCount).fill(0).map(() => `
      <tr style="height: 36px;">
        <td style="border: 1px solid #000; padding: 8px 6px; width: 50px;">&nbsp;</td>
        <td style="border: 1px solid #000; padding: 8px 10px; width: 320px;">&nbsp;</td>
        <td style="border: 1px solid #000; padding: 8px 6px; width: 100px;">&nbsp;</td>
        <td style="border: 1px solid #000; padding: 8px 6px; width: 90px;">&nbsp;</td>
        <td style="border: 1px solid #000; padding: 8px 6px; width: 110px;">&nbsp;</td>
        <td style="border: 1px solid #000; padding: 8px 10px; width: 90px;">&nbsp;</td>
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
              margin: 15mm;
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
              max-width: 210mm;
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
              min-height: 80px;
            }
            .total-words-row {
              font-size: 10.5px;
              margin-bottom: 6px;
            }
            .total-words-row strong {
              font-weight: 700;
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
                    <th style="width: 320px;">PARTICULARS</th>
                    <th style="width: 100px;">MRP<br>Per Unit</th>
                    <th style="width: 90px;">HSN CODE</th>
                    <th style="width: 110px;">Batch No.<br>Exp.</th>
                    <th style="width: 90px;">Amount<br>P.</th>
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

  const handleShare = async () => {
    if (!bill) return;

    setSharing(true);
    try {
      const shopDetails = await getShopDetails();
      if (!shopDetails) {
        Alert.alert('Error', 'Shop details not found');
        return;
      }

      const htmlContent = generatePDFContent(bill, shopDetails);
      
      // Generate PDF first
      const { uri: tempUri } = await Print.printToFileAsync({ 
        html: htmlContent,
        base64: false,
      });
      
      // Generate proper PDF filename and move file
      const pdfFileName = `${bill.bill_number.replace(/[^a-zA-Z0-9]/g, '_')}_${bill.customer_name ? bill.customer_name.replace(/[^a-zA-Z0-9]/g, '_') + '_' : ''}${new Date(bill.bill_date).toISOString().split('T')[0]}.pdf`;
      const newFile = new File(Paths.cache, pdfFileName);
      
      // Delete if exists, then copy
      if (newFile.exists) {
        await newFile.delete();
      }
      
      const tempFile = new File(tempUri);
      await tempFile.copy(newFile);
      await tempFile.delete();

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(newFile.uri, {
          UTI: 'com.adobe.pdf',
          mimeType: 'application/pdf',
        });
      }
    } catch (error) {
      console.error('Error sharing bill:', error);
      Alert.alert('Error', 'Failed to share bill');
    } finally {
      setSharing(false);
    }
  };

  const handlePrint = async () => {
    if (!bill) return;

    setPrinting(true);
    try {
      const shopDetails = await getShopDetails();
      if (!shopDetails) {
        Alert.alert('Error', 'Shop details not found');
        return;
      }

      const htmlContent = generatePDFContent(bill, shopDetails);
      
      // Generate proper PDF filename for printing
      const pdfFileName = `${bill.bill_number.replace(/[^a-zA-Z0-9]/g, '_')}_${bill.customer_name ? bill.customer_name.replace(/[^a-zA-Z0-9]/g, '_') + '_' : ''}${new Date(bill.bill_date).toISOString().split('T')[0]}.pdf`;
      
      await Print.printAsync({ 
        html: htmlContent,
      });
    } catch (error) {
      console.error('Error printing bill:', error);
      Alert.alert('Error', 'Failed to print bill');
    } finally {
      setPrinting(false);
    }
  };

  const handleEdit = () => {
    if (!bill) return;
    // Navigate to bill form with the bill data for editing
    router.push({
      pathname: '/bill-form',
      params: {
        billId: bill.id,
        editMode: 'true',
      },
    });
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!bill) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>Bill not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={28} color={colors.headerText} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Bill Details</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleEdit}
            style={styles.actionButton}>
            <Edit3 size={24} color={colors.headerText} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePrint}
            style={styles.actionButton}
            disabled={printing}>
            {printing ? (
              <ActivityIndicator color={colors.headerText} size="small" />
            ) : (
              <Printer size={24} color={colors.headerText} strokeWidth={2} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleShare}
            style={styles.actionButton}
            disabled={sharing}>
            {sharing ? (
              <ActivityIndicator color={colors.headerText} size="small" />
            ) : (
              <Share2 size={24} color={colors.headerText} strokeWidth={2} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <View style={styles.billHeader}>
            <Text style={[styles.billNumber, { color: colors.text }]}>{bill.bill_number}</Text>
            <Text style={[styles.billDate, { color: colors.textTertiary }]}>
              {new Date(bill.bill_date).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </View>
        </View>

        {bill.customer_name && (
          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Customer Details</Text>
            <Text style={[styles.customerName, { color: colors.text }]}>{bill.customer_name}</Text>
            {bill.customer_phone && (
              <Text style={[styles.customerInfo, { color: colors.textSecondary }]}>{bill.customer_phone}</Text>
            )}
            {bill.customer_address && (
              <Text style={[styles.customerInfo, { color: colors.textSecondary }]}>{bill.customer_address}</Text>
            )}
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Items</Text>
          {bill.items.map((item, index) => (
            <View key={item.id} style={[styles.itemRow, { borderBottomColor: colors.border }]}>
              <View style={styles.itemLeft}>
                <Text style={[styles.itemNumber, { color: colors.textTertiary }]}>{index + 1}.</Text>
                <View style={styles.itemDetails}>
                  <Text style={[styles.itemName, { color: colors.text }]}>{item.medicine_name}</Text>
                  <Text style={[styles.itemMeta, { color: colors.textTertiary }]}>
                    {item.quantity} × {formatCurrency(item.price_per_unit)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.itemTotal, { color: colors.primary }]}>{formatCurrency(item.total)}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Subtotal</Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>{formatCurrency(bill.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
              Discount ({bill.sgst_percentage}%)
            </Text>
            <Text style={[styles.totalValue, { color: colors.error }]}>-{formatCurrency(bill.sgst_amount)}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandTotalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.grandTotalLabel, { color: colors.text }]}>Grand Total</Text>
            <Text style={[styles.grandTotalValue, { color: colors.success }]}>
              {formatCurrency(bill.grand_total)}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 20,
    color: '#6b7280',
  },
  header: {
    backgroundColor: '#2563eb',
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
    color: '#ffffff',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 8,
  },
  shareButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  billHeader: {
    alignItems: 'center',
  },
  billNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  billDate: {
    fontSize: 16,
    color: '#6b7280',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  customerName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  customerInfo: {
    fontSize: 18,
    color: '#6b7280',
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  itemLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  itemNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 16,
    color: '#6b7280',
  },
  itemTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563eb',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 18,
    color: '#6b7280',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  grandTotalRow: {
    borderTopWidth: 2,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
    marginTop: 8,
  },
  grandTotalLabel: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  grandTotalValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2563eb',
  },
});
