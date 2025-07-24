const admin = require('firebase-admin');
const fs = require('fs');

// Initialize only once
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    fs.readFileSync('/etc/secrets/firebase-service-account.json', 'utf8')
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
module.exports = { admin, db };