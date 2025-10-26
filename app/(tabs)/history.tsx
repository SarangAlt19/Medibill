import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Search, Trash2 } from 'lucide-react-native';
import { getBills, searchBills, deleteBill } from '@/services/billService';
import { Bill } from '@/types/database';
import { formatCurrency } from '@/utils/calculations';
import { useTheme } from '@/hooks/ThemeContext';
import { useCallback } from 'react';

type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export default function HistoryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [bills, setBills] = useState<Bill[]>([]);
  const [filteredBills, setFilteredBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set());

  // Reset state when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Reset all filters and selections
      setSearchQuery('');
      setTimePeriod('daily');
      setStartDate('');
      setEndDate('');
      setSelectionMode(false);
      setSelectedBills(new Set());
      // Reload bills
      loadBills();
    }, [])
  );

  useEffect(() => {
    applyFilters();
  }, [bills, searchQuery, timePeriod, startDate, endDate]);

  const loadBills = async () => {
    setLoading(true);
    const data = await getBills(1000, 0); // Load more bills for better filtering
    setBills(data);
    setLoading(false);
  };

  const getDateRange = (): { start: Date; end: Date } => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let start = new Date();

    switch (timePeriod) {
      case 'daily':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        break;
      case 'weekly':
        const dayOfWeek = now.getDay();
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0);
        break;
      case 'monthly':
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        break;
      case 'yearly':
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
        break;
      case 'custom':
        if (startDate || endDate) {
          // If only end date is provided, start from the first bill ever
          if (!startDate && endDate) {
            start = new Date(0); // Beginning of time (1970)
            return { start, end: new Date(endDate + 'T23:59:59') };
          }
          // If only start date is provided, end is today
          if (startDate && !endDate) {
            start = new Date(startDate + 'T00:00:00');
            return { start, end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59) };
          }
          // Both dates provided
          if (startDate && endDate) {
            start = new Date(startDate + 'T00:00:00');
            return { start, end: new Date(endDate + 'T23:59:59') };
          }
        }
        // Default to daily if custom dates not set
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        break;
    }

    return { start, end };
  };

  const applyFilters = () => {
    let filtered = [...bills];

    // Apply date range filter
    const { start, end } = getDateRange();
    filtered = filtered.filter(bill => {
      const billDate = new Date(bill.bill_date);
      return billDate >= start && billDate <= end;
    });

    // Apply search filter (reactive)
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(bill => {
        const customerName = (bill.customer_name || '').toLowerCase();
        const billNumber = bill.bill_number.toLowerCase();
        return customerName.includes(query) || billNumber.includes(query);
      });
    }

    setFilteredBills(filtered);
  };

  const calculateTotal = (): number => {
    return filteredBills.reduce((sum, bill) => sum + bill.grand_total, 0);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadBills();
    setRefreshing(false);
  };

  const handleBillPress = (billId: string) => {
    router.push(`/bill-detail?id=${billId}`);
  };

  const toggleSelection = (billId: string) => {
    const newSelected = new Set(selectedBills);
    if (newSelected.has(billId)) {
      newSelected.delete(billId);
    } else {
      newSelected.add(billId);
    }
    setSelectedBills(newSelected);
  };

  const selectAll = () => {
    const allIds = new Set(filteredBills.map(bill => bill.id));
    setSelectedBills(allIds);
  };

  const deselectAll = () => {
    setSelectedBills(new Set());
  };

  const deleteSelected = () => {
    if (selectedBills.size === 0) {
      Alert.alert('No Selection', 'Please select bills to delete');
      return;
    }

    Alert.alert(
      'Delete Bills',
      `Are you sure you want to delete ${selectedBills.size} bill(s)? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            let successCount = 0;
            for (const billId of selectedBills) {
              const success = await deleteBill(billId);
              if (success) successCount++;
            }
            
            if (successCount > 0) {
              Alert.alert('Success', `${successCount} bill(s) deleted successfully`);
              setSelectedBills(new Set());
              setSelectionMode(false);
              loadBills();
            } else {
              Alert.alert('Error', 'Failed to delete bills');
            }
          },
        },
      ]
    );
  };

    const handleLongPress = (billId: string) => {
    setSelectionMode(true);
    setSelectedBills(new Set([billId]));
  };

  const formatDateInput = (text: string, currentValue: string): string => {
    // Remove all non-numeric characters
    const numbers = text.replace(/[^\d]/g, '');
    
    // If user is deleting, allow it
    if (text.length < currentValue.length) {
      return text;
    }
    
    // Auto-format as YYYY-MM-DD
    let formatted = numbers;
    if (numbers.length >= 4) {
      formatted = numbers.slice(0, 4);
      if (numbers.length >= 5) {
        formatted += '-' + numbers.slice(4, 6);
      }
      if (numbers.length >= 7) {
        formatted += '-' + numbers.slice(6, 8);
      }
    }
    
    // Limit to 10 characters (YYYY-MM-DD)
    return formatted.slice(0, 10);
  };

  const validateDate = (dateString: string): boolean => {
    if (!dateString) return true; // Empty is valid
    
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  };

  const getTimePeriodLabel = (): string => {
    switch (timePeriod) {
      case 'daily': return 'Today';
      case 'weekly': return 'This Week';
      case 'monthly': return 'This Month';
      case 'yearly': return 'This Year';
      case 'custom': return 'Custom Range';
    }
  };

  const renderBillCard = ({ item }: { item: Bill }) => {
    const isSelected = selectedBills.has(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.billCard,
          { backgroundColor: colors.cardBackground, borderColor: colors.border },
          isSelected && { 
            backgroundColor: '#ef4444', 
            borderColor: '#dc2626', 
            borderWidth: 2,
          },
        ]}
        onPress={() => {
          if (selectionMode) {
            toggleSelection(item.id);
          } else {
            handleBillPress(item.id);
          }
        }}
        onLongPress={() => handleLongPress(item.id)}>
        <View style={styles.billCardHeader}>
          <Text style={[styles.billNumber, { color: isSelected ? '#ffffff' : colors.text }]}>
            {item.bill_number}
          </Text>
          <Text style={[styles.billAmount, { color: isSelected ? '#ffffff' : colors.primary }]}>
            {formatCurrency(item.grand_total)}
          </Text>
        </View>
        <View style={styles.billCardBody}>
          <Text style={[styles.billDate, { color: isSelected ? '#fee2e2' : colors.textTertiary }]}>
            {new Date(item.bill_date).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
          {item.customer_name ? (
            <Text style={[styles.billCustomer, { color: isSelected ? '#fecaca' : colors.textSecondary }]}>
              {item.customer_name}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.headerText }]}>Bill History</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textTertiary }]}>
            {getTimePeriodLabel()} • {filteredBills.length} {filteredBills.length === 1 ? 'bill' : 'bills'}
          </Text>
        </View>
        {selectionMode && (
          <TouchableOpacity
            style={styles.selectionModeButton}
            onPress={() => {
              setSelectionMode(false);
              setSelectedBills(new Set());
            }}>
            <Text style={[styles.cancelText, { color: colors.headerText }]}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Time Period Selector */}
      <View style={styles.filterRow}>
        <View style={styles.periodButtons}>
          {(['daily', 'weekly', 'monthly', 'yearly'] as TimePeriod[]).map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodButton,
                { 
                  backgroundColor: timePeriod === period ? colors.primary : colors.cardBackground,
                  borderColor: colors.border
                }
              ]}
              onPress={() => {
                setTimePeriod(period);
                setStartDate('');
                setEndDate('');
              }}
            >
              <Text style={[
                styles.periodButtonText,
                { color: timePeriod === period ? '#ffffff' : colors.text }
              ]}>
                {period === 'daily' ? 'Day' : period === 'weekly' ? 'Week' : period === 'monthly' ? 'Month' : 'Year'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom Date Range Inputs */}
        <View style={styles.dateRangeContainer}>
          <TextInput
            style={[styles.dateInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textTertiary}
            value={startDate}
            keyboardType="numeric"
            maxLength={10}
            onChangeText={(text) => {
              const formatted = formatDateInput(text, startDate);
              setStartDate(formatted);
              if (formatted || endDate) {
                setTimePeriod('custom');
              }
            }}
          />
          <Text style={[styles.dateToText, { color: colors.textSecondary }]}>to</Text>
          <TextInput
            style={[styles.dateInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textTertiary}
            value={endDate}
            keyboardType="numeric"
            maxLength={10}
            onChangeText={(text) => {
              const formatted = formatDateInput(text, endDate);
              setEndDate(formatted);
              if (startDate || formatted) {
                setTimePeriod('custom');
              }
            }}
          />
        </View>
      </View>

      {/* Total Summary */}
      <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Sales ({getTimePeriodLabel()})</Text>
          <Text style={[styles.summaryAmount, { color: colors.success }]}>
            {formatCurrency(calculateTotal())}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Bills Count</Text>
          <Text style={[styles.summaryCount, { color: colors.text }]}>
            {filteredBills.length}
          </Text>
        </View>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <Search size={24} color={colors.textTertiary} strokeWidth={2} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search by bill number or customer name"
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {selectionMode && (
        <View style={[styles.selectionBar, { backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[
              styles.selectionBarButton, 
              { 
                backgroundColor: selectedBills.size === filteredBills.length && filteredBills.length > 0 ? colors.primary : 'transparent',
                borderColor: colors.primary,
              }
            ]}
            onPress={() => {
              if (selectedBills.size === filteredBills.length && filteredBills.length > 0) {
                deselectAll();
              } else {
                selectAll();
              }
            }}>
            <Text style={[
              styles.selectionBarButtonText, 
              { color: selectedBills.size === filteredBills.length && filteredBills.length > 0 ? '#ffffff' : colors.primary }
            ]}>
              {selectedBills.size === filteredBills.length && filteredBills.length > 0 ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.selectionBarButton, 
              { 
                backgroundColor: selectedBills.size === 0 ? colors.border : '#dc2626',
                borderColor: selectedBills.size === 0 ? colors.border : '#dc2626',
              }
            ]}
            onPress={deleteSelected}
            disabled={selectedBills.size === 0}>
            <Trash2 size={18} color="#ffffff" strokeWidth={2} />
            <Text style={[styles.selectionBarButtonText, { color: '#ffffff', marginLeft: 6 }]}>
              Delete {selectedBills.size > 0 ? `(${selectedBills.size})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredBills.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.emptyStateText, { color: colors.textTertiary }]}>
            {searchQuery ? 'No bills found' : `No bills for ${getTimePeriodLabel().toLowerCase()}`}
          </Text>
          <Text style={[styles.emptyStateSubtext, { color: colors.textTertiary }]}>
            {searchQuery
              ? 'Try a different search term'
              : 'Try selecting a different time period'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredBills}
          keyExtractor={(item) => item.id}
          renderItem={renderBillCard}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.9,
  },
  filterRow: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  periodButtons: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  periodButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  dateToText: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  summaryCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  summaryCount: {
    fontSize: 18,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 18,
    paddingVertical: 14,
    paddingLeft: 12,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 16,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
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
  deleteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionModeButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectionBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 12,
  },
  selectionBarButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectionBarButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
