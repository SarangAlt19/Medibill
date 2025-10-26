import { OCRResult } from '@/types/database';
import { File } from 'expo-file-system';

export const extractTextFromImage = async (
  imageUri: string,
): Promise<string> => {
  try {
    console.log('Starting Google Vision OCR...');
    
    // Get API key from environment
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_VISION_API_KEY;
    
    if (!apiKey || apiKey === 'your_api_key_here') {
      throw new Error('Google Vision API key not configured. Please add your API key to the .env file.');
    }

    // Read image as base64 using new File API
    const imageFile = new File(imageUri);
    const base64 = await imageFile.base64();

    console.log('Image converted to base64, calling Google Vision API...');

    const apiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

    const requestBody = {
      requests: [
        {
          image: {
            content: base64,
          },
          features: [
            {
              type: 'DOCUMENT_TEXT_DETECTION',
              maxResults: 1,
            },
          ],
        },
      ],
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Vision API error:', errorText);
      console.error('Response status:', response.status);
      console.error('Response headers:', JSON.stringify(response.headers));
      
      let errorMessage = `OCR API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch (e) {
        // Error text is not JSON
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('Google Vision API response received');

    if (data.responses && data.responses[0]?.fullTextAnnotation?.text) {
      const text = data.responses[0].fullTextAnnotation.text;
      console.log('Text extracted, length:', text.length);
      return text;
    }

    if (data.responses && data.responses[0]?.error) {
      throw new Error(`OCR API error: ${data.responses[0].error.message}`);
    }

    throw new Error('No text detected in image');
  } catch (error) {
    console.error('OCR error:', error);
    throw new Error('Failed to extract text from image');
  }
};

export const parseOCRText = (text: string): OCRResult[] => {
  const results: OCRResult[] = [];
  const lines = text.split('\n').filter((line) => line.trim());

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
