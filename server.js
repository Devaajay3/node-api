const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const API_KEY = process.env.UPSTOX_API_KEY;
const API_SECRET = process.env.UPSTOX_API_SECRET;
const REDIRECT_URI = process.env.UPSTOX_REDIRECT_URI;

// 1️⃣ STEP: LOGIN URL — send user to Upstox Sign-In
app.get('/login', (req, res) => {
  const loginUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${API_KEY}&redirect_uri=${REDIRECT_URI}`;
  res.redirect(loginUrl);
});

// 2️⃣ STEP: AFTER LOGIN — Upstox sends ?code=XXXX here
app.get('/callback', async (req, res) => {
  const authCode = req.query.code;

  console.log("🔑 Authorization Code Received:", authCode);

  if (!authCode) {
    return res.status(400).send("Authorization code missing");
  }

  try {
    // 3️⃣ Exchange CODE for ACCESS TOKEN
    const tokenResponse = await axios.post(
      "https://api.upstox.com/v2/login/authorization/token",
      {
        code: authCode,
        client_id: API_KEY,
        client_secret: API_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code"
      }
    );

    const accessToken = tokenResponse.data.access_token;

    console.log("🟢 Access Token:", accessToken);

    res.send("Login Successful! Access Token Received. Check Console.");
  } catch (error) {
    console.error("❌ Error exchanging token:", error.response?.data || error.message);
    res.status(500).send("Token exchange failed");
  }
});

// 4️⃣ API Example: Fetch User Profile
app.get("/profile", async (req, res) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(403).send("Send access token in Authorization header");
  }

  try {
    const response = await axios.get(
      "https://api.upstox.com/v2/user/profile",
      { headers: { Authorization: token }}
    );

    res.json(response.data);
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
