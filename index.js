require('dotenv').config();
const express = require('express');
const OAuthClient = require('intuit-oauth');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const app = express();
const cors = require('cors');

// Allow cross‑origin requests and JSON bodies
app.use(cors({ origin: true }));
app.use(express.json());

// Initialize Firebase Admin
const serviceAccountPath = '/etc/secrets/firebase-service-account.json';
if (fs.existsSync(serviceAccountPath)) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  });
} else {
  console.warn('⚠️ Service account JSON not found at', serviceAccountPath);
}

// OAuth client setup
const oauthClient = new OAuthClient({
  clientId: process.env.QBO_CLIENT_ID,
  clientSecret: process.env.QBO_CLIENT_SECRET,
  environment: process.env.ENVIRONMENT,
  redirectUri: process.env.QBO_REDIRECT_URI,
});

// 1. Start OAuth flow
app.get('/startOAuth', (req, res) => {
  const authUri = oauthClient.authorizeUri({
    scope: [
      OAuthClient.scopes.Accounting,
      OAuthClient.scopes.OpenId,
      OAuthClient.scopes.Email,
      OAuthClient.scopes.Profile,
    ],
    state: 'testState',
  });
  res.redirect(authUri);
});

// 2. OAuth callback
app.get('/callback', async (req, res) => {
  try {
    // Build full URL (including host & protocol) for the OAuth SDK
    const callbackUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const token = await oauthClient.createToken(callbackUrl);
    const tokenJson = token.getJson();

    // Extract realmId
    const realmId = token.token.realmId;
    if (!realmId) {
      throw new Error('No realmId returned in token response');
    }

    // Persist tokens + realmId to Firestore
    await admin
      .firestore()
      .collection('qboTokens')
      .doc(realmId)
      .set({ ...tokenJson, realmId });

    // Return realmId for immediate use
    res.json({ success: true, realmId, data: tokenJson });
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Mount QBO routes
const qboRoutes = require('./routes/qboData');
app.use('/qbo', qboRoutes);

// Health check
app.get('/', (req, res) => res.send('QuickBooks integration up and running!'));

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server listening on port ${port}`);
});
