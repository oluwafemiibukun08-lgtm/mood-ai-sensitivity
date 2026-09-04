const express = require('express');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const htmlPath = path.join(__dirname, 'public', 'index.html');

const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const REDIRECT_URI =
    'https://mood-ai-sensitivity.onrender.com/auth/tiktok/callback';

console.log('HTML FILE:', htmlPath);

function setCookie(res, name, value) {
    res.setHeader(
        'Set-Cookie',
        `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
    );
}

function getCookie(req, name) {
    const cookies = req.headers.cookie || '';
    const match = cookies.match(
        new RegExp('(?:^|; )' + name + '=([^;]*)')
    );

    return match ? decodeURIComponent(match[1]) : null;
}

app.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/terms', (req, res) => {
    res.sendFile(path.join(__dirname, 'tos.html'));
});

app.get('/tiktokbhIy9utUg1HP2f4s9C02cIu1tyCgEUGI.txt', (req, res) => {
    res.type('text/plain').sendFile(
        path.join(
            __dirname,
            'tiktokbhIy9utUg1HP2f4s9C02cIu1tyCgEUGI.txt'
        )
    );
});

app.get('/auth/tiktok', (req, res) => {
    if (!CLIENT_KEY || !CLIENT_SECRET) {
        return res.status(500).send('TikTok credentials are not configured.');
    }

    const state = crypto.randomBytes(32).toString('hex');
    setCookie(res, 'tiktok_oauth_state', state);

    const params = new URLSearchParams({
        client_key: CLIENT_KEY,
        response_type: 'code',
        scope: 'user.info.basic',
        redirect_uri: REDIRECT_URI,
        state
    });

    res.redirect(
        `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`
    );
});

app.get('/auth/tiktok/callback', async (req, res) => {
    try {
        const { code, state, error, error_description } = req.query;

        if (error) {
            return res.status(400).send(
                `TikTok authorization failed: ${
                    error_description || error
                }`
            );
        }

        const savedState = getCookie(req, 'tiktok_oauth_state');

        if (!state || !savedState || state !== savedState) {
            return res.status(400).send('Invalid TikTok authorization state.');
        }

        if (!code) {
            return res.status(400).send('No authorization code received.');
        }

        const tokenResponse = await axios.post(
            'https://open.tiktokapis.com/v2/oauth/token/',
            new URLSearchParams({
                client_key: CLIENT_KEY,
                client_secret: CLIENT_SECRET,
                code,
                grant_type: 'authorization_code',
                redirect_uri: REDIRECT_URI
            }).toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cache-Control': 'no-cache'
                }
            }
        );

        const accessToken = tokenResponse.data.access_token;

        const userResponse = await axios.get(
            'https://open.tiktokapis.com/v2/user/info/',
            {
                params: {
                    fields: 'open_id,display_name,avatar_url'
                },
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        const user = userResponse.data.data.user;

        res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TikTok Connected</title>
<style>
body {
    font-family: Arial, sans-serif;
    background: #111;
    color: white;
    text-align: center;
    padding: 40px 20px;
}
.card {
    max-width: 420px;
    margin: auto;
    padding: 30px;
    border-radius: 20px;
    background: #1d1d1d;
}
img {
    width: 80px;
    height: 80px;
    border-radius: 50%;
}
button {
    margin-top: 20px;
    padding: 14px 24px;
    border: 0;
    border-radius: 12px;
    font-weight: bold;
}
</style>
</head>
<body>
<div class="card">
    ${
        user.avatar_url
            ? `<img src="${user.avatar_url}" alt="TikTok profile">`
            : ''
    }
    <h2>TikTok Connected ✅</h2>
    <p>Welcome, ${user.display_name || 'TikTok user'}.</p>
    <p>Your TikTok account has been successfully authenticated.</p>
    <button onclick="location.href='/'">Return to MOOD AI SENSITIVITY</button>
</div>
</body>
</html>
        `);
    } catch (err) {
        console.error(
            'TIKTOK ERROR:',
            err.response?.data || err.message
        );

        res.status(500).send(
            'TikTok connection failed. Please try again.'
        );
    }
});

app.get('/', (req, res) => {
    console.log('HOME REQUEST');

    res.sendFile(htmlPath, (err) => {
        if (err) {
            console.log('SEND ERROR:', err.message);
            res.status(500).send(err.message);
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('SERVER STARTED');
    console.log(`Server live at http://127.0.0.1:${PORT}`);
});
