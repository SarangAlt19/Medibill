/**
 * Row-Captain Grouping Algorithm
 * 
 * Groups YOLO predictions into rows using a "row-captain" approach.
 * "Med Name" detections act as anchors, and all other predictions
 * are assigned to the nearest anchor based on vertical distance.
 */

// Input prediction format with bbox
export interface Prediction {
  class: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  value?: string; // Optional extracted text value
}

// Output row format
export interface Row {
  medName: string | null;
  batchExp: string | null;
  quantity: string | null;
  hsnCode: string | null;
  amount: string | null;
}

// Field mapping configuration
const FIELD_MAPPING: { [key: string]: keyof Row } = {
  'Med Name': 'medName',
  'Batch Exp': 'batchExp',
  'Quantity': 'quantity',
  'HSN Code': 'hsnCode',
  'Amount': 'amount',
};

// Normalize class names for matching (case-insensitive, flexible whitespace)
function normalizeClassName(className: string): string {
  return className.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Check if a class is "Med Name" (anchor class)
function isAnchorClass(className: string): boolean {
  const normalized = normalizeClassName(className);
  // More flexible matching for medicine name fields
  return normalized === 'med name' || 
         normalized === 'medname' || 
         normalized === 'medicine name' ||
         normalized === 'medicine' ||
         normalized === 'med' ||
         normalized === 'item' ||
         normalized === 'product' ||
         normalized.includes('med name') ||
         normalized.includes('medicine') ||
         normalized.startsWith('med');
}

// Get the field name for a given class
function getFieldName(className: string): keyof Row | null {
  const normalized = normalizeClassName(className);
  
  // Try exact match first
  for (const [key, value] of Object.entries(FIELD_MAPPING)) {
    if (normalizeClassName(key) === normalized) {
      return value;
    }
  }
  
  // Try partial matches
  if (normalized.includes('med name') || normalized.includes('medname') || normalized.includes('medicine name')) {
    return 'medName';
  }
  if (normalized.includes('batch exp') || normalized.includes('batchexp')) {
    return 'batchExp';
  }
  if (normalized.includes('quantity') || normalized === 'qty') {
    return 'quantity';
  }
  if (normalized.includes('hsn code') || normalized.includes('hsncode')) {
    return 'hsnCode';
  }
  if (normalized.includes('amount') || normalized.includes('price')) {
    return 'amount';
  }
  
  return null;
}

// Calculate vertical center of a bbox
function getVerticalCenter(bbox: { y: number; height: number }): number {
  return bbox.y + bbox.height / 2;
}

// Find the nearest anchor for a prediction
function findNearestAnchor(
  prediction: Prediction,
  anchors: Prediction[]
): Prediction | null {
  if (anchors.length === 0) {
    return null;
  }
  
  const predCenter = getVerticalCenter(prediction.bbox);
  let nearestAnchor: Prediction | null = null;
  let minDistance = Infinity;
  let nearestAnchorY = Infinity;
  
  for (const anchor of anchors) {
    const anchorCenter = getVerticalCenter(anchor.bbox);
    const distance = Math.abs(predCenter - anchorCenter);
    
    // If distances are very close (within 5 pixels), prefer the one above (smaller Y)
    if (Math.abs(distance - minDistance) < 5) {
      if (anchorCenter < nearestAnchorY) {
        minDistance = distance;
        nearestAnchor = anchor;
        nearestAnchorY = anchorCenter;
      }
    } else if (distance < minDistance) {
      minDistance = distance;
      nearestAnchor = anchor;
      nearestAnchorY = anchorCenter;
    }
  }
  
  return nearestAnchor;
}

/**
 * Groups YOLO predictions into rows using the row-captain approach.
 * 
 * @param predictions Array of YOLO predictions with bbox structure
 * @returns Array of grouped rows, sorted by anchor Y position
 */
export function groupByRowCaptain(predictions: Prediction[]): Row[] {
  // Defensive check: empty input
  if (!predictions || predictions.length === 0) {
    return [];
  }
  
  // Extract all anchor predictions (Med Name)
  const anchors: Prediction[] = [];
  const nonAnchors: Prediction[] = [];
  
  console.log('[groupByRowCaptain] Processing', predictions.length, 'predictions');
  
  for (const prediction of predictions) {
    if (!prediction.class) {
      console.log('[groupByRowCaptain] Skipping prediction without class');
      continue; // Skip predictions without class
    }
    
    console.log(`[groupByRowCaptain] Checking prediction: class="${prediction.class}", y=${prediction.bbox.y}`);
    
    if (isAnchorClass(prediction.class)) {
      console.log('[groupByRowCaptain] ✓ Found anchor:', prediction.class, 'at y=', prediction.bbox.y);
      anchors.push(prediction);
    } else {
      console.log('[groupByRowCaptain] Non-anchor:', prediction.class);
      nonAnchors.push(prediction);
    }
  }
  
  console.log('[groupByRowCaptain] =============================');
  console.log('[groupByRowCaptain] Total anchors found:', anchors.length);
  console.log('[groupByRowCaptain] Anchor Y positions:', anchors.map(a => `y=${a.bbox.y}`).join(', '));
  console.log('[groupByRowCaptain] Total non-anchors:', nonAnchors.length);
  console.log('[groupByRowCaptain] =============================');
  
  // Defensive check: no anchors found
  if (anchors.length === 0) {
    console.log('[groupByRowCaptain] WARNING: No Med Name anchors found!');
    console.log('[groupByRowCaptain] Available predictions:', predictions.map(p => `${p.class} (y=${p.bbox.y})`));
    // If no anchors, create a single row with all predictions
    const row: Row = {
      medName: null,
      batchExp: null,
      quantity: null,
      hsnCode: null,
      amount: null,
    };
    
    // Try to map predictions anyway
    for (const prediction of predictions) {
      const fieldName = getFieldName(prediction.class);
      if (fieldName && row[fieldName] === null) {
        row[fieldName] = prediction.class;
      }
    }
    
    return [row];
  }
  
  // Sort anchors by Y position (top to bottom)
  anchors.sort((a, b) => {
    const aCenter = getVerticalCenter(a.bbox);
    const bCenter = getVerticalCenter(b.bbox);
    return aCenter - bCenter;
  });
  
  // Create row objects for each anchor
  const rows: Row[] = anchors.map((anchor, index) => ({
    medName: `Medicine ${index + 1}`, // Placeholder since we don't have actual OCR text
    batchExp: null,
    quantity: null,
    hsnCode: null,
    amount: null,
  }));
  
  // Create a map from anchor to row index for quick lookup
  const anchorToRowIndex = new Map<Prediction, number>();
  anchors.forEach((anchor, index) => {
    anchorToRowIndex.set(anchor, index);
  });
  
  // Group non-anchor predictions by their nearest anchor
  const predictionsByAnchor = new Map<Prediction, Prediction[]>();
  for (const anchor of anchors) {
    predictionsByAnchor.set(anchor, []);
  }
  
  for (const prediction of nonAnchors) {
    const nearestAnchor = findNearestAnchor(prediction, anchors);
    if (nearestAnchor) {
      const group = predictionsByAnchor.get(nearestAnchor);
      if (group) {
        group.push(prediction);
        console.log(`[groupByRowCaptain] Assigned ${prediction.class} (y=${prediction.bbox.y}) to anchor at y=${nearestAnchor.bbox.y}`);
      }
    }
  }
  
  // Log grouping results
  console.log('[groupByRowCaptain] Grouping summary:');
  predictionsByAnchor.forEach((predictions, anchor) => {
    console.log(`  Anchor at y=${anchor.bbox.y}: ${predictions.length} predictions - ${predictions.map(p => p.class).join(', ')}`);
  });
  
  // Fill in row fields based on assigned predictions
  for (const [anchor, assignedPredictions] of predictionsByAnchor.entries()) {
    const rowIndex = anchorToRowIndex.get(anchor);
    if (rowIndex === undefined) {
      continue;
    }
    
    const row = rows[rowIndex];
    
    // Sort predictions by field priority to handle multiple predictions per field
    // Priority: Med Name > Batch Exp > Quantity > HSN Code > Amount
    const fieldPriority: (keyof Row)[] = ['medName', 'batchExp', 'quantity', 'hsnCode', 'amount'];
    
    // Group predictions by their field type
    const predictionsByField = new Map<keyof Row, Prediction[]>();
    
    for (const prediction of assignedPredictions) {
      const fieldName = getFieldName(prediction.class);
      if (fieldName) {
        if (!predictionsByField.has(fieldName)) {
          predictionsByField.set(fieldName, []);
        }
        predictionsByField.get(fieldName)!.push(prediction);
      }
    }
    
    // Assign values to row fields, handling multiple predictions per field
    for (const fieldName of fieldPriority) {
      if (fieldName === 'medName') {
        continue; // Already set with placeholder
      }
      
      const fieldPredictions = predictionsByField.get(fieldName);
      if (fieldPredictions && fieldPredictions.length > 0) {
        // If multiple predictions for the same field, use the one with highest confidence
        // or the first one if confidence is the same
        fieldPredictions.sort((a, b) => {
          const confDiff = (b.confidence || 0) - (a.confidence || 0);
          if (Math.abs(confDiff) > 0.01) {
            return confDiff;
          }
          // If confidence is very close, prefer leftmost (smaller x)
          return a.bbox.x - b.bbox.x;
        });
        
        // Use the value field if available, otherwise use placeholders
        const prediction = fieldPredictions[0];
        if (prediction.value) {
          row[fieldName] = prediction.value;
        } else if (fieldName === 'quantity') {
          row[fieldName] = '1'; // Default quantity
        } else if (fieldName === 'amount') {
          row[fieldName] = '0'; // Placeholder amount
        } else if (fieldName === 'hsnCode') {
          row[fieldName] = '3004'; // Default HSN code
        } else {
          row[fieldName] = prediction.class; // Use class name as placeholder
        }
      }
    }
  }
  
  // Return rows sorted by anchor Y position (already sorted, but ensure it)
  return rows.sort((a, b) => {
    const aAnchor = anchors.find(anchor => anchor.class === a.medName);
    const bAnchor = anchors.find(anchor => anchor.class === b.medName);
    
    if (!aAnchor || !bAnchor) {
      return 0;
    }
    
    const aCenter = getVerticalCenter(aAnchor.bbox);
    const bCenter = getVerticalCenter(bAnchor.bbox);
    return aCenter - bCenter;
  });
}

/**
 * Helper function to convert predictions with direct x, y coordinates
 * to the bbox format required by groupByRowCaptain
 */
export function convertToBboxFormat(predictions: Array<{
  class: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  confidence?: number;
  value?: string;
}>): Prediction[] {
  return predictions.map(pred => ({
    class: pred.class,
    bbox: {
      x: pred.x,
      y: pred.y,
      width: pred.width || 0,
      height: pred.height || 0,
    },
    confidence: pred.confidence || 0,
    value: pred.value,
  }));
}

