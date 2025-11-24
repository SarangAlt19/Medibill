import { OCRResult } from '@/types/database';

/**
 * CUSTOMIZATION GUIDE for Roboflow Predictions
 * 
 * Depending on how you labeled your images in Roboflow, you'll need to
 * customize the prediction parsing logic. Here are common patterns:
 */

// PATTERN 1: Simple class names (e.g., "paracetamol", "aspirin")
// Each prediction is a complete medicine name
export const parseSimpleClassNames = (predictions: any[]): OCRResult[] => {
  return predictions.map(pred => ({
    medicine_name: pred.class,
    quantity: '1',
    price_per_unit: '0',
    confidence: pred.confidence || 0.5,
  }));
};

// PATTERN 2: Structured class names (e.g., "name-paracetamol", "qty-2", "price-50")
// Group related predictions together
export const parseStructuredClassNames = (predictions: any[]): OCRResult[] => {
  const items: { [key: number]: Partial<OCRResult> } = {};
  
  predictions.forEach(pred => {
    const [type, value] = pred.class.split('-');
    const itemIndex = Math.floor(pred.y / 50); // Group by vertical position
    
    if (!items[itemIndex]) {
      items[itemIndex] = {
        medicine_name: '',
        quantity: '1',
        price_per_unit: '0',
        confidence: 0,
      };
    }
    
    switch (type) {
      case 'name':
        items[itemIndex].medicine_name = value;
        break;
      case 'qty':
        items[itemIndex].quantity = value;
        break;
      case 'price':
        items[itemIndex].price_per_unit = value;
        break;
    }
    
    items[itemIndex].confidence = Math.max(
      items[itemIndex].confidence || 0,
      pred.confidence || 0
    );
  });
  
  return Object.values(items).filter(
    item => item.medicine_name && item.medicine_name.length > 0
  ) as OCRResult[];
};

// PATTERN 3: Row-based detection (e.g., "item_row")
// Each prediction represents a complete row, extract text from it
export const parseRowBasedDetection = (predictions: any[]): OCRResult[] => {
  return predictions
    .filter(pred => pred.class === 'item_row')
    .map(pred => {
      // You would need OCR on the cropped region here
      // For now, return placeholder
      return {
        medicine_name: `Item at ${pred.y}`,
        quantity: '1',
        price_per_unit: '0',
        confidence: pred.confidence || 0.5,
      };
    });
};

// PATTERN 4: Field-based detection with coordinates
// Sort predictions by position and group into rows
export const parseFieldBasedDetection = (predictions: any[]): OCRResult[] => {
  // Define your field types
  const fieldTypes = ['medicine_name', 'quantity', 'price', 'batch', 'expiry', 'hsn'];
  
  // Group predictions by vertical position (rows)
  const rowHeight = 40; // Adjust based on your bill layout
  const rows: { [key: number]: any[] } = {};
  
  predictions.forEach(pred => {
    const rowIndex = Math.floor(pred.y / rowHeight);
    if (!rows[rowIndex]) {
      rows[rowIndex] = [];
    }
    rows[rowIndex].push(pred);
  });
  
  // Convert rows to items
  return Object.values(rows).map(rowPreds => {
    const item: OCRResult = {
      medicine_name: '',
      quantity: '1',
      price_per_unit: '0',
      confidence: 0,
    };
    
    // Sort predictions by x-coordinate (left to right)
    rowPreds.sort((a, b) => a.x - b.x);
    
    rowPreds.forEach(pred => {
      if (pred.class.includes('name') || fieldTypes.indexOf(pred.class) === 0) {
        item.medicine_name = pred.class;
      } else if (pred.class.includes('quantity') || pred.class.includes('qty')) {
        item.quantity = pred.class.match(/\d+/)?.[0] || '1';
      } else if (pred.class.includes('price') || pred.class.includes('amount')) {
        item.price_per_unit = pred.class.match(/\d+/)?.[0] || '0';
      }
      
      item.confidence = Math.max(item.confidence, pred.confidence || 0);
    });
    
    return item;
  }).filter(item => item.medicine_name.length > 0);
};

// RECOMMENDED: Adaptive parser that tries multiple patterns
export const parseRoboflowPredictions = (predictions: any[]): OCRResult[] => {
  if (!predictions || predictions.length === 0) {
    return [];
  }
  
  console.log('Sample prediction:', predictions[0]);
  
  // Check if predictions have structured class names (with dashes)
  if (predictions.some(p => p.class?.includes('-'))) {
    console.log('Using structured class name parser');
    return parseStructuredClassNames(predictions);
  }
  
  // Check if predictions have row-based classes
  if (predictions.some(p => p.class?.toLowerCase().includes('row'))) {
    console.log('Using row-based parser');
    return parseRowBasedDetection(predictions);
  }
  
  // Check if multiple field types exist (suggesting field-based detection)
  const uniqueClasses = new Set(predictions.map(p => p.class));
  if (uniqueClasses.size > 3) {
    console.log('Using field-based parser');
    return parseFieldBasedDetection(predictions);
  }
  
  // Default to simple class names
  console.log('Using simple class name parser');
  return parseSimpleClassNames(predictions);
};

/**
 * INSTRUCTIONS FOR YOUR SETUP:
 * 
 * 1. After training your Roboflow model, test it in the Roboflow UI
 * 2. Look at the prediction JSON structure
 * 3. Choose the appropriate parser above based on your class naming
 * 4. Update utils/ocr.ts to import and use your chosen parser:
 * 
 *    import { parseRoboflowPredictions } from './roboflowParsers';
 * 
 *    // In extractBillItemsFromImage:
 *    const results = parseRoboflowPredictions(data.predictions);
 * 
 * 5. Test with real images and iterate!
 */
