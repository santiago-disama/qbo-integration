require('dotenv').config();
const express = require('express');
const OAuthClient = require('intuit-oauth');
const open = require('open').default;

const app = express();
const port = 3000;

const oauthClient = new OAuthClient({
  clientId: process.env.QBO_CLIENT_ID,
  clientSecret: process.env.QBO_CLIENT_SECRET,
  environment: process.env.ENVIRONMENT,
  redirectUri: process.env.QBO_REDIRECT_URI
});

let accessToken = '';
let realmId = '';

app.get('/', async (req, res) => {
  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: 'intuit-test'
  });
  await open(authUri);
  res.send('Redirecting to QuickBooks...');
});

app.get('/callback', async (req, res) => {
  try {
    const token = await oauthClient.createToken(req.url);
    accessToken = token.getToken().access_token;
    realmId = token.getToken().realmId;
    res.send('Authorization successful! You can now query QuickBooks.');
  } catch (e) {
    console.error(e);
    res.status(500).send('Error in callback');
  }
});

app.get('/company-info', async (req, res) => {
  if (!accessToken || !realmId) {
    return res.send('Please authorize first at root URL.');
  }

  const url = `v3/company/${realmId}/companyinfo/${realmId}`;
  try {
    const response = await oauthClient.makeApiCall({ url });
    res.json(JSON.parse(response.body));
  } catch (e) {
    console.error(e);
    res.status(500).send('API call failed');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});