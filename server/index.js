const express = require('express');
const multer = require('multer');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept image files
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only image files are allowed.'), false);
    }
  }
});

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] ${req.method} ${req.url}`);
  console.log(`   IP: ${req.ip || req.connection.remoteAddress || 'unknown'}`);
  next();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    console.log('   CORS preflight request');
    return res.sendStatus(200);
  }
  next();
});

// Roboflow configuration
const ROBOFLOW_API_KEY = 'lf0mlAnAswPSSENDOole';
const ROBOFLOW_API_URL = 'https://serverless.roboflow.com/medbills-dgtwu/2';

// Helper function to generate placeholder values based on field class
function getPlaceholderValue(className, classId) {
  const normalized = (className || '').toLowerCase().trim();
  
  if (normalized.includes('med name') || normalized.includes('medicine')) {
    return `Medicine Item`;
  }
  if (normalized.includes('quantity') || normalized === 'qty') {
    return '1';
  }
  if (normalized.includes('amount') || normalized.includes('price')) {
    return '0';
  }
  if (normalized.includes('hsn code')) {
    return '3004';
  }
  if (normalized.includes('batch') || normalized.includes('exp')) {
    return '';
  }
  
  return className || '';
}

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('   Health check requested');
  res.json({ status: 'ok', message: 'Server is running', timestamp: new Date().toISOString() });
});

// Multer error handler middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size too large. Maximum size is 10MB.'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: `Unexpected field: ${err.field}. Please send only one file field.`
      });
    }
    return res.status(400).json({
      success: false,
      error: `Multer error: ${err.message}`
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      error: err.message || 'File upload error'
    });
  }
  next();
};

// Analyze bill endpoint - accept any field name for flexibility with React Native
app.post('/analyze-bill', upload.any(), handleMulterError, async (req, res) => {
  const requestId = Date.now();
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  
  console.log(`\n[${requestId}] [REQUEST] New request received`);
  console.log(`[${requestId}]   Client IP: ${clientIP}`);
  console.log(`[${requestId}]   Method: ${req.method}`);
  console.log(`[${requestId}]   URL: ${req.url}`);
  console.log(`[${requestId}]   Headers:`, JSON.stringify(req.headers, null, 2));
  
  try {
    // Check if any file was uploaded
    if (!req.files || req.files.length === 0) {
      console.log(`[${requestId}] [ERROR] No files uploaded`);
      return res.status(400).json({
        success: false,
        error: 'No image file provided. Please upload an image.'
      });
    }

    console.log(`[${requestId}] [SUCCESS] Files received: ${req.files.length}`);
    
    // Get the first file (React Native often sends files with different field names)
    const file = req.files[0];
    console.log(`[${requestId}]   File info:`, {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: `${(file.size / 1024).toFixed(2)} KB`
    });
    
    // Validate it's an image
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      console.log(`[${requestId}] ERROR: Invalid file type: ${file.mimetype}`);
      return res.status(400).json({
        success: false,
        error: `Invalid file type: ${file.mimetype}. Only image files are allowed.`
      });
    }

    // Convert uploaded file to base64
    console.log(`[${requestId}] Converting image to base64...`);
    const base64Image = file.buffer.toString('base64');
    console.log(`[${requestId}] SUCCESS: Base64 conversion complete (${(base64Image.length / 1024).toFixed(2)} KB)`);

    // Prepare the request to Roboflow API
    const roboflowUrl = `${ROBOFLOW_API_URL}?api_key=${ROBOFLOW_API_KEY}`;
    console.log(`[${requestId}] Sending request to Roboflow API...`);
    console.log(`[${requestId}]   URL: ${ROBOFLOW_API_URL}`);

    // Send base64 image to Roboflow API
    const roboflowResponse = await axios.post(
      roboflowUrl,
      base64Image,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000 // 30 second timeout
      }
    );

    console.log(`[${requestId}] SUCCESS: Roboflow API response received`);
    console.log(`[${requestId}]   Predictions: ${roboflowResponse.data.predictions?.length || 0}`);
    console.log(`[${requestId}]   Image dimensions: ${roboflowResponse.data.image?.width || 'N/A'} x ${roboflowResponse.data.image?.height || 'N/A'}`);
    
    // Log prediction classes
    if (roboflowResponse.data.predictions && roboflowResponse.data.predictions.length > 0) {
      console.log(`[${requestId}]   Prediction classes:`);
      roboflowResponse.data.predictions.forEach((pred, idx) => {
        console.log(`[${requestId}]     ${idx + 1}. ${pred.class} (y=${pred.y}, confidence=${pred.confidence?.toFixed(2)})`);
      });
    }

    // Return the predictions with class names as values (since we don't have actual OCR)
    // In the future, we could add Google Vision OCR to extract actual text from each bounding box
    const predictionsWithValues = (roboflowResponse.data.predictions || []).map(pred => ({
      ...pred,
      // Add a 'value' field with a placeholder based on the class
      value: getPlaceholderValue(pred.class, pred.class_id)
    }));
    
    const responseData = {
      success: true,
      predictions: predictionsWithValues,
      image: roboflowResponse.data.image || null
    };
    
    console.log(`[${requestId}] SUCCESS: Sending response to client`);
    console.log(`[${requestId}]   Response size: ${JSON.stringify(responseData).length} bytes`);
    
    res.json(responseData);

  } catch (error) {
    console.error(`[${requestId}] ERROR: Error occurred:`, error.message);
    console.error(`[${requestId}]   Stack:`, error.stack);

    // Handle multer errors (should be caught by middleware, but just in case)
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        console.log(`[${requestId}] ERROR: File size limit exceeded`);
        return res.status(400).json({
          success: false,
          error: 'File size too large. Maximum size is 10MB.'
        });
      }
      if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        console.log(`[${requestId}] ERROR: Unexpected file field: ${error.field}`);
        return res.status(400).json({
          success: false,
          error: `Unexpected field: ${error.field}. Please use field name "image".`
        });
      }
    }

    if (error.response) {
      // Roboflow API error
      console.error(`[${requestId}] ERROR: Roboflow API error:`, error.response.status, error.response.data);
      return res.status(error.response.status || 500).json({
        success: false,
        error: error.response.data?.error || 'Roboflow API error',
        details: error.response.data
      });
    }

    // Generic error
    console.error(`[${requestId}] ERROR: Generic error:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error while analyzing bill'
    });
  }
});

// Start server - listen on all interfaces (0.0.0.0) to accept connections from network
app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log(`Server is running on port ${PORT}`);
  console.log(`Listening on all interfaces (0.0.0.0:${PORT})`);
  console.log(`Accessible from:`);
  console.log(`   - Local: http://localhost:${PORT}`);
  console.log(`   - Network: http://192.168.0.4:${PORT}`);
  console.log(`   - Android Emulator: http://10.0.2.2:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`   - Health: http://localhost:${PORT}/health`);
  console.log(`   - Analyze: http://localhost:${PORT}/analyze-bill`);
  console.log('='.repeat(60));
});

module.exports = app;