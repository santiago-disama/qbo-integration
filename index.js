require('dotenv').config();
const express = require('express');
const OAuthClient = require('intuit-oauth');

const app = express();
const port = process.env.PORT || 3000; // Render uses dynamic ports

const oauthClient = new OAuthClient({
  clientId: process.env.QBO_CLIENT_ID,
  clientSecret: process.env.QBO_CLIENT_SECRET,
  environment: process.env.ENVIRONMENT,
  redirectUri: process.env.QBO_REDIRECT_URI
});

let accessToken = '';
let realmId = '';

// ✅ Entry point to generate the OAuth URL
app.get('/', async (req, res) => {
  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: 'intuit-test'
  });

  console.log("🔗 Open this URL to connect QuickBooks:\n" + authUri);
  res.send('Check the Render logs for your QuickBooks login URL.');
});

// ✅ OAuth callback route
app.get('/callback', async (req, res) => {
  try {
    const token = await oauthClient.createToken(req.url);
    accessToken = token.getToken().access_token;
    realmId = token.getToken().realmId;

    console.log("✅ QBO Auth Successful");
    console.log("Access Token:", accessToken);
    console.log("Realm ID:", realmId);

    res.send('✅ Authorization successful! You can now call /company-info');
  } catch (e) {
    console.error('❌ OAuth Error:', e);
    res.status(500).send('Error in callback');
  }
});

// ✅ Sample API route
app.get('/company-info', async (req, res) => {
  if (!accessToken || !realmId) {
    return res.send('Please authorize first at root URL.');
  }

  const url = `v3/company/${realmId}/companyinfo/${realmId}`;
  try {
    const response = await oauthClient.makeApiCall({ url });
    res.json(JSON.parse(response.body));
  } catch (e) {
    console.error('❌ API Error:', e);
    res.status(500).send('API call failed');
  }
});

// ✅ Listen on dynamic port for Render
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
