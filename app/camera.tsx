import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera as CameraIcon } from 'lucide-react-native';
import { extractBillItemsFromImage, extractTextFromImage, parseOCRText } from '@/utils/ocr';
import { extractBillData } from '@/utils/billExtraction';
import { Platform } from 'react-native';

// API endpoint configuration
const LAPTOP_IP = '192.168.0.6';
const SERVER_PORT = 3000;

const getApiBaseUrl = () => {
  if (__DEV__) {
    if (Platform.OS === 'android') {
      return `http://${LAPTOP_IP}:${SERVER_PORT}`;
    } else {
      return `http://${LAPTOP_IP}:${SERVER_PORT}`;
    }
  }
  return `http://${LAPTOP_IP}:${SERVER_PORT}`;
};

const API_BASE_URL = getApiBaseUrl();
const ANALYZE_BILL_ENDPOINT = `${API_BASE_URL}/analyze-bill`;

interface Prediction {
  class: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  confidence?: number;
}

interface AnalyzeBillResponse {
  success: boolean;
  predictions?: Prediction[];
  image?: {
    width?: number;
    height?: number;
  };
  error?: string;
}

// Upload image and extract bill data using row-captain algorithm
async function uploadAndExtractBill(photo: {
  uri: string;
  fileName?: string;
  type?: string;
}): Promise<ReturnType<typeof extractBillData>> {
  console.log('==== uploadAndExtractBill START ====');
  console.log('Input photo:', { uri: photo.uri, fileName: photo.fileName, type: photo.type });
  try {
    // Extract filename if missing
    let fileName = photo.fileName;
    if (!fileName && photo.uri) {
      const uriParts = photo.uri.split('/');
      fileName = uriParts[uriParts.length - 1] || 'image.jpg';
      if (!fileName.includes('.')) {
        const mimeType = photo.type || 'image/jpeg';
        const ext = mimeType.split('/')[1] || 'jpg';
        fileName = `${fileName}.${ext}`;
      }
    }

    // Set correct MIME type
    let mimeType = photo.type || 'image/jpeg';
    if (!mimeType || mimeType === 'image') {
      const ext = fileName?.split('.').pop()?.toLowerCase();
      const mimeMap: { [key: string]: string } = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
      };
      mimeType = mimeMap[ext || 'jpg'] || 'image/jpeg';
    }

    console.log('Uploading image to:', ANALYZE_BILL_ENDPOINT);

    // Create FormData
    const formData = new FormData();
    formData.append('image', {
      uri: photo.uri,
      type: mimeType,
      name: fileName,
    } as any);

    // Send request
    console.log('Sending POST request...');
    const response = await fetch(ANALYZE_BILL_ENDPOINT, {
      method: 'POST',
      body: formData,
    });

    console.log('Response status:', response.status, response.statusText);
    console.log('Response ok:', response.ok);
    
    const responseText = await response.text();
    console.log('Raw response text (first 500 chars):', responseText.substring(0, 500));
    
    let data: AnalyzeBillResponse;
    
    try {
      data = JSON.parse(responseText);
      console.log('Parsed response data:', data);
    } catch (parseError) {
      console.error('Failed to parse JSON response:', parseError);
      console.error('Full response text:', responseText);
      throw new Error(`Invalid JSON response from server: ${responseText.substring(0, 200)}`);
    }

    console.log('Checking response validity...');
    console.log('response.ok:', response.ok);
    console.log('data.success:', data.success);
    
    if (!response.ok || !data.success) {
      console.error('Response not OK or success=false');
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    if (!data.predictions || data.predictions.length === 0) {
      console.log('No predictions received from API');
      return {
        medicines: [],
        metadata: {
          customerName: null,
          customerPhone: null,
          customerAddress: null,
          billNumber: null,
          billDate: null,
          doctorName: null,
        },
        totalMedicines: 0,
      };
    }

    console.log('\n==== API RESPONSE ====');
    console.log('Total predictions received:', data.predictions.length);
    console.log('Prediction classes:', data.predictions.map((p: any) => p.class));
    console.log('Full predictions:', JSON.stringify(data.predictions, null, 2));

    // Extract bill data using row-captain algorithm
    console.log('\n==== CALLING extractBillData ====');
    let extractedData;
    try {
      extractedData = extractBillData(data.predictions);
      console.log('\n==== EXTRACTION COMPLETE ====');
      console.log('Total medicines extracted:', extractedData.totalMedicines);
      console.log('Medicine rows:', JSON.stringify(extractedData.medicines, null, 2));
      console.log('Metadata:', extractedData.metadata);
    } catch (extractError) {
      console.error('\n==== EXTRACTION FAILED ====');
      console.error('Extract error:', extractError);
      console.error('Extract error stack:', (extractError as any)?.stack);
      throw new Error(`Failed to extract bill data: ${extractError instanceof Error ? extractError.message : 'Unknown error'}`);
    }
    console.log('==== uploadAndExtractBill END ====\n');

    return extractedData;
  } catch (error) {
    console.error('Error uploading image:', error);
    
    if (error instanceof TypeError && error.message.includes('Network request failed')) {
      const platformHint = Platform.OS === 'android' 
        ? '\n\nFor Android emulator, make sure:\n- Server is running on port 3000\n- Using 10.0.2.2 instead of localhost\n\nFor physical device, use your computer\'s IP address instead of localhost.'
        : '\n\nMake sure:\n- Server is running on port 3000\n- For physical device, use your computer\'s IP address instead of localhost.';
      
      throw new Error(`Network request failed. Cannot connect to server at ${ANALYZE_BILL_ENDPOINT}${platformHint}`);
    }
    
    throw error;
  }
}

export default function CameraScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    // Auto-launch camera when component mounts
    if (permission?.granted && !processing) {
      handleCapture();
    }
  }, [permission?.granted]);

  const handleCapture = useCallback(async () => {
    try {
      console.log('Launching camera with ImagePicker...');
      setProcessing(true);
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 0.8,
        cameraType: ImagePicker.CameraType.back,
      });

      console.log('Camera result:', { canceled: result.canceled, assets: result.assets?.length });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        console.log('User canceled or no image');
        setProcessing(false);
        router.back();
        return;
      }

      const photo = result.assets[0];
      console.log('Photo captured:', { uri: photo.uri, width: photo.width, height: photo.height });

      if (!photo.uri) {
        throw new Error('No photo URI received');
      }

      console.log('==== STARTING UPLOAD PROCESS ====');
      console.log('Photo URI:', photo.uri);
      setUploading(true);

      try {
        // Upload and extract bill data using row-captain algorithm
        console.log('Calling uploadAndExtractBill...');
        const extractedData = await uploadAndExtractBill({
          uri: photo.uri,
          fileName: photo.fileName || undefined,
          type: photo.type || 'image/jpeg',
        });

        console.log('==== UPLOAD COMPLETE ====');
        console.log('Total medicines extracted:', extractedData.medicines.length);
        console.log('Medicine details:', extractedData.medicines);
        
        setUploading(false);
        
        // Show extraction count
        const extractionSummary = `Found ${extractedData.medicines.length} medicine row(s)`;
        console.log(extractionSummary);

        // Convert to OCR results format for compatibility
        console.log('Converting to OCR results format...');
        const ocrResults = extractedData.medicines.map((row, index) => ({
          medicine_name: row.medName || `Item ${index + 1}`,
          quantity: row.quantity || '1',
          price_per_unit: row.amount || '0',
          hsn_code: row.hsnCode || '',
          batch_no: row.batchExp || '',
          expiry_date: '',
          confidence: 0.8,
        }));

        console.log('OCR Results converted:', ocrResults.length, 'items');
        console.log('OCR Results:', ocrResults);

        if (ocrResults.length === 0) {
        // No items detected - offer manual entry
        Alert.alert(
          'No Items Detected',
          'The image quality may be too low or the bill format is unclear. Would you like to enter items manually?',
          [
            {
              text: 'Try Again',
              onPress: () => {
                setProcessing(false);
                // Re-launch camera
                setTimeout(() => handleCapture(), 100);
              },
            },
            {
              text: 'Manual Entry',
              onPress: () => {
                setProcessing(false);
                router.replace('/bill-form');
              },
            },
          ]
        );
        return;
      }

        // Pass both OCR results and metadata directly to bill form
        router.replace({
          pathname: '/bill-form',
          params: {
            ocrResults: JSON.stringify(ocrResults),
            billMetadata: JSON.stringify(extractedData.metadata),
            totalMedicines: extractedData.totalMedicines.toString(),
          },
        });
      } catch (uploadError) {
        setUploading(false);
        throw uploadError;
      }
    } catch (error) {
      console.error('OCR Error:', error);
      console.error('Error stack:', (error as any)?.stack);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      setUploading(false);
      setProcessing(false);
      
      Alert.alert(
        'Capture Failed',
        `Error: ${errorMessage}\n\nPlease try again or enter details manually.`,
        [
          {
            text: 'Try Again',
            onPress: () => {
              // State already reset above
            },
          },
          {
            text: 'Enter Manually',
            onPress: () => router.replace('/bill-form'),
          },
        ]
      );
    }
  }, [router]);

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.permissionText}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Camera Permission Required</Text>
        <Text style={styles.permissionText}>
          We need your permission to use the camera for scanning bills
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.processingContainer}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={styles.processingText}>
        {uploading 
          ? 'Uploading & analyzing...' 
          : processing 
          ? 'Processing image...' 
          : 'Opening camera...'}
      </Text>
      <Text style={styles.processingSubtext}>
        {uploading 
          ? 'Using row-captain algorithm to extract medicines' 
          : processing 
          ? 'Extracting items using AI' 
          : 'Please wait'}
      </Text>
      <TouchableOpacity 
        style={styles.cancelButton} 
        onPress={() => {
          setProcessing(false);
          setUploading(false);
          router.back();
        }}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 18,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 26,
  },
  permissionButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 12,
  },
  permissionButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  cancelButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  cancelButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    zIndex: 2,
  },
  topButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 24,
    padding: 12,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    pointerEvents: 'none',
  },
  guideline: {
    width: '85%',
    height: '60%',
    borderWidth: 3,
    borderColor: '#ffffff',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  guideText: {
    fontSize: 20,
    color: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 20,
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 16,
    color: '#fbbf24',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 50,
    alignItems: 'center',
    zIndex: 2,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInnerDisabled: {
    backgroundColor: '#6b7280',
  },
  processingContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  processingText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 20,
  },
  processingSubtext: {
    fontSize: 18,
    color: '#6b7280',
    marginTop: 8,
  },
});
