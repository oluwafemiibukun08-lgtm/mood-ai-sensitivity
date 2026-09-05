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

function setCookie(res, name, value, maxAge = 3600) {
    res.setHeader(
        'Set-Cookie',
        `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
    );
}

function getCookie(req, name) {
    const cookies = req.headers.cookie || '';

    const match = cookies.match(
        new RegExp('(?:^|; )' + name + '=([^;]*)')
    );

    return match ? decodeURIComponent(match[1]) : null;
}

/* =========================
   LEGAL PAGES
========================= */

app.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/terms', (req, res) => {
    res.sendFile(path.join(__dirname, 'tos.html'));
});

/* =========================
   TIKTOK VERIFICATION FILE
========================= */

app.get(
    '/tiktokbhIy9utUg1HP2f4s9C02cIu1tyCgEUGI.txt',
    (req, res) => {
        res.type('text/plain').sendFile(
            path.join(
                __dirname,
                'tiktokbhIy9utUg1HP2f4s9C02cIu1tyCgEUGI.txt'
            )
        );
    }
);

/* =========================
   TIKTOK LOGIN
========================= */

app.get('/auth/tiktok', (req, res) => {
    if (!CLIENT_KEY || !CLIENT_SECRET) {
        return res
            .status(500)
            .send('TikTok credentials are not configured.');
    }

    const state = crypto.randomBytes(32).toString('hex');

    setCookie(res, 'tiktok_oauth_state', state, 600);

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

/* =========================
   TIKTOK CALLBACK
========================= */

app.get('/auth/tiktok/callback', async (req, res) => {
    try {
        const {
            code,
            state,
            error,
            error_description
        } = req.query;

        if (error) {
            return res.status(400).send(
                `TikTok authorization failed: ${
                    error_description || error
                }`
            );
        }

        const savedState = getCookie(
            req,
            'tiktok_oauth_state'
        );

        if (!state || !savedState || state !== savedState) {
            return res
                .status(400)
                .send('Invalid TikTok authorization state.');
        }

        if (!code) {
            return res
                .status(400)
                .send('No authorization code received.');
        }

        /* Exchange authorization code for access token */

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
                    'Content-Type':
                        'application/x-www-form-urlencoded',
                    'Cache-Control': 'no-cache'
                }
            }
        );

        const accessToken =
            tokenResponse.data.access_token;

        if (!accessToken) {
            throw new Error(
                'TikTok did not return an access token.'
            );
        }

        /* Get TikTok user */

        const userResponse = await axios.get(
            'https://open.tiktokapis.com/v2/user/info/',
            {
                params: {
                    fields:
                        'open_id,display_name,avatar_url'
                },
                headers: {
                    Authorization:
                        `Bearer ${accessToken}`
                }
            }
        );

        const user =
            userResponse.data.data.user;

        if (!user || !user.open_id) {
            throw new Error(
                'TikTok user information was not returned.'
            );
        }

        /*
         * Create our own authenticated session.
         * The token itself is stored in the HttpOnly cookie
         * so the frontend cannot read it.
         */

        const session = {
            open_id: user.open_id,
            display_name:
                user.display_name || 'TikTok user',
            avatar_url:
                user.avatar_url || '',
            authenticated: true
        };

        setCookie(
            res,
            'tiktok_session',
            JSON.stringify(session),
            86400
        );

        /*
         * Authentication succeeded.
         * Send the user straight back to the generator.
         */

        res.redirect('/');

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

/* =========================
   AUTH STATUS
========================= */

app.get('/api/auth-status', (req, res) => {
    const session = getCookie(
        req,
        'tiktok_session'
    );

    if (!session) {
        return res.json({
            loggedIn: false,
            following: false
        });
    }

    try {
        const user = JSON.parse(session);

        return res.json({
            loggedIn:
                user.authenticated === true,
            following: false,
            displayName:
                user.display_name || 'TikTok user',
            avatarUrl:
                user.avatar_url || ''
        });

    } catch (err) {
        return res.json({
            loggedIn: false,
            following: false
        });
    }
});

/* =========================
   ACCESS
========================= */

app.get('/api/access', (req, res) => {
    const session = getCookie(
        req,
        'tiktok_session'
    );

    if (!session) {
        return res.json({
            allowed: false
        });
    }

    try {
        const user = JSON.parse(session);

        if (user.authenticated === true) {
            return res.json({
                allowed: true
            });
        }

    } catch (err) {
        // Invalid session
    }

    return res.json({
        allowed: false
    });
});

/* =========================
   FOLLOW CHECK
========================= */

app.get('/api/check-follow', (req, res) => {
    const session = getCookie(
        req,
        'tiktok_session'
    );

    if (!session) {
        return res.json({
            loggedIn: false,
            following: false
        });
    }

    /*
     * TikTok Login Kit with user.info.basic
     * does NOT provide a legitimate API result
     * telling us whether the user follows @mood5ff.
     *
     * Therefore we NEVER fake a follow result.
     */

    try {
        const user = JSON.parse(session);

        return res.json({
            loggedIn:
                user.authenticated === true,
            following: false,
            followCheckAvailable: false
        });

    } catch (err) {
        return res.json({
            loggedIn: false,
            following: false,
            followCheckAvailable: false
        });
    }
});

/* =========================
   HOME
========================= */

app.get('/', (req, res) => {
    console.log('HOME REQUEST');

    res.sendFile(htmlPath, (err) => {
        if (err) {
            console.log(
                'SEND ERROR:',
                err.message
            );

            res.status(500).send(
                err.message
            );
        }
    });
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, '0.0.0.0', () => {
    console.log('SERVER STARTED');
    console.log(
        `Server live at http://127.0.0.1:${PORT}`
    );
});
