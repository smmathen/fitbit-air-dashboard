import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

app.use('/health', async (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'No token' });

    const url = `https://health.googleapis.com/v4${req.url}`;

    try {
        const headers = {
            Authorization: token,
            Accept: 'application/json',
        };
        const init = { method: req.method, headers };

        if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
            headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(req.body);
        }

        const upstream = await fetch(url, init);
        const text = await upstream.text();
        res.status(upstream.status).type(upstream.headers.get('content-type') || 'application/json').send(text);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(3001);
