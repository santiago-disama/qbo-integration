const { db } = require('../utils/firebase');
const OAuthClient = require('intuit-oauth');

// 🔐 Initialize OAuth client
const oauthClient = new OAuthClient({
  clientId: process.env.QBO_CLIENT_ID,
  clientSecret: process.env.QBO_CLIENT_SECRET,
  environment: process.env.ENVIRONMENT,
  redirectUri: process.env.QBO_REDIRECT_URI
});

// 🔁 Check if token is expired and refresh if needed
async function refreshTokenIfNeeded(realmId, tokenData) {
  try {
    console.log(`🧠 Checking token for realmId: ${realmId}`);

    const { access_token, refresh_token, created_at, expires_in } = tokenData;

    // ⚠️ Defensive check
    if (!refresh_token) {
      throw new Error('Missing refresh_token');
    }

    const issuedAt = created_at ? new Date(created_at) : new Date(0);
    const expiresAt = new Date(issuedAt.getTime() + ((expires_in || 3600) * 1000));

    if (access_token && new Date() < expiresAt) {
      console.log('✅ Token is still valid — no refresh needed');
      return access_token;
    }

    console.log('🔄 Token expired or invalid — refreshing using refresh_token...');

    const refreshed = await oauthClient.refreshUsingToken(refresh_token);
    const newToken = refreshed.getToken();

    await db.collection('qbo_tokens').doc(realmId).set({
      ...newToken,
      created_at: new Date().toISOString()
    });

    console.log('✅ Token refreshed and saved');
    return newToken.access_token;
  } catch (err) {
    console.error('❌ Token refresh failed:', err.response?.body || err.message || err);
    throw new Error(`Failed to refresh token for realmId ${realmId}`);
  }
}

module.exports = refreshTokenIfNeeded;
