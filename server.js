const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const htmlPath = path.join(__dirname, 'public', 'index.html');

console.log('HTML FILE:', htmlPath);

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
