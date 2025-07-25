const { db } = require('../utils/firebase');
const OAuthClient = require('intuit-oauth');

// 🔐 Initialize OAuth client
const oauthClient = new OAuthClient({
  clientId: process.env.QBO_CLIENT_ID,
  clientSecret: process.env.QBO_CLIENT_SECRET,
  environment: process.env.ENVIRONMENT,
  redirectUri: process.env.QBO_REDIRECT_URI,
});

async function refreshTokenIfNeeded(realmId, tokenData) {
  const { access_token, refresh_token, created_at, expires_in } = tokenData;
  const expiresAt = new Date(created_at * 1000 + expires_in * 1000);

  if (access_token && new Date() < expiresAt) {
    console.log('✅ Token is still valid — no refresh needed');
    // Return the raw access_token string
    return access_token;
  }

  console.log('🔄 Refreshing expired token...');
  oauthClient.setToken({
    access_token,
    refresh_token,
  });

  const newTokenData = await oauthClient
    .refresh()
    .then(response => response.getJson());

  // Save new tokens to Firestore
  await db.collection('qboTokens').doc(realmId).set(newTokenData);
  console.log('✅ Token refreshed and saved');

  // Return the new access_token string
  return newTokenData.access_token;
}

module.exports = { refreshTokenIfNeeded };
