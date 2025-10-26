import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CheckCircle, Edit3 } from 'lucide-react-native';
import { BillItemRow } from '@/components/BillItemRow';
import { BillItemInput, OCRResult } from '@/types/database';
import { calculateItemTotal } from '@/utils/calculations';

export default function OCRReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [items, setItems] = useState<BillItemInput[]>([]);

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
  }, [params.ocrResults]);

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
      },
    });
  };

  const lowConfidenceCount = items.filter(
    (item) => item.ocr_confidence && item.ocr_confidence < 0.8
  ).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Review Extracted Data</Text>
        <Text style={styles.headerSubtitle}>
          {items.length} items extracted
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

        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>Extracted Items</Text>
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
});
