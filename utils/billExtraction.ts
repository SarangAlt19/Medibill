/**
 * Bill Extraction Utilities
 * Extracts medicine items and bill metadata from YOLO predictions
 */

import { groupByRowCaptain, convertToBboxFormat, Prediction, Row } from './rowGrouping';

export interface BillMetadata {
  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  billNumber: string | null;
  billDate: string | null;
  doctorName: string | null;
}

export interface ExtractedBillData {
  medicines: Row[];
  metadata: BillMetadata;
  totalMedicines: number;
}

// Field classes that represent bill metadata (not medicine fields)
const METADATA_CLASSES = {
  customerName: ['customer name', 'customer', 'name', 'patient name', 'patient'],
  customerPhone: ['phone', 'mobile', 'contact', 'phone number', 'mobile number'],
  customerAddress: ['address', 'location', 'residence'],
  billNumber: ['bill number', 'bill no', 'invoice number', 'invoice no', 'bill no.'],
  billDate: ['date', 'bill date', 'invoice date', 'dated'],
  doctorName: ['doctor', 'doctor name', 'prescribed by', 'dr.'],
};

// Normalize class name for matching
function normalizeClassName(className: string): string {
  return className.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Check if a class matches metadata field
function matchesMetadataField(className: string, field: keyof BillMetadata): boolean {
  const normalized = normalizeClassName(className);
  const patterns = METADATA_CLASSES[field];
  return patterns.some(pattern => normalized.includes(pattern));
}

// Extract metadata from predictions
function extractMetadata(predictions: Prediction[]): BillMetadata {
  const metadata: BillMetadata = {
    customerName: null,
    customerPhone: null,
    customerAddress: null,
    billNumber: null,
    billDate: null,
    doctorName: null,
  };

  // Sort predictions by confidence (highest first) to prioritize better detections
  const sortedPredictions = [...predictions].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

  for (const prediction of sortedPredictions) {
    const className = prediction.class || '';
    
    // Skip medicine-related classes
    if (normalizeClassName(className).includes('med name') ||
        normalizeClassName(className).includes('batch exp') ||
        normalizeClassName(className).includes('quantity') ||
        normalizeClassName(className).includes('hsn code') ||
        normalizeClassName(className).includes('amount')) {
      continue;
    }

    // Match to metadata fields
    for (const field of Object.keys(metadata) as Array<keyof BillMetadata>) {
      if (metadata[field] === null && matchesMetadataField(className, field)) {
        metadata[field] = className;
        break; // Use first match only
      }
    }
  }

  return metadata;
}

// Filter out metadata predictions from medicine predictions
function filterMedicinePredictions(predictions: Prediction[]): Prediction[] {
  return predictions.filter(pred => {
    const className = normalizeClassName(pred.class || '');
    
    // Keep medicine-related classes
    if (className.includes('med name') ||
        className.includes('batch exp') ||
        className.includes('quantity') ||
        className.includes('hsn code') ||
        className.includes('amount')) {
      return true;
    }

    // Filter out known metadata classes
    for (const fieldPatterns of Object.values(METADATA_CLASSES)) {
      if (fieldPatterns.some(pattern => className.includes(pattern))) {
        return false;
      }
    }

    // Keep unknown classes (might be medicine names)
    return true;
  });
}

/**
 * Extract complete bill data from YOLO predictions
 * @param predictions Array of YOLO predictions
 * @returns Extracted bill data with medicines and metadata
 */
export function extractBillData(predictions: Array<{
  class: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  confidence?: number;
}>): ExtractedBillData {
  // Convert to bbox format
  const predictionsWithBbox = convertToBboxFormat(predictions);
  console.log('[extractBillData] Total predictions:', predictionsWithBbox.length);

  // Extract metadata first
  const metadata = extractMetadata(predictionsWithBbox);
  console.log('[extractBillData] Metadata extracted:', metadata);

  // Filter to get only medicine-related predictions
  const medicinePredictions = filterMedicinePredictions(predictionsWithBbox);
  console.log('[extractBillData] Medicine predictions after filter:', medicinePredictions.length);
  console.log('[extractBillData] Medicine prediction classes:', medicinePredictions.map(p => p.class));

  // Group medicines using row-captain algorithm
  const medicines = groupByRowCaptain(medicinePredictions);
  console.log('[extractBillData] Grouped medicines:', medicines.length);

  // Filter out rows without medicine names
  const validMedicines = medicines.filter(row => row.medName !== null);
  console.log('[extractBillData] Valid medicines (with names):', validMedicines.length);

  return {
    medicines: validMedicines,
    metadata,
    totalMedicines: validMedicines.length,
  };
}

