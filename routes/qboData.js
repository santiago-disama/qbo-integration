const express = require('express');
const OAuthClient = require('intuit-oauth');
const { db } = require('../utils/firebase');
const refreshTokenIfNeeded = require('../utils/refreshToken');

const router = express.Router();

// 🔐 Intuit OAuth Client Setup
const oauthClient = new OAuthClient({
  clientId: process.env.QBO_CLIENT_ID,
  clientSecret: process.env.QBO_CLIENT_SECRET,
  environment: process.env.ENVIRONMENT,
  redirectUri: process.env.QBO_REDIRECT_URI,
});

// 🌍 Base URL for QBO API
def getBaseUrl() {
  return process.env.ENVIRONMENT === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com';
}

// 📡 General QBO API Fetcher
async function fetchQBOData(realmId, accessToken, resource) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/v3/company/${realmId}/${resource}`;

  console.log('🌐 QBO Request URL:', url);
  console.log('🔑 Using access_token:', accessToken?.slice(0, 20) + '...');

  // Set the current access token on the client
  oauthClient.setToken({ access_token: accessToken });

  try {
    // Make the API call by passing an options object
    const response = await oauthClient.makeApiCall({
      url,
      headers: { Accept: 'application/json' }
    });
    return JSON.parse(response.body);
  } catch (err) {
    console.error('❌ QBO API Error Body:', err?.response?.body || err.message);
    throw err;
  }
}

// ✅ Test route for companyinfo
router.get('/:realmId/companyinfo', async (req, res) => {
  const { realmId } = req.params;
  try {
    const doc = await db.collection('qbo_tokens').doc(realmId).get();
    if (!doc.exists) return res.status(404).send('❌ Token not found');

    const tokenData   = doc.data();
    const accessToken = await refreshTokenIfNeeded(realmId, tokenData);

    const info = await fetchQBOData(realmId, accessToken, `companyinfo/${realmId}`);
    res.json(info);
  } catch (err) {
    console.error('❌ Failed to fetch companyinfo:', err?.response?.body || err.message);
    res.status(500).send('❌ Failed to fetch companyinfo');
  }
});

// 🚀 Generic QBO resource route: /qbo/:realmId/:resource
router.get('/:realmId/:resource', async (req, res) => {
  const { realmId, resource } = req.params;
  const allowed = ['account', 'invoices', 'vendors', 'companyinfo'];
  if (!allowed.includes(resource)) {
    return res.status(400).send('❌ Invalid QBO resource.');
  }

  try {
    const doc = await db.collection('qbo_tokens').doc(realmId).get();
    if (!doc.exists) return res.status(404).send('❌ Token not found');

    const tokenData   = doc.data();
    const accessToken = await refreshTokenIfNeeded(realmId, tokenData);

    const data = await fetchQBOData(realmId, accessToken, resource);
    res.json(data);
  } catch (err) {
    console.error(`❌ Failed to fetch ${resource}:`, err?.response?.body || err.message);
    res.status(500).send(`❌ Failed to fetch ${resource}`);
  }
});

module.exports = router;
