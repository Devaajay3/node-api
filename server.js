// server.js
const express = require('express');
const axios = require('axios');
require('dotenv').config();
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const API_KEY = process.env.UPSTOX_API_KEY;
const API_SECRET = process.env.UPSTOX_API_SECRET;
const REDIRECT_URI = process.env.UPSTOX_REDIRECT_URI;

// *** Simple token store (memory). Replace with MongoDB/Redis in prod ***
let TOKEN_STORE = {}; 
// TOKEN_STORE[userIdOrIdentifier] = { access_token, refresh_token, expires_at }

// ----------------- 1) Redirect user to Upstox login -----------------
app.get('/login', (req, res) => {
  const loginUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${API_KEY}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  return res.redirect(loginUrl);
});

// ----------------- 2) OAuth callback: Upstox sends ?code=... ---------------
app.get('/auth', async (req, res) => {
  const authCode = req.query.code;
  console.log('Authorization Code:', authCode);

  if (!authCode) {
    return res.status(400).send('Authorization code missing');
  }

  try {
    // form-urlencoded body
    const params = new URLSearchParams();
    params.append('code', authCode);
    params.append('client_id', API_KEY);
    params.append('client_secret', API_SECRET);
    params.append('redirect_uri', REDIRECT_URI);
    params.append('grant_type', 'authorization_code');

    const tokenResp = await axios.post(
      'https://api.upstox.com/v2/login/authorization/token',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'accept': 'application/json' } }
    );

    const tokenData = tokenResp.data;
    console.log('Token Response:', tokenData);

    // store token — in production map to user/account id
    TOKEN_STORE.default = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      received_at: Date.now()
    };

    // Redirect user to a frontend page or show success
    return res.send('Login successful — token received. Close this window.');
  } catch (err) {
    console.error('Token exchange error:', err.response?.data || err.message);
    return res.status(500).send('Token exchange failed: ' + (err.response?.data?.message || err.message));
  }
});

// ----------------- 3) Refresh token endpoint -----------------
app.post('/refresh-token', async (req, res) => {
  const refreshToken = req.body.refresh_token || TOKEN_STORE.default?.refresh_token;
  if (!refreshToken) return res.status(400).send('No refresh token available');

  const params = new URLSearchParams();
  params.append('client_id', API_KEY);
  params.append('client_secret', API_SECRET);
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', refreshToken);

  try {
    const resp = await axios.post('https://api.upstox.com/v2/login/authorization/token', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    TOKEN_STORE.default = {
      access_token: resp.data.access_token,
      refresh_token: resp.data.refresh_token || refreshToken,
      expires_in: resp.data.expires_in,
      received_at: Date.now()
    };
    res.json(resp.data);
  } catch (err) {
    console.error('Refresh token failed', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// ----------------- 4) Example protected API: fetch profile -----------------
app.get('/profile', async (req, res) => {
  // Accept "Bearer <token>" or raw token in Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).send('Send access token in Authorization header');

  try {
    const resp = await axios.get('https://api.upstox.com/v2/user/profile', {
      headers: { Authorization: authHeader, accept: 'application/json' }
    });
    res.json(resp.data);
  } catch (err) {
    console.error('Profile fetch error', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// ----------------- 5) Webhook endpoint for order updates -----------------
app.post('/webhook', (req, res) => {
  console.log('Webhook received:', req.body);
  // Validate signature if Upstox provides one (check docs)
  // Process order update — store to DB / notify telegram etc.
  res.status(200).send('OK');
});

// ----------------- 6) Token webhook (notifier webhook) -----------------
app.post('/token-webhook', (req, res) => {
  console.log('Notifier webhook payload:', req.body);
  // Upstox can POST access token here if configured
  // Save token securely
  res.status(200).send('Notifier received');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
