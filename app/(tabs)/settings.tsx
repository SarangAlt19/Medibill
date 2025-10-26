import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { Save, Moon, Sun, Edit3, Lock } from 'lucide-react-native';
import { getShopDetails, updateShopDetails } from '@/services/shopService';
import { ShopDetails } from '@/types/database';
import { useTheme } from '@/hooks/ThemeContext';

export default function SettingsScreen() {
  const { theme, colors, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shopInfoEditable, setShopInfoEditable] = useState(false);
  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [billPrefix, setBillPrefix] = useState('');
  const [defaultCgst, setDefaultCgst] = useState('');
  const [defaultSgst, setDefaultSgst] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [autoDeletePeriod, setAutoDeletePeriod] = useState<'never' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('never');

  // Original shop info values for reverting changes
  const [originalShopInfo, setOriginalShopInfo] = useState({
    shopName: '',
    address: '',
    gstNumber: '',
    phone: '',
    email: '',
    licenseNumber: '',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const details = await getShopDetails();
    if (details) {
      const shopData = {
        shopName: details.shop_name,
        address: "Shop No. 83, Near Santosh Hospital, Meenakshipuram Road, Meenakshipuram-250001",
        gstNumber: details.gst_number,
        phone: details.phone,
        email: details.email || '',
        licenseNumber: details.license_number || '',
      };
      
      setShopName(shopData.shopName);
      setAddress(shopData.address);
      setGstNumber(shopData.gstNumber);
      setPhone(shopData.phone);
      setEmail(shopData.email);
      setLicenseNumber(shopData.licenseNumber);
      setOriginalShopInfo(shopData);
      
      setBillPrefix(details.bill_number_prefix);
      setDefaultCgst(details.default_cgst.toString());
      setDefaultSgst(details.default_sgst.toString());
      setApiKey(details.google_vision_api_key || '');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    // Show confirmation dialog only if shop info is being edited
    if (shopInfoEditable) {
      Alert.alert(
        'Confirm Changes',
        'Are you sure you want to save these changes? This will update your shop information.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Save',
            onPress: async () => {
              await performSave();
            },
          },
        ]
      );
    } else {
      // No confirmation needed for other settings
      await performSave();
    }
  };

  const performSave = async () => {
    if (!shopName.trim()) {
      Alert.alert('Error', 'Shop name is required');
      return;
    }

    if (!address.trim()) {
      Alert.alert('Error', 'Address is required');
      return;
    }

    if (!phone.trim()) {
      Alert.alert('Error', 'Phone number is required');
      return;
    }

    const cgst = parseFloat(defaultCgst);
    const sgst = parseFloat(defaultSgst);

    if (isNaN(cgst) || cgst < 0) {
      Alert.alert('Error', 'Invalid CGST percentage');
      return;
    }

    if (isNaN(sgst) || sgst < 0) {
      Alert.alert('Error', 'Invalid SGST percentage');
      return;
    }

    setSaving(true);

    const updated = await updateShopDetails({
      shop_name: shopName.trim(),
      address: address.trim(),
      gst_number: gstNumber.trim(),
      phone: phone.trim(),
      email: email.trim(),
      license_number: licenseNumber.trim(),
      bill_number_prefix: billPrefix.trim() || 'FM',
      default_cgst: cgst,
      default_sgst: sgst,
      google_vision_api_key: apiKey.trim(),
    });

    setSaving(false);

    if (updated) {
      setShopInfoEditable(false); // Lock the fields after successful save
      // Update original values after successful save
      setOriginalShopInfo({
        shopName: shopName.trim(),
        address: address.trim(),
        gstNumber: gstNumber.trim(),
        phone: phone.trim(),
        email: email.trim(),
        licenseNumber: licenseNumber.trim(),
      });
      Alert.alert('Success', 'Settings saved successfully');
    } else {
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const toggleShopInfoEdit = () => {
    if (shopInfoEditable) {
      // User is clicking lock button - revert changes
      setShopName(originalShopInfo.shopName);
      setAddress(originalShopInfo.address);
      setGstNumber(originalShopInfo.gstNumber);
      setPhone(originalShopInfo.phone);
      setEmail(originalShopInfo.email);
      setLicenseNumber(originalShopInfo.licenseNumber);
      setShopInfoEditable(false);
    } else {
      // User is clicking edit button - enable editing
      setShopInfoEditable(true);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Settings</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textTertiary }]}>Configure shop details</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={[styles.section, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Shop Information</Text>
            <TouchableOpacity
              onPress={toggleShopInfoEdit}
              style={[styles.editButton, { backgroundColor: shopInfoEditable ? colors.success : colors.primary }]}
            >
              {shopInfoEditable ? (
                <Lock size={18} color="#ffffff" strokeWidth={2} />
              ) : (
                <Edit3 size={18} color="#ffffff" strokeWidth={2} />
              )}
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>Shop Name *</Text>
          <TextInput
            style={[
              styles.input,
              !shopInfoEditable && styles.disabledInput,
              { 
                backgroundColor: shopInfoEditable ? colors.inputBackground : colors.border,
                borderColor: colors.border,
                color: shopInfoEditable ? colors.text : colors.textTertiary
              }
            ]}
            placeholder="Enter shop name"
            placeholderTextColor={colors.textTertiary}
            value={shopName}
            onChangeText={setShopName}
            editable={shopInfoEditable}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Address *</Text>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              !shopInfoEditable && styles.disabledInput,
              { 
                backgroundColor: shopInfoEditable ? colors.inputBackground : colors.border,
                borderColor: colors.border,
                color: shopInfoEditable ? colors.text : colors.textTertiary
              }
            ]}
            placeholder="Enter shop address"
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={3}
            value={address}
            onChangeText={setAddress}
            editable={shopInfoEditable}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>GST Number</Text>
          <TextInput
            style={[
              styles.input,
              !shopInfoEditable && styles.disabledInput,
              { 
                backgroundColor: shopInfoEditable ? colors.inputBackground : colors.border,
                borderColor: colors.border,
                color: shopInfoEditable ? colors.text : colors.textTertiary
              }
            ]}
            placeholder="Enter GST number"
            placeholderTextColor={colors.textTertiary}
            value={gstNumber}
            onChangeText={setGstNumber}
            editable={shopInfoEditable}
            autoCapitalize="characters"
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Phone Number *</Text>
          <TextInput
            style={[
              styles.input,
              !shopInfoEditable && styles.disabledInput,
              { 
                backgroundColor: shopInfoEditable ? colors.inputBackground : colors.border,
                borderColor: colors.border,
                color: shopInfoEditable ? colors.text : colors.textTertiary
              }
            ]}
            placeholder="Enter phone number"
            placeholderTextColor={colors.textTertiary}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            editable={shopInfoEditable}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Email (Optional)</Text>
          <TextInput
            style={[
              styles.input,
              !shopInfoEditable && styles.disabledInput,
              { 
                backgroundColor: shopInfoEditable ? colors.inputBackground : colors.border,
                borderColor: colors.border,
                color: shopInfoEditable ? colors.text : colors.textTertiary
              }
            ]}
            placeholder="Enter email address"
            placeholderTextColor={colors.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            editable={shopInfoEditable}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>License Number (Optional)</Text>
          <TextInput
            style={[
              styles.input,
              !shopInfoEditable && styles.disabledInput,
              { 
                backgroundColor: shopInfoEditable ? colors.inputBackground : colors.border,
                borderColor: colors.border,
                color: shopInfoEditable ? colors.text : colors.textTertiary
              }
            ]}
            placeholder="Enter medical license number"
            placeholderTextColor={colors.textTertiary}
            value={licenseNumber}
            onChangeText={setLicenseNumber}
            editable={shopInfoEditable}
          />
        </View>

        <View style={[styles.section, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Billing Preferences</Text>

          <Text style={[styles.label, { color: colors.textSecondary }]}>Bill Number Prefix</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            placeholder="FM"
            placeholderTextColor={colors.textTertiary}
            value={billPrefix}
            onChangeText={setBillPrefix}
            autoCapitalize="characters"
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Default CGST %</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            placeholder="6"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
            value={defaultCgst}
            onChangeText={setDefaultCgst}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Default SGST %</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            placeholder="6"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
            value={defaultSgst}
            onChangeText={setDefaultSgst}
          />
        </View>

        <View style={[styles.section, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>OCR Configuration</Text>
          <Text style={[styles.description, { color: colors.textTertiary }]}>
            Enter your Google Vision API key to enable OCR functionality for
            scanning bills. Without this, you can only enter bills manually.
          </Text>

          <Text style={[styles.label, { color: colors.textSecondary }]}>Google Vision API Key</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            placeholder="Enter API key"
            placeholderTextColor={colors.textTertiary}
            value={apiKey}
            onChangeText={setApiKey}
            autoCapitalize="none"
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => {
              Alert.alert(
                'Get API Key',
                'Visit Google Cloud Console to create a Vision API key:\n\n1. Go to console.cloud.google.com\n2. Create a project\n3. Enable Vision API\n4. Create credentials (API key)'
              );
            }}>
            <Text style={[styles.linkText, { color: colors.primary }]}>How to get API key?</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Auto-Delete Bills</Text>
          <Text style={[styles.description, { color: colors.textTertiary }]}>
            Automatically delete old bills to keep your database clean. Bills will be permanently deleted based on the selected period.
          </Text>

          <View style={styles.autoDeleteButtons}>
            {(['never', 'daily', 'weekly', 'monthly', 'yearly'] as const).map((period) => (
              <TouchableOpacity
                key={period}
                style={[
                  styles.autoDeleteButton,
                  { 
                    backgroundColor: autoDeletePeriod === period ? colors.primary : colors.cardBackground,
                    borderColor: colors.border
                  }
                ]}
                onPress={() => setAutoDeletePeriod(period)}
              >
                <Text style={[
                  styles.autoDeleteButtonText,
                  { color: autoDeletePeriod === period ? '#ffffff' : colors.text }
                ]}>
                  {period === 'never' ? 'Never' : period === 'daily' ? 'Daily' : period === 'weekly' ? 'Weekly' : period === 'monthly' ? 'Monthly' : 'Yearly'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {autoDeletePeriod !== 'never' && (
            <Text style={[styles.warningText, { color: colors.error }]}>
              ⚠️ Bills older than {autoDeletePeriod === 'daily' ? '1 day' : autoDeletePeriod === 'weekly' ? '1 week' : autoDeletePeriod === 'monthly' ? '1 month' : '1 year'} will be automatically deleted.
            </Text>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
          
          <View style={styles.themeRow}>
            <Text style={[styles.themeLabel, { color: colors.text }]}>Theme</Text>
            
            <TouchableOpacity
              onPress={toggleTheme}
              activeOpacity={0.8}
              style={[
                styles.customSwitch,
                { backgroundColor: theme === 'dark' ? colors.primary : colors.border }
              ]}
            >
              <View
                style={[
                  styles.switchThumb,
                  theme === 'dark' ? styles.switchThumbActive : styles.switchThumbInactive
                ]}
              >
                {theme === 'dark' ? (
                  <Moon size={18} color="#1e293b" strokeWidth={2.5} fill="#1e293b" />
                ) : (
                  <Sun size={18} color={colors.primary} strokeWidth={2.5} />
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>App Information</Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>Version</Text>
            <Text style={[styles.infoValue, { color: colors.textSecondary }]}>1.0.0</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>App Name</Text>
            <Text style={[styles.infoValue, { color: colors.textSecondary }]}>Friend Medical Billing</Text>
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      <TouchableOpacity
        style={[styles.saveButton, { backgroundColor: colors.success }, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <>
            <Save size={24} color="#ffffff" strokeWidth={2} />
            <Text style={styles.saveButtonText}>Save Settings</Text>
          </>
        )}
      </TouchableOpacity>
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
    padding: 20,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 22,
  },
  autoDeleteButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  autoDeleteButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  autoDeleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  warningText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  themeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  themeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  themeTextContainer: {
    gap: 2,
  },
  themeLabel: {
    fontSize: 17,
    fontWeight: '600',
  },
  themeDescription: {
    fontSize: 14,
  },
  customSwitch: {
    width: 64,
    height: 32,
    borderRadius: 16,
    padding: 2,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  switchThumbInactive: {
    alignSelf: 'flex-start',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 18,
    color: '#111827',
    marginBottom: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  disabledInput: {
    backgroundColor: '#e5e7eb',
    color: '#6b7280',
  },
  linkButton: {
    marginTop: 8,
  },
  linkText: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLabel: {
    fontSize: 18,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  bottomSpacing: {
    height: 100,
  },
  saveButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#2563eb',
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
});
