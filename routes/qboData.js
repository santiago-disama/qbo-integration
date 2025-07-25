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
function getBaseUrl() {
  return process.env.ENVIRONMENT === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com';
}

// 📡 Request to QBO API
async function fetchQBOData(realmId, accessToken, resource) {
  const baseUrl = getBaseUrl(process.env.ENVIRONMENT);
  const url = `${baseUrl}/v3/company/${realmId}/${resource}`;

  console.log('🌐 QBO Request URL:', url);
  console.log('🔑 Using access_token:', accessToken.slice(0, 20) + '...');

  const response = await oauthClient.makeApiCall({
    url,
    token: accessToken,
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });

  return JSON.parse(response.body);
}

// 🚀 GET /qbo/:realmId/:resource
router.get('/:realmId/:resource', async (req, res) => {
  const { realmId, resource } = req.params;
  const allowedResources = ['accounts', 'invoices', 'vendors'];

  if (!allowedResources.includes(resource)) {
    return res.status(400).send('❌ Invalid QBO resource.');
  }

  try {
    const doc = await db.collection('qbo_tokens').doc(realmId).get();
    if (!doc.exists) {
      console.warn(`⚠️ Token not found for realmId: ${realmId}`);
      return res.status(404).send('❌ Token not found for that realmId.');
    }

    const tokenData = doc.data();
    const accessToken = await refreshTokenIfNeeded(realmId, tokenData);
    if (!accessToken) {
      throw new Error('No valid access token returned after refresh');
    }

    const data = await fetchQBOData(realmId, accessToken, resource);
    res.json(data);
  } catch (err) {
    console.error(`❌ Failed to fetch ${resource}:`, err.response?.body || err.message || err);
    res.status(500).send(`❌ Failed to fetch ${resource}`);
  }
});

module.exports = router;
