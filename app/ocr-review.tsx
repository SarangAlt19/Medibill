import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CheckCircle, Edit3, User, Stethoscope, DollarSign, Percent, Wallet } from 'lucide-react-native';
import { BillItemRow } from '@/components/BillItemRow';
import { BillItemInput, OCRResult } from '@/types/database';
import { calculateItemTotal, calculateSubtotal } from '@/utils/calculations';
import { BillMetadata } from '@/utils/billExtraction';

export default function OCRReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [items, setItems] = useState<BillItemInput[]>([]);
  const [metadata, setMetadata] = useState<BillMetadata>({
    customerName: null,
    customerPhone: null,
    customerAddress: null,
    billNumber: null,
    billDate: null,
    doctorName: null,
  });
  const [totalMedicines, setTotalMedicines] = useState(0);
  const [discountPercentage, setDiscountPercentage] = useState<string>('0');

  useEffect(() => {
    if (params.ocrResults) {
      try {
        const ocrResults: OCRResult[] = JSON.parse(params.ocrResults as string);
        const parsedItems = ocrResults.map((result, index) => ({
          id: (Date.now() + index).toString(),
          medicine_name: result.medicine_name,
          quantity: result.quantity,
          price_per_unit: result.price_per_unit,
          total: calculateItemTotal(result.quantity, result.price_per_unit),
          ocr_confidence: result.confidence,
        }));
        setItems(parsedItems);
      } catch (error) {
        console.error('Error parsing OCR results:', error);
        Alert.alert('Error', 'Failed to parse OCR results');
        router.back();
      }
    }

    if (params.billMetadata) {
      try {
        const parsedMetadata: BillMetadata = JSON.parse(params.billMetadata as string);
        setMetadata(parsedMetadata);
      } catch (error) {
        console.error('Error parsing bill metadata:', error);
      }
    }

    if (params.totalMedicines) {
      setTotalMedicines(parseInt(params.totalMedicines as string, 10) || 0);
    }
  }, [params.ocrResults, params.billMetadata, params.totalMedicines]);

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

  const handleUpdateMetadata = (field: keyof BillMetadata, value: string) => {
    setMetadata(prev => ({
      ...prev,
      [field]: value || null,
    }));
  };

  const handleContinue = () => {
    const hasValidItems = items.some(
      (item) =>
        item.medicine_name.trim() &&
        parseFloat(item.quantity) > 0 &&
        parseFloat(item.price_per_unit) > 0
    );

    if (!hasValidItems) {
      Alert.alert('Error', 'Please ensure at least one item has valid data');
      return;
    }

    router.replace({
      pathname: '/bill-form',
      params: {
        ocrResults: JSON.stringify(items),
        billMetadata: JSON.stringify(metadata),
      },
    });
  };

  const lowConfidenceCount = items.filter(
    (item) => item.ocr_confidence && item.ocr_confidence < 0.8
  ).length;

  // Calculate totals
  const totalAmount = calculateSubtotal(items);
  const discountPercent = parseFloat(discountPercentage) || 0;
  const discountAmount = Math.ceil((totalAmount * discountPercent) / 100);
  const finalAmount = totalAmount - discountAmount;

  // Convert number to words (Indian system)
  const numberToWords = (num: number): string => {
    if (num === 0) return 'Zero Rupees';
    
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    const convertHundreds = (n: number): string => {
      if (n === 0) return '';
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertHundreds(n % 100) : '');
    };
    
    const n = Math.floor(num);
    if (n >= 10000000) {
      return convertHundreds(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + numberToWords(n % 10000000) : ' Rupees');
    }
    if (n >= 100000) {
      return convertHundreds(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + numberToWords(n % 100000) : ' Rupees');
    }
    if (n >= 1000) {
      return convertHundreds(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + numberToWords(n % 1000) : ' Rupees');
    }
    return convertHundreds(n) + ' Rupees';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Review Extracted Data</Text>
        <Text style={styles.headerSubtitle}>
          {totalMedicines || items.length} {totalMedicines === 1 ? 'medicine' : 'medicines'} detected
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {lowConfidenceCount > 0 && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              ⚠️ {lowConfidenceCount} {lowConfidenceCount === 1 ? 'item' : 'items'} highlighted in yellow may need correction
            </Text>
          </View>
        )}

        {/* Bill Metadata Section */}
        <View style={styles.metadataSection}>
          <Text style={styles.sectionTitle}>Bill Information</Text>
          <Text style={styles.sectionSubtitle}>
            Review and correct bill details if needed
          </Text>

          <View style={styles.metadataCard}>
            <View style={styles.metadataRow}>
              <User size={20} color="#6b7280" />
              <Text style={styles.metadataLabel}>Customer Name</Text>
            </View>
            <TextInput
              style={styles.metadataInput}
              value={metadata.customerName || ''}
              onChangeText={(value) => handleUpdateMetadata('customerName', value)}
              placeholder="Enter customer name"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.metadataCard}>
            <View style={styles.metadataRow}>
              <Stethoscope size={20} color="#6b7280" />
              <Text style={styles.metadataLabel}>Doctor / Hospital / Clinic Name</Text>
            </View>
            <TextInput
              style={styles.metadataInput}
              value={metadata.doctorName || ''}
              onChangeText={(value) => handleUpdateMetadata('doctorName', value)}
              placeholder="Enter doctor/hospital/clinic name"
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>

        {/* Medicines Section */}
        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>Medicines ({items.length})</Text>
          <Text style={styles.sectionSubtitle}>
            Tap any field to edit. Yellow items have lower confidence.
          </Text>

          {items.map((item, index) => (
            <BillItemRow
              key={item.id}
              item={item}
              index={index}
              onUpdate={handleUpdateItem}
              onDelete={handleDeleteItem}
            />
          ))}
        </View>

        {/* Totals Section */}
        <View style={styles.totalsSection}>
          <Text style={styles.sectionTitle}>Bill Summary</Text>
          
          <View style={styles.totalRow}>
            <View style={styles.totalLabelContainer}>
              <DollarSign size={20} color="#6b7280" />
              <Text style={styles.totalLabel}>Total Amount</Text>
            </View>
            <Text style={styles.totalValue}>₹{totalAmount.toFixed(2)}</Text>
          </View>

          <View style={styles.discountCard}>
            <View style={styles.metadataRow}>
              <Percent size={20} color="#6b7280" />
              <Text style={styles.metadataLabel}>Discount Percentage</Text>
            </View>
            <TextInput
              style={styles.metadataInput}
              value={discountPercentage}
              onChangeText={setDiscountPercentage}
              placeholder="0 or 10"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.totalRow}>
            <View style={styles.totalLabelContainer}>
              <Text style={styles.totalLabel}>Discount Amount</Text>
            </View>
            <Text style={styles.discountValue}>-₹{discountAmount}</Text>
          </View>

          <View style={styles.finalTotalRow}>
            <View style={styles.totalLabelContainer}>
              <Wallet size={24} color="#16a34a" />
              <Text style={styles.finalTotalLabel}>Final Amount</Text>
            </View>
            <Text style={styles.finalTotalValue}>₹{finalAmount.toFixed(2)}</Text>
          </View>

          <View style={styles.amountInWordsCard}>
            <Text style={styles.amountInWordsLabel}>Amount in Words</Text>
            <Text style={styles.amountInWordsValue}>{numberToWords(finalAmount)}</Text>
          </View>
        </View>

        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleContinue}>
            <CheckCircle size={24} color="#ffffff" strokeWidth={2} />
            <Text style={styles.primaryButtonText}>Looks Good</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleContinue}>
            <Edit3 size={24} color="#2563eb" strokeWidth={2} />
            <Text style={styles.secondaryButtonText}>Edit More</Text>
          </TouchableOpacity>
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
  header: {
    backgroundColor: '#2563eb',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.9,
  },
  content: {
    flex: 1,
  },
  warningBanner: {
    backgroundColor: '#fef3c7',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    padding: 16,
    margin: 20,
    borderRadius: 8,
  },
  warningText: {
    fontSize: 16,
    color: '#92400e',
    lineHeight: 22,
  },
  metadataSection: {
    padding: 20,
    paddingBottom: 0,
  },
  metadataCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  metadataLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  metadataInput: {
    fontSize: 16,
    color: '#111827',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  multilineInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  itemsSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 22,
  },
  actionsSection: {
    padding: 20,
    gap: 12,
    paddingBottom: 40,
  },
  primaryButton: {
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 12,
    gap: 12,
  },
  primaryButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  secondaryButton: {
    backgroundColor: '#eff6ff',
    borderWidth: 2,
    borderColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 12,
    gap: 12,
  },
  secondaryButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  totalsSection: {
    padding: 20,
    paddingTop: 0,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  totalLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  discountCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  discountValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  finalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#16a34a',
  },
  finalTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  finalTotalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  amountInWordsCard: {
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  amountInWordsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 8,
  },
  amountInWordsValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e3a8a',
    fontStyle: 'italic',
  },
});
