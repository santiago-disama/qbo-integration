const express = require('express');
const admin = require('firebase-admin');
const OAuthClient = require('intuit-oauth');
const { refreshTokenIfNeeded } = require('../utils/refreshToken');

const router = express.Router();

// Generic function to fetch data from QBO
async function fetchQBOData(realmId, accessToken, resource) {
  const oauthClient = new OAuthClient({
    clientId: process.env.QBO_CLIENT_ID,
    clientSecret: process.env.QBO_CLIENT_SECRET,
    environment: process.env.ENVIRONMENT,
  });

  oauthClient.setToken({ access_token: accessToken });

  const url = `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/${resource}`;
  try {
    const response = await oauthClient.makeApiCall({ url });
    return response;
  } catch (err) {
    console.error('Error fetching QBO data:', err);
    throw err;
  }
}

// GET /qbo/invoices/:realmId
router.get('/invoices/:realmId', async (req, res) => {
  const { realmId } = req.params;

  try {
    // Pull stored token data from Firestore
    const tokenDoc = await admin
      .firestore()
      .collection('qboTokens')
      .doc(realmId)
      .get();

    if (!tokenDoc.exists) {
      return res.status(404).json({ error: 'No token found for that realmId' });
    }

    const tokenData = tokenDoc.data();
    const accessToken = await refreshTokenIfNeeded(realmId, tokenData);

    // Use the Query API to list all invoices
    const response = await fetchQBOData(
      realmId,
      accessToken,
      'query?query=select * from Invoice'
    );

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
