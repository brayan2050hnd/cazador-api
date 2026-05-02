const { chromium } = require('playwright');
const express = require('express');
const app = express();

const PORT = process.env.PORT || 8080;

app.get('/animal-planet', async (req, res) => {
    console.log("Iniciando cacería de link...");
    let browser;
    try {
        browser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'] 
        });
        
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            extraHTTPHeaders: { 'Referer': 'https://www.tvporinternet2.com/' }
        });
        
        const page = await context.newPage();
        let m3u8Url = null;

        page.on('request', request => {
            const url = request.url();
            if (url.includes('.m3u8')) m3u8Url = url;
        });

        await page.goto('https://www.tvporinternet2.com/animal-planet-en-vivo-por-internet.html', { 
            waitUntil: 'domcontentloaded', 
            timeout: 30000 
        }).catch(() => {});

        let espera = 0;
        while (!m3u8Url && espera < 15) {
            await new Promise(r => setTimeout(r, 1000));
            espera++;
        }

        await browser.close();

        if (m3u8Url) {
            console.log("Link cazado:", m3u8Url);
            const proxyUrl = `https://${req.get('host')}/proxy?url=${encodeURIComponent(m3u8Url)}`;
            res.redirect(proxyUrl);
        } else {
            res.status(404).send("No se encontró el link.");
        }
    } catch (e) {
        if (browser) await browser.close();
        res.status(500).send("Error en servidor.");
    }
});

app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('Falta URL');

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'Referer': 'https://www.tvporinternet2.com/',
                'Origin': 'https://www.tvporinternet2.com',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': '*/*'
            }
        });

        // AQUÍ ESTÁ LA MAGIA: Forzamos el Content-Type correcto para Web Video Caster
        let contentType = response.headers.get('content-type') || '';
        if (targetUrl.includes('.m3u8')) {
            contentType = 'application/vnd.apple.mpegurl';
        } else if (targetUrl.includes('.ts')) {
            contentType = 'video/mp2t';
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', contentType);

        if (targetUrl.includes('.m3u8')) {
            let text = await response.text();
            text = text.replace(/^(?!#)(.+)$/gm, (match, p1) => {
                let fullUrl = new URL(p1.trim(), targetUrl).href;
                return `https://${req.get('host')}/proxy?url=${encodeURIComponent(fullUrl)}`;
            });
            text = text.replace(/URI="([^"]+)"/g, (match, p1) => {
                let fullUrl = new URL(p1.trim(), targetUrl).href;
                return `URI="https://${req.get('host')}/proxy?url=${encodeURIComponent(fullUrl)}"`;
            });
            res.send(text);
        } else {
            const buffer = await response.arrayBuffer();
            res.send(Buffer.from(buffer));
        }
    } catch (error) {
        res.status(500).end();
    }
});

app.get('/', (req, res) => res.send('Cazador Online.'));
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor en puerto ${PORT}`));
