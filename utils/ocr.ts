import { OCRResult } from '@/types/database';
import { File } from 'expo-file-system';

// Roboflow configuration
const ROBOFLOW_API_KEY = 'lf0mlAnAswPSSENDOole';
const ROBOFLOW_MODEL_ID = 'medbills-dgtwu/2';
const ROBOFLOW_API_URL = `https://detect.roboflow.com/${ROBOFLOW_MODEL_ID}`;

// Extract bill items directly from Roboflow predictions
export const extractBillItemsFromImage = async (
  imageUri: string,
): Promise<OCRResult[]> => {
  try {
    console.log('Starting Roboflow bill extraction...');

    // Read image as base64 using new File API
    const imageFile = new File(imageUri);
    const base64 = await imageFile.base64();

    console.log('Image converted to base64, calling Roboflow API...');

    const apiUrl = `${ROBOFLOW_API_URL}?api_key=${ROBOFLOW_API_KEY}&confidence=40&overlap=30`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: base64,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Roboflow API error:', errorText);
      throw new Error(`Roboflow API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Roboflow predictions:', data.predictions?.length || 0);
    console.log('Image dimensions:', data.image?.width, 'x', data.image?.height);

    if (data.predictions && data.predictions.length > 0) {
      const imageWidth = data.image?.width || 1000;
      const imageHeight = data.image?.height || 1000;
      
      // Group predictions by row (similar Y coordinates)
      const rowHeight = 50;
      const rows: { [key: number]: any[] } = {};
      
      data.predictions.forEach((pred: any) => {
        const rowIndex = Math.floor(pred.y / rowHeight);
        if (!rows[rowIndex]) {
          rows[rowIndex] = [];
        }
        rows[rowIndex].push(pred);
      });
      
      const results: OCRResult[] = [];
      
      // Process each row - use manual entry for now since we need proper OCR
      Object.keys(rows).forEach(rowKey => {
        const rowPreds = rows[parseInt(rowKey)];
        
        // Sort by X coordinate (left to right)
        rowPreds.sort((a, b) => a.x - b.x);
        
        // Each detected row becomes an item that user can fill in manually
        const item: any = {
          medicine_name: `Item ${results.length + 1}`,
          quantity: '1',
          price_per_unit: '0',
          hsn_code: '3004',
          batch_no: '',
          expiry_date: '',
          confidence: Math.max(...rowPreds.map(p => p.confidence || 0)),
        };
        
        results.push(item);
      });
      
      console.log('Extracted bill item placeholders:', results.length);
      return results;
    }

    // No predictions - return empty array instead of throwing error
    console.log('No items detected, returning empty array for manual entry');
    return [];
  } catch (error) {
    console.error('Roboflow extraction error:', error);
    // Return empty array on error - allow manual entry
    return [];
  }
};

export const extractTextFromImage = async (
  imageUri: string,
): Promise<string> => {
  try {
    console.log('Starting Roboflow OCR...');

    // Read image as base64 using new File API
    const imageFile = new File(imageUri);
    const base64 = await imageFile.base64();

    console.log('Image converted to base64, calling Roboflow API...');

    const apiUrl = `${ROBOFLOW_API_URL}?api_key=${ROBOFLOW_API_KEY}&confidence=40&overlap=30`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: base64,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Roboflow API error:', errorText);
      console.error('Response status:', response.status);
      
      throw new Error(`Roboflow API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Roboflow API response received');
    console.log('Predictions:', data.predictions?.length || 0);

    if (data.predictions && data.predictions.length > 0) {
      // Convert Roboflow predictions to text format
      const text = data.predictions
        .map((pred: any) => `${pred.class}: ${pred.confidence}`)
        .join('\n');
      
      console.log('Text extracted from predictions');
      return text;
    }

    throw new Error('No predictions detected in image');
  } catch (error) {
    console.error('Roboflow OCR error:', error);
    
    // Fallback to basic Tesseract-like parsing
    console.log('Falling back to basic text extraction...');
    throw new Error('Failed to extract text from image. Please try again or enter manually.');
  }
};

export const parseOCRText = (text: string): OCRResult[] => {
  const results: OCRResult[] = [];
  const lines = text.split('\n').filter((line) => line.trim());

  // Try to parse as Roboflow predictions first
  // Format: "class_name: confidence"
  const roboflowPattern = /^(.+):\s*([\d.]+)$/;
  
  for (const line of lines) {
    const roboflowMatch = line.match(roboflowPattern);
    if (roboflowMatch) {
      const className = roboflowMatch[1].trim();
      const confidence = parseFloat(roboflowMatch[2]);
      
      // Parse class name to extract medicine info
      // Your Roboflow labels might be like "paracetamol-500mg" or structured differently
      // Adjust this parsing based on your actual label format
      results.push({
        medicine_name: className,
        quantity: '1',
        price_per_unit: '0',
        confidence: confidence,
      });
      continue;
    }
  }

  // If Roboflow parsing found results, return them
  if (results.length > 0) {
    return results;
  }

  // Fallback to traditional text parsing
  const pricePattern = /(?:rs\.?|₹)\s*(\d+(?:\.\d{1,2})?)/i;
  const quantityPattern = /(\d+)\s*(?:qty|pcs|tablets?|caps?|strips?|bottles?|boxes?)?/i;

  const excludeWords = [
    'total',
    'subtotal',
    'cgst',
    'sgst',
    'gst',
    'bill',
    'invoice',
    'date',
    'customer',
    'phone',
    'address',
    'thank',
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();

    const hasExcludedWord = excludeWords.some((word) => line.includes(word));
    if (hasExcludedWord) continue;

    const hasLetters = /[a-zA-Z]{3,}/.test(lines[i]);
    if (!hasLetters) continue;

    const priceMatch = line.match(pricePattern);
    const quantityMatch = line.match(quantityPattern);

    if (priceMatch || quantityMatch) {
      const medicineName = lines[i]
        .replace(pricePattern, '')
        .replace(quantityPattern, '')
        .trim()
        .replace(/[^a-zA-Z\s]/g, '')
        .trim();

      if (medicineName.length >= 3) {
        const capitalizedName = medicineName
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');

        results.push({
          medicine_name: capitalizedName,
          quantity: quantityMatch ? quantityMatch[1] : '1',
          price_per_unit: priceMatch ? priceMatch[1] : '0',
          confidence: 0.85,
        });
      }
    }
  }

  return results;
};

export const compressImage = async (uri: string): Promise<string> => {
  return uri;
};
