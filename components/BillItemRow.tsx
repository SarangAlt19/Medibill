import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { BillItemInput } from '@/types/database';
import { useTheme } from '@/hooks/ThemeContext';

interface BillItemRowProps {
  item: BillItemInput;
  index: number;
  onUpdate: (id: string, field: keyof BillItemInput, value: string) => void;
  onDelete: (id: string) => void;
}

export function BillItemRow({ item, index, onUpdate, onDelete }: BillItemRowProps) {
  const { colors } = useTheme();
  const isLowConfidence = item.ocr_confidence && item.ocr_confidence < 0.8;

  return (
    <View style={[styles.container, { backgroundColor: colors.cardBackground, borderColor: colors.border }, isLowConfidence ? styles.lowConfidenceContainer : null]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.serialNumber, { color: colors.textTertiary }]}>#{index + 1}</Text>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onDelete(item.id)}>
            <Trash2 size={20} color={colors.error} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.itemTotal, { color: colors.primary }]}>₹{item.total.toFixed(2)}</Text>
      </View>

      <TextInput
        style={[styles.nameInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
        placeholder="Medicine Name (Particulars)"
        placeholderTextColor={colors.textTertiary}
        value={item.medicine_name}
        onChangeText={(text) => onUpdate(item.id, 'medicine_name', text)}
      />

      <View style={styles.detailsRow}>
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>Qty</Text>
          <TextInput
            style={[styles.smallInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
            value={item.quantity}
            onChangeText={(text) => onUpdate(item.id, 'quantity', text)}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>MRP Per Unit</Text>
          <TextInput
            style={[styles.smallInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            placeholder="0.00"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
            value={item.price_per_unit}
            onChangeText={(text) => onUpdate(item.id, 'price_per_unit', text)}
          />
        </View>
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>HSN Code</Text>
          <TextInput
            style={[styles.smallInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            placeholder="HSN"
            placeholderTextColor={colors.textTertiary}
            value={item.hsn_code || ''}
            onChangeText={(text) => onUpdate(item.id, 'hsn_code', text)}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>Batch No.</Text>
          <TextInput
            style={[styles.smallInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            placeholder="Batch"
            placeholderTextColor={colors.textTertiary}
            value={item.batch_no || ''}
            onChangeText={(text) => onUpdate(item.id, 'batch_no', text)}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>Expiry</Text>
          <TextInput
            style={[styles.smallInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            placeholder="MM/YY"
            placeholderTextColor={colors.textTertiary}
            value={item.expiry_date || ''}
            onChangeText={(text) => onUpdate(item.id, 'expiry_date', text)}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  lowConfidenceContainer: {
    backgroundColor: '#fef3c7',
    borderColor: '#fbbf24',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  serialNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  deleteButton: {
    padding: 4,
  },
  itemTotal: {
    fontSize: 20,
    fontWeight: '700',
  },
  nameInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 17,
    marginBottom: 12,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  smallInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
  },
});
