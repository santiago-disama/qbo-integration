const express = require('express');
const OAuthClient = require('intuit-oauth');
const { db } = require('../utils/firebase');
const refreshTokenIfNeeded = require('../utils/refreshToken');

const router = express.Router();

// 🧠 Intuit OAuth Client
const oauthClient = new OAuthClient({
  clientId: process.env.QBO_CLIENT_ID,
  clientSecret: process.env.QBO_CLIENT_SECRET,
  environment: process.env.ENVIRONMENT,
  redirectUri: process.env.QBO_REDIRECT_URI
});

// 🌍 QuickBooks API Base URL
const getBaseUrl = (env) =>
  env === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com';

// 📡 Make request to QBO
async function fetchQBOData(realmId, accessToken, resource) {
  const baseUrl = getBaseUrl(process.env.ENVIRONMENT);
  const url = `${baseUrl}/v3/company/${realmId}/${resource}`;

  console.log('🌐 Requesting QBO URL:', url);

  const response = await oauthClient.makeApiCall({
    url,
    token: accessToken
  });

  return JSON.parse(response.body);
}

// 🚀 Route: GET /qbo/:realmId/:resource
router.get('/:realmId/:resource', async (req, res) => {
  const { realmId, resource } = req.params;
  const allowedResources = ['accounts', 'invoices', 'vendors'];

  if (!allowedResources.includes(resource)) {
    return res.status(400).send('❌ Invalid QBO resource.');
  }

  try {
    const tokenDoc = await db.collection('qbo_tokens').doc(realmId).get();
    if (!tokenDoc.exists) {
      return res.status(404).send('❌ Token not found for that realmId.');
    }

    const storedToken = tokenDoc.data();
    const accessToken = await refreshTokenIfNeeded(realmId, storedToken);

    const data = await fetchQBOData(realmId, accessToken, resource);
    res.json(data);
  } catch (err) {
    console.error(`❌ Error fetching ${resource}:`, err.response?.body || err.message || err);
    res.status(500).send(`❌ Failed to fetch ${resource}`);
  }
});

module.exports = router;
