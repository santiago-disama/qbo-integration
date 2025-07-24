const OAuthClient = require('intuit-oauth');
const admin = require('firebase-admin');

const db = admin.firestore();

const oauthClient = new OAuthClient({
  clientId: process.env.QBO_CLIENT_ID,
  clientSecret: process.env.QBO_CLIENT_SECRET,
  environment: process.env.ENVIRONMENT,
  redirectUri: process.env.QBO_REDIRECT_URI
});

async function refreshTokenIfNeeded(realmId, tokenData) {
  try {
    const expiresAt = new Date(tokenData.created_at);
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    if (new Date() < expiresAt) {
      return tokenData.access_token;
    }

    const token = await oauthClient.refreshUsingToken(tokenData.refresh_token);
    const newTokenData = token.getToken();

    await db.collection('qbo_tokens').doc(realmId).set({
      ...newTokenData,
      created_at: new Date().toISOString()
    });

    return newTokenData.access_token;
  } catch (err) {
    console.error('❌ Failed to refresh token:', err);
    throw err;
  }
}

module.exports = refreshTokenIfNeeded;