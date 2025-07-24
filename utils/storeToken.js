const { db } = require('../utils/firebase');

async function storeTokenData(token, realmId) {
  const data = {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    token_type: token.token_type,
    expires_in: token.expires_in,
    x_refresh_token_expires_in: token.x_refresh_token_expires_in,
    realmId,
    created_at: new Date().toISOString()
  };

  await db.collection('qbo_tokens').doc(realmId).set(data);
  console.log(`✅ Token data saved for realm ${realmId}`);
}

module.exports = storeTokenData;