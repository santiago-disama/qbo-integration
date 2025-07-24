require('dotenv').config();
const express = require('express');
const OAuthClient = require('intuit-oauth');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 3000;

// 🔐 Initialize Firebase Admin
const fs = require('fs');
const serviceAccount = JSON.parse(fs.readFileSync('/etc/secrets/firebase-service-account.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

const qboDataRoutes = require('./routes/qboData');
app.use('/qbo', qboDataRoutes);

// 🔐 QuickBooks OAuth config
const oauthClient = new OAuthClient({
  clientId: process.env.QBO_CLIENT_ID,
  clientSecret: process.env.QBO_CLIENT_SECRET,
  environment: process.env.ENVIRONMENT, // 'sandbox' or 'production'
  redirectUri: process.env.QBO_REDIRECT_URI
});

// 🌐 Step 1: Redirect to QuickBooks login
app.get('/', (req, res) => {
  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: 'intuit-test'
  });

  console.log('🔗 OAuth URL:', authUri);
  res.redirect(authUri);
});

// 🔄 Step 2: Callback from QuickBooks
app.get('/callback', async (req, res) => {
  try {
    const token = await oauthClient.createToken(req.url);
    const tokenData = token.getToken();

    const realmId = tokenData.realmId;

    // 📝 Store in Firestore
    await db.collection('qbo_tokens').doc(realmId).set({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      x_refresh_token_expires_in: tokenData.x_refresh_token_expires_in,
      created_at: new Date().toISOString()
    });

    console.log('✅ Token stored for realm:', realmId);
    res.redirect('/dashboard.html');
  } catch (error) {
    console.error('❌ Callback Error:', error);
    res.status(500).send('❌ Error during OAuth callback.');
  }
});

// 📊 Step 3: Get company info
const refreshTokenIfNeeded = require('./utils/refreshToken');

app.get('/company-info', async (req, res) => {
  try {
    const realmId = process.env.TEST_REALM_ID;
    const doc = await db.collection('qbo_tokens').doc(realmId).get();

    if (!doc.exists) {
      return res.status(404).send('❌ No token found. Authorize first.');
    }

    const tokenData = doc.data();
    const accessToken = await refreshTokenIfNeeded(realmId, tokenData);

    const url = `v3/company/${realmId}/companyinfo/${realmId}`;
    const response = await oauthClient.makeApiCall({ url, token: accessToken });

    res.json(JSON.parse(response.body));
  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).send('❌ Could not fetch company info.');
  }
});

// 📄 Get list of accounts
app.get('/qbo/accounts', async (req, res) => {
  try {
    const realmId = process.env.TEST_REALM_ID;
    const doc = await db.collection('qbo_tokens').doc(realmId).get();
    if (!doc.exists) return res.status(404).send('❌ Token not found');
    
    const tokenData = doc.data();
    const url = `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/accounts`;

    const response = await oauthClient.makeApiCall({
      url,
      token: tokenData.access_token
    });

    res.json(JSON.parse(response.body));
  } catch (error) {
    console.error('❌ Accounts fetch failed:', error);
    res.status(500).send('❌ Failed to fetch accounts');
  }
});

// 📄 Get list of vendors
app.get('/qbo/vendors', async (req, res) => {
  try {
    const realmId = process.env.TEST_REALM_ID;
    const doc = await db.collection('qbo_tokens').doc(realmId).get();
    if (!doc.exists) return res.status(404).send('❌ Token not found');

    const tokenData = doc.data();
    const url = `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/vendor`;

    const response = await oauthClient.makeApiCall({
      url,
      token: tokenData.access_token
    });

    res.json(JSON.parse(response.body));
  } catch (error) {
    console.error('❌ Vendors fetch failed:', error);
    res.status(500).send('❌ Failed to fetch vendors');
  }
});

// 📄 Get list of invoices
app.get('/qbo/invoices', async (req, res) => {
  try {
    const realmId = process.env.TEST_REALM_ID;
    const doc = await db.collection('qbo_tokens').doc(realmId).get();
    if (!doc.exists) return res.status(404).send('❌ Token not found');

    const tokenData = doc.data();
    const url = `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/invoice`;

    const response = await oauthClient.makeApiCall({
      url,
      token: tokenData.access_token
    });

    res.json(JSON.parse(response.body));
  } catch (error) {
    console.error('❌ Invoices fetch failed:', error);
    res.status(500).send('❌ Failed to fetch invoices');
  }
});