require('dotenv').config();
const express = require('express');
const OAuthClient = require('intuit-oauth');

const app = express();
const port = process.env.PORT || 3000;

const oauthClient = new OAuthClient({
  clientId: process.env.QBO_CLIENT_ID,
  clientSecret: process.env.QBO_CLIENT_SECRET,
  environment: process.env.ENVIRONMENT, // 'sandbox' or 'production'
  redirectUri: process.env.QBO_REDIRECT_URI // must match exactly what's in your QBO app settings
});

let accessToken = '';
let realmId = '';

// 🌐 Step 1: Redirect to QuickBooks authorization
app.get('/', (req, res) => {
  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: 'intuit-test'
  });

  console.log('🔗 OAuth URL:', authUri);
  res.redirect(authUri); // ✅ redirects user to Intuit login page
});

// ✅ Step 2: Callback route — exchanges code for token
app.get('/callback', async (req, res) => {
  try {
    const token = await oauthClient.createToken(req.url);
    accessToken = token.getToken().access_token;
    realmId = token.getToken().realmId;

    console.log('✅ Authorization successful!');
    console.log('Access Token:', accessToken);
    console.log('Realm ID:', realmId);

    res.send('✅ Authorization successful! You can now visit /company-info');
  } catch (error) {
    console.error('❌ Callback Error:', error);
    res.status(500).send('❌ Error during token exchange. Check logs.');
  }
});

// 📊 Step 3: Fetch company info
app.get('/company-info', async (req, res) => {
  if (!accessToken || !realmId) {
    return res.status(400).send('❌ You must authorize first at /.');
  }

  const url = `v3/company/${realmId}/companyinfo/${realmId}`;

  try {
    const response = await oauthClient.makeApiCall({ url });
    res.json(JSON.parse(response.body));
  } catch (error) {
    console.error('❌ API Call Failed:', error);
    res.status(500).send('❌ Failed to fetch company info');
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});