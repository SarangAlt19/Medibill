# Google Vision API Setup for Android

## Current Issue: 403 Error

Your API key `AIzaSyDXvMuh9sZ_gE6sKGlDXu_GjTTCM2sTw3M` is getting a 403 error because it needs Android app restrictions configured.

## Solution: Configure Android App Restrictions

### Step 1: Go to Google Cloud Console
1. Visit: https://console.cloud.google.com/apis/credentials
2. Find your API key: **API key 1**
3. Click on the key name to edit it

### Step 2: Configure Application Restrictions

In the "Application restrictions" section:

1. **Select "Android apps"** (currently set to "None")

2. **Add your Android app details:**
   - **Package name:** `com.friendmedical.billing`
   - **SHA-1 certificate fingerprint:** `E7:DE:95:E3:F2:5B:8D:D5:ED:95:59:FF:CA:09:C9:8E:E1:0B:3C:D1`

3. Click **"Done"** or **"Add an item"** to add the package

### Step 3: API Restrictions

Keep the API restrictions as:
- **Don't restrict key** (or specifically allow "Cloud Vision API")

### Step 4: Save Changes

Click **"Save"** at the bottom of the page.

**⚠️ Important:** It may take up to 5 minutes for the settings to take effect (as noted in the console).

---

## Alternative Solution: Use Unrestricted Key (Not Recommended for Production)

If you want to test immediately without restrictions:

1. Keep "Application restrictions" set to **"None"**
2. Keep "API restrictions" set to **"Don't restrict key"**
3. Click **"Save"**

**Warning:** This is less secure and should only be used for testing. Always add restrictions before deploying to production.

---

## Verify Your API Key is Working

After configuring restrictions, test the API with this command:

\`\`\`bash
curl -X POST \
  'https://vision.googleapis.com/v1/images:annotate?key=AIzaSyDXvMuh9sZ_gE6sKGlDXu_GjTTCM2sTw3M' \
  -H 'Content-Type: application/json' \
  -d '{
    "requests": [{
      "image": {
        "content": "/9j/4AAQSkZJRg..."
      },
      "features": [{
        "type": "DOCUMENT_TEXT_DETECTION"
      }]
    }]
  }'
\`\`\`

If you get a valid response (not 403), the key is working correctly.

---

## Current Configuration (from your screenshots)

✅ **Package name:** com.friendmedical.billing
✅ **SHA-1 fingerprint:** E7:DE:95:E3:F2:5B:8D:D5:ED:95:59:FF:CA:09:C9:8E:E1:0B:3C:D1
✅ **API enabled:** Cloud Vision API
⚠️ **Restriction needed:** Android apps (currently None)

---

## Troubleshooting

### Still getting 403 after adding restrictions?

1. **Wait 5 minutes** - API key changes take time to propagate
2. **Verify the SHA-1 fingerprint matches** - Use this command to get your current fingerprint:
   \`\`\`bash
   keytool -keystore path-to-debug-or-production-keystore -list -v
   \`\`\`
3. **Check that Cloud Vision API is enabled** in your Google Cloud project
4. **Verify package name** matches exactly: `com.friendmedical.billing`

### Testing without Android restrictions temporarily

For immediate testing, you can:
1. Set Application restrictions to **"None"**
2. Set API restrictions to **"Don't restrict key"**
3. Test the OCR functionality
4. Add restrictions back before production deployment

---

## Security Best Practices

1. ✅ Always use Android app restrictions for production
2. ✅ Keep your API key secure (don't commit to public repositories)
3. ✅ Monitor API usage in Google Cloud Console
4. ✅ Set up billing alerts to prevent unexpected charges
5. ✅ Use environment variables for API keys (already implemented in this app)

---

## API Key Already Configured in App

Your API key has been saved to the database. You can verify/update it in the app:

1. Open the app
2. Go to **Settings** tab
3. Scroll to "OCR Configuration"
4. Your API key should be there

No need to manually enter it again - it's already configured!
