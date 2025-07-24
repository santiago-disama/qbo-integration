const db = require('../services/firestore');

async function storeTokenData(token, realmId) {
  const data = {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    token_type: token.token_type,
    expires_in: token.expires_in,
    realmId: realmId,
    timestamp: new Date()
  };

  await db.collection('qbo_tokens').doc(realmId).set(data);
  console.log('✅ Token data saved to Firestore');
}

module.exports = storeTokenData;