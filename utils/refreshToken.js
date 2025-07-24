const { db } = require('../utils/firebase');
const OAuthClient = require('intuit-oauth');

const oauthClient = new OAuthClient({
  clientId: process.env.QBO_CLIENT_ID,
  clientSecret: process.env.QBO_CLIENT_SECRET,
  environment: process.env.ENVIRONMENT,
  redirectUri: process.env.QBO_REDIRECT_URI
});

async function refreshTokenIfNeeded(realmId, tokenData) {
  try {
    console.log('🧠 Checking token expiration for realm:', realmId);
    console.log('🔍 Stored token data:', tokenData);

    if (!tokenData.created_at || !tokenData.expires_in) {
      console.warn('⚠️ Missing created_at or expires_in — forcing refresh.');
    }

    const expiresAt = new Date(tokenData.created_at || 0);
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 0));

    if (new Date() < expiresAt && tokenData.access_token) {
      console.log('✅ Token still valid — using stored token.');
      return tokenData.access_token;
    }

    console.log('🔁 Token expired — refreshing...');

    const token = await oauthClient.refreshUsingToken(tokenData.refresh_token);
    const newTokenData = token.getToken();

    console.log('✅ Token successfully refreshed');

    await db.collection('qbo_tokens').doc(realmId).set({
      ...newTokenData,
      created_at: new Date().toISOString()
    });

    return newTokenData.access_token;
  } catch (err) {
    console.error('❌ Failed to refresh token:', err.response?.body || err.message || err);
    throw err;
  }
}

module.exports = refreshTokenIfNeeded;
