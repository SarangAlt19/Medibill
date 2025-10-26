import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { X, Zap, ZapOff, Camera as CameraIcon } from 'lucide-react-native';
import { extractTextFromImage, parseOCRText } from '@/utils/ocr';

export default function CameraScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [facing] = useState<CameraType>('back');
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [processing, setProcessing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Define ALL hooks before any conditional returns
  const handleCapture = useCallback(async () => {
    // Use ImagePicker to launch camera - more reliable than CameraView.takePictureAsync
    try {
      console.log('Launching camera with ImagePicker...');
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 0.8,
      });

      console.log('Camera result:', { canceled: result.canceled, assets: result.assets?.length });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        console.log('User canceled or no image');
        return;
      }

      const photo = result.assets[0];
      console.log('Photo captured:', { uri: photo.uri, width: photo.width, height: photo.height });

      if (!photo.uri) {
        throw new Error('No photo URI received');
      }

      setProcessing(true);

      console.log('Starting OCR...');

      // Use Tesseract OCR
      const extractedText = await extractTextFromImage(photo.uri);

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No text extracted from image');
      }

      console.log('Extracted text length:', extractedText.length);

      const ocrResults = parseOCRText(extractedText);

      if (ocrResults.length === 0) {
        Alert.alert(
          'No Items Found',
          'Could not extract items from the image. Please enter details manually.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/bill-form'),
            },
          ]
        );
        setProcessing(false);
        return;
      }

      router.replace({
        pathname: '/ocr-review',
        params: {
          ocrResults: JSON.stringify(ocrResults),
        },
      });
    } catch (error) {
      console.error('OCR Error:', error);
      console.error('Error stack:', (error as any)?.stack);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      Alert.alert(
        'Capture Failed',
        `Error: ${errorMessage}\n\nPlease try again or enter details manually.`,
        [
          {
            text: 'Try Again',
            onPress: () => setProcessing(false),
          },
          {
            text: 'Enter Manually',
            onPress: () => router.replace('/bill-form'),
          },
        ]
      );
      setProcessing(false);
    }
  }, [router]);

  const handleCameraReady = useCallback(() => {
    console.log('Camera onReady callback fired');
    
    // Increased ready delay to 2 seconds for Android to ensure camera is truly ready
    const delay = Platform.OS === 'android' ? 2000 : 800;
    
    setTimeout(() => {
      if (isMounted) {
        setCameraReady(true);
        console.log('Camera ready state set to true');
      }
    }, delay);
  }, [isMounted]);

  // Now the conditional returns come AFTER all hooks
  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563eb" />
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

  if (processing) {
    return (
      <View style={styles.processingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.processingText}>Processing image...</Text>
        <Text style={styles.processingSubtext}>
          Extracting text using Google Vision OCR
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        key="main-camera"
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        enableTorch={flashEnabled}
        onCameraReady={handleCameraReady}
        onMountError={(error: any) => {
          console.error('Camera mount error:', error);
          Alert.alert('Camera Error', 'Failed to initialize camera. Please restart the app.');
        }}
      />
      
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topButton}
          onPress={() => router.back()}>
          <X size={32} color="#ffffff" strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.topButton}
          onPress={() => setFlashEnabled(!flashEnabled)}>
          {flashEnabled ? (
            <Zap size={32} color="#fbbf24" strokeWidth={2} />
          ) : (
            <ZapOff size={32} color="#ffffff" strokeWidth={2} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.overlay}>
        <View style={styles.guideline} />
        <Text style={styles.guideText}>Place bill flat within frame</Text>
        {!cameraReady && (
          <Text style={styles.loadingText}>Initializing camera...</Text>
        )}
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.captureButton,
            !cameraReady && styles.captureButtonDisabled
          ]}
          onPress={handleCapture}
          disabled={!cameraReady || processing}>
          <View style={[
            styles.captureButtonInner,
            !cameraReady && styles.captureButtonInnerDisabled
          ]}>
            <CameraIcon size={36} color="#ffffff" strokeWidth={2} />
          </View>
        </TouchableOpacity>
      </View>
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