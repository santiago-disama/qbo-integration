const OAuthClient = require('intuit-oauth');
const admin = require('firebase-admin');

const oauthClient = new OAuthClient({
  clientId: process.env.QBO_CLIENT_ID,
  clientSecret: process.env.QBO_CLIENT_SECRET,
  environment: process.env.ENVIRONMENT,
  redirectUri: process.env.QBO_REDIRECT_URI
});

const db = admin.firestore();

async function refreshTokenIfNeeded(realmId, tokenData) {
  const tokenAge = Date.now() - new Date(tokenData.created_at).getTime();
  const isExpired = tokenAge > tokenData.expires_in * 1000;

  if (!isExpired) return tokenData.access_token;

  try {
    console.log('🔄 Access token expired. Refreshing...');

    oauthClient.setToken(tokenData); // Use existing token object
    const refreshResponse = await oauthClient.refresh();

    const newToken = refreshResponse.getToken();

    await db.collection('qbo_tokens').doc(realmId).set({
      ...newToken,
      created_at: new Date().toISOString()
    });

    console.log('✅ Token refreshed');
    return newToken.access_token;
  } catch (error) {
    console.error('❌ Failed to refresh token:', error);
    throw error;
  }
}

module.exports = refreshTokenIfNeeded;