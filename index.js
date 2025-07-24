require('dotenv').config();
const express = require('express');
const OAuthClient = require('intuit-oauth');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// 🔐 Firebase Admin
const serviceAccount = JSON.parse(fs.readFileSync('/etc/secrets/firebase-service-account.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// 🛣️ Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// 🔐 QuickBooks OAuth
const oauthClient = new OAuthClient({
  clientId: process.env.QBO_CLIENT_ID,
  clientSecret: process.env.QBO_CLIENT_SECRET,
  environment: process.env.ENVIRONMENT,
  redirectUri: process.env.QBO_REDIRECT_URI
});

const refreshTokenIfNeeded = require('./utils/refreshToken');

// 🌐 Step 1: Start OAuth
app.get('/', (req, res) => {
  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: 'intuit-test'
  });
  console.log('🔗 OAuth URL:', authUri);
  res.redirect(authUri);
});

// 🔄 Step 2: Callback
app.get('/callback', async (req, res) => {
  try {
    const token = await oauthClient.createToken(req.url);
    const tokenData = token.getToken();
    const realmId = tokenData.realmId;

    await db.collection('qbo_tokens').doc(realmId).set({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      x_refresh_token_expires_in: tokenData.x_refresh_token_expires_in,
      created_at: new Date().toISOString()
    });

    console.log('✅ Token stored for realm:', realmId);
    res.send(`✅ Authorization complete! Use /company-info/${realmId}`);
  } catch (error) {
    console.error('❌ Callback Error:', error);
    res.status(500).send('❌ Error during OAuth callback.');
  }
});

// 📊 Company Info
app.get('/company-info/:realmId', async (req, res) => {
  const realmId = req.params.realmId;
  try {
    const doc = await db.collection('qbo_tokens').doc(realmId).get();
    if (!doc.exists) return res.status(404).send('❌ Token not found');

    const tokenData = doc.data();
    const accessToken = await refreshTokenIfNeeded(realmId, tokenData);
    const url = `v3/company/${realmId}/companyinfo/${realmId}`;

    const response = await oauthClient.makeApiCall({ url, token: accessToken });
    res.json(JSON.parse(response.body));
  } catch (error) {
    console.error('❌ Company info fetch failed:', error);
    res.status(500).send('❌ Failed to fetch company info');
  }
});

// 📄 Accounts
app.get('/accounts/:realmId', async (req, res) => {
  const realmId = req.params.realmId;
  try {
    const doc = await db.collection('qbo_tokens').doc(realmId).get();
    if (!doc.exists) return res.status(404).send('❌ Token not found');

    const tokenData = doc.data();
    const url = `v3/company/${realmId}/accounts`;
    const response = await oauthClient.makeApiCall({ url, token: tokenData.access_token });

    res.json(JSON.parse(response.body));
  } catch (error) {
    console.error('❌ Accounts fetch failed:', error);
    res.status(500).send('❌ Failed to fetch accounts');
  }
});

// 📄 Vendors
app.get('/vendors/:realmId', async (req, res) => {
  const realmId = req.params.realmId;
  try {
    const doc = await db.collection('qbo_tokens').doc(realmId).get();
    if (!doc.exists) return res.status(404).send('❌ Token not found');

    const tokenData = doc.data();
    const url = `v3/company/${realmId}/vendor`;
    const response = await oauthClient.makeApiCall({ url, token: tokenData.access_token });

    res.json(JSON.parse(response.body));
  } catch (error) {
    console.error('❌ Vendors fetch failed:', error);
    res.status(500).send('❌ Failed to fetch vendors');
  }
});

// 📄 Invoices
app.get('/invoices/:realmId', async (req, res) => {
  const realmId = req.params.realmId;
  try {
    const doc = await db.collection('qbo_tokens').doc(realmId).get();
    if (!doc.exists) return res.status(404).send('❌ Token not found');

    const tokenData = doc.data();
    const url = `v3/company/${realmId}/invoice`;
    const response = await oauthClient.makeApiCall({ url, token: tokenData.access_token });

    res.json(JSON.parse(response.body));
  } catch (error) {
    console.error('❌ Invoices fetch failed:', error);
    res.status(500).send('❌ Failed to fetch invoices');
  }
});

app.use('/qbo', require('./routes/qboData'));

// ✅ Start the server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});