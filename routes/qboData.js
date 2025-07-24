const express = require('express');
const OAuthClient = require('intuit-oauth');
const { db } = require('../utils/firebase');
const refreshTokenIfNeeded = require('../utils/refreshToken');

const router = express.Router();

const oauthClient = new OAuthClient({
  clientId: process.env.QBO_CLIENT_ID,
  clientSecret: process.env.QBO_CLIENT_SECRET,
  environment: process.env.ENVIRONMENT,
  redirectUri: process.env.QBO_REDIRECT_URI
});

async function fetchQBOData(realmId, token, endpoint) {
  const url = `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/${endpoint}`;
  const response = await oauthClient.makeApiCall({ url, token });
  return JSON.parse(response.body);
}

// 📂 routes/qboData.js
router.get('/:realmId/:resource', async (req, res) => {
  const { realmId, resource } = req.params;
  const allowedResources = ['accounts', 'invoices', 'vendors'];

  if (!allowedResources.includes(resource)) {
    return res.status(400).send('❌ Invalid QBO resource.');
  }

  try {
    const doc = await db.collection('qbo_tokens').doc(realmId).get();
    if (!doc.exists) return res.status(404).send('❌ No token found for that realmId');

    const tokenData = doc.data();
    const accessToken = await refreshTokenIfNeeded(realmId, tokenData);

    const result = await fetchQBOData(realmId, accessToken, resource);
    res.json(result);
  } catch (err) {
    console.error(`❌ Failed to fetch ${resource}:`, err);
    res.status(500).send(`❌ Error fetching ${resource}`);
  }
});

module.exports = router;