import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, Keyboard } from 'lucide-react-native';
import { getBills } from '@/services/billService';
import { getShopDetails } from '@/services/shopService';
import { Bill } from '@/types/database';
import { formatCurrency } from '@/utils/calculations';
import { useTheme } from '@/hooks/ThemeContext';

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [recentBills, setRecentBills] = useState<Bill[]>([]);
  const [shopName, setShopName] = useState('Friend Medical');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [bills, shopDetails] = await Promise.all([
      getBills(3, 0),
      getShopDetails(),
    ]);
    setRecentBills(bills);
    if (shopDetails) {
      setShopName(shopDetails.shop_name);
    }
    setLoading(false);
  };

  const handleTakePhoto = () => {
    router.push('/camera');
  };

  const handleTypeManually = () => {
    router.push('/bill-form');
  };

  const handleBillPress = (billId: string) => {
    router.push(`/bill-detail?id=${billId}`);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <Text style={[styles.appTitle, { color: colors.headerText }]}>{shopName}</Text>
        <Text style={[styles.subtitle, { color: colors.textTertiary }]}>Billing System</Text>
      </View>

      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={handleTakePhoto}>
          <Camera size={40} color="#ffffff" strokeWidth={2} />
          <Text style={styles.actionButtonText}>Take Photo</Text>
          <Text style={styles.actionButtonSubtext}>Auto-fill with OCR</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
          onPress={handleTypeManually}>
          <Keyboard size={40} color={colors.textSecondary} strokeWidth={2} />
          <Text style={[styles.actionButtonTextDark, { color: colors.text }]}>Type Manually</Text>
          <Text style={[styles.actionButtonSubtextDark, { color: colors.textTertiary }]}>Enter details</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.recentSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Bills</Text>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : recentBills.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: colors.textTertiary }]}>No bills yet</Text>
            <Text style={[styles.emptyStateSubtext, { color: colors.textTertiary }]}>
              Create your first bill using the buttons above
            </Text>
          </View>
        ) : (
          recentBills.map((bill) => (
            <TouchableOpacity
              key={bill.id}
              style={[styles.billCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
              onPress={() => handleBillPress(bill.id)}>
              <View style={styles.billCardHeader}>
                <Text style={[styles.billNumber, { color: colors.text }]}>{bill.bill_number}</Text>
                <Text style={[styles.billAmount, { color: colors.primary }]}>
                  {formatCurrency(bill.grand_total)}
                </Text>
              </View>
              <View style={styles.billCardBody}>
                <Text style={[styles.billDate, { color: colors.textTertiary }]}>
                  {new Date(bill.bill_date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
                {bill.customer_name ? (
                  <Text style={[styles.billCustomer, { color: colors.textSecondary }]}>{bill.customer_name}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.9,
  },
  actionContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 15,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    paddingHorizontal: 15,
    borderRadius: 16,
    minHeight: 160,
  },
  primaryButton: {
  },
  secondaryButton: {
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 12,
  },
  actionButtonTextDark: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
  },
  actionButtonSubtext: {
    fontSize: 16,
    color: '#dbeafe',
    marginTop: 4,
  },
  actionButtonSubtextDark: {
    fontSize: 16,
    marginTop: 4,
  },
  recentSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  loader: {
    marginTop: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: '600',
  },
  emptyStateSubtext: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  billCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
  },
  billCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  billNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  billAmount: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  billCardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billDate: {
    fontSize: 16,
  },
  billCustomer: {
    fontSize: 16,
  },
});
