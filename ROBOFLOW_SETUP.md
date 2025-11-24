# Roboflow OCR Setup Guide

This app now uses Roboflow for bill OCR instead of Google Vision API.

## Current Configuration

- **API Key**: `lf0mlAnAswPSSENDOole`
- **Project**: `space-crmbn/medbills-dgtwu`
- **Model Version**: 2
- **Model Type**: YOLOv11

## How It Works

1. **Camera captures bill image** → `app/camera.tsx`
2. **Image sent to Roboflow API** → `utils/ocr.ts` (`extractBillItemsFromImage`)
3. **Roboflow detects objects** (medicine names, quantities, prices, etc.)
4. **Results parsed into bill items** and shown in review screen
5. **Fallback**: If Roboflow fails, basic text extraction is attempted

## Training Your Model in Roboflow

### 1. Label Your Images
- Go to [Roboflow](https://app.roboflow.com/space-crmbn/medbills-dgtwu)
- Upload bill images
- Draw bounding boxes around:
  - Medicine names
  - Quantities
  - Prices
  - Batch numbers
  - Expiry dates
  - HSN codes
  
### 2. Create Class Names
Based on what you want to detect, create classes like:
- `medicine_name`
- `quantity`
- `price`
- `batch_no`
- `expiry_date`
- `hsn_code`
- `total`

### 3. Dataset Split
- Train: 70-80%
- Validation: 10-15%
- Test: 10-15%

### 4. Train the Model
- Go to "Train" tab
- Select YOLOv11 (or YOLOv8)
- Start training
- Wait for completion (usually 10-30 minutes)

### 5. Deploy & Test
- Once trained, go to "Deploy" → "Hosted API"
- Test with sample images in Roboflow UI
- Copy the model version number if it changed

## Updating the Code

If you train a new version (e.g., version 3), update in `utils/ocr.ts`:

```typescript
const ROBOFLOW_MODEL_ID = 'medbills-dgtwu/3'; // Change version number
```

## Improving Detection

### Better Labels for Medicine Bills
Consider structuring your labels to capture:
1. **Line items** - Each medicine row as one object
2. **Field types** - Separate detections for name vs price vs quantity
3. **Contextual info** - Customer name, bill number, date

### Preprocessing in Roboflow
- Auto-Orient: Applied ✓
- Resize: 640x640 ✓
- Consider adding:
  - Grayscale (for better text detection)
  - Contrast adjustment
  - Brightness normalization

## Parsing Predictions

The current code in `extractBillItemsFromImage` expects predictions like:

```json
{
  "predictions": [
    {
      "class": "paracetamol",
      "confidence": 0.85,
      "x": 100,
      "y": 200
    }
  ]
}
```

### To Extract Structured Data:
You may need to update the parsing logic based on your actual class names:

```typescript
// Example: if classes are "name-paracetamol", "qty-2", "price-50"
const parseRoboflowPrediction = (predictions) => {
  const items = {};
  
  predictions.forEach(pred => {
    const [type, value] = pred.class.split('-');
    
    if (type === 'name') {
      items.medicine_name = value;
    } else if (type === 'qty') {
      items.quantity = value;
    } else if (type === 'price') {
      items.price_per_unit = value;
    }
  });
  
  return items;
};
```

## Cost & Limits

- **Free Tier**: Up to 1,000 predictions/month
- **Hosted Training**: Included in free tier
- **Upgrading**: If you need more predictions, upgrade plan in Roboflow

## Troubleshooting

### "No items detected"
- Check if model is trained with enough examples (aim for 50+ per class)
- Lower confidence threshold in API call (currently 40%)
- Verify image quality (good lighting, focused)

### Wrong detections
- Add more training images with corrections
- Re-train model with updated dataset
- Adjust confidence threshold

### API Errors
- Verify API key is correct
- Check model version number matches deployed version
- Ensure you haven't exceeded API limits

## Next Steps

1. **Label at least 50-100 images** in Roboflow
2. **Train the model** with proper dataset split
3. **Test predictions** in Roboflow UI first
4. **Update parsing logic** in `utils/ocr.ts` based on your class structure
5. **Iterate**: Add more examples for incorrectly detected items

---

For more help, see [Roboflow Documentation](https://docs.roboflow.com/)
