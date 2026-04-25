const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');

const app = express();
app.use(express.json());

// Load Service Account Key
const serviceAccount = JSON.parse(fs.readFileSync('service-account.json'));

async function getAccessToken() {
  const jwtClient = new google.auth.JWT(
    serviceAccount.client_email,
    null,
    serviceAccount.private_key,
    ['https://www.googleapis.com/auth/cloud-platform']
  );
  const credentials = await jwtClient.authorize();
  return credentials.access_token;
}

app.post('/send-notification', async (req, res) => {
  console.log('Received request:', req.body);
  const { tokens, date, title, body } = req.body;

  if (!tokens || !Array.isArray(tokens) || tokens.length === 0 || !date || !title || !body) {
    console.error('Invalid request body:', req.body);
    return res.status(400).json({ error: 'Invalid request: tokens, date, title, and body are required' });
  }

  try {
    const accessToken = await getAccessToken();
    const results = [];
    for (const token of tokens) {
      try {
        const response = await fetch(`https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              data: { date },
            },
          }),
        });
        if (response.ok) {
          results.push({ token, status: 'success' });
        } else {
          const errorText = await response.text();
          console.error(`Failed to send to ${token}: ${errorText}`);
          results.push({ token, status: 'failed', error: errorText });
        }
      } catch (error) {
        console.error(`Error sending to ${token}:`, error);
        results.push({ token, status: 'failed', error: error.message });
      }
    }
    const failed = results.filter(r => r.status === 'failed');
    if (failed.length > 0) {
      res.status(207).json({ message: 'Some notifications failed', results });
    } else {
      res.status(200).json({ message: 'Notifications sent', results });
    }
  } catch (error) {
    console.error('Error sending notifications:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});