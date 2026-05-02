const { chromium } = require('playwright');
const express = require('express');
const app = express();

const PORT = process.env.PORT || 8080;

// 1. RUTA PRINCIPAL (La que caza el link inicial)
app.get('/animal-planet', async (req, res) => {
    console.log("Iniciando cacería de link...");
    let browser;
    try {
        browser = await chromium.launch({ 
            headless: true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--single-process'
            ] 
        });
        
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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
            // Redirigimos tu app a nuestro Proxy Maestro
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

// 2. EL PROXY MAESTRO (El que traduce las "muñecas rusas" y descarga los videos)
app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('Falta URL');

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'Referer': 'https://www.tvporinternet2.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) return res.status(response.status).send('Error origen');

        const contentType = response.headers.get('content-type') || '';
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', contentType);

        // Si lo que pidió la app es una lista (texto)
        if (targetUrl.includes('.m3u8') || contentType.includes('mpegurl')) {
            let text = await response.text();
            
            // Magia: Convertimos CUALQUIER link de la lista para que pase por nuestro proxy
            text = text.replace(/^(?!#)(.+)$/gm, (match, p1) => {
                let fullUrl = new URL(p1.trim(), targetUrl).href;
                return `https://${req.get('host')}/proxy?url=${encodeURIComponent(fullUrl)}`;
            });

            // Y si el video tiene llave de seguridad, también la pasamos por el proxy
            text = text.replace(/URI="([^"]+)"/g, (match, p1) => {
                let fullUrl = new URL(p1.trim(), targetUrl).href;
                return `URI="https://${req.get('host')}/proxy?url=${encodeURIComponent(fullUrl)}"`;
            });

            res.send(text);
        } else {
            // Si lo que pidió es el pedacito de video real (.ts), lo descargamos y se lo mandamos a tu app
            const buffer = await response.arrayBuffer();
            res.send(Buffer.from(buffer));
        }
    } catch (error) {
        res.status(500).end();
    }
});

app.get('/', (req, res) => res.send('Cazador Online.'));
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor en puerto ${PORT}`));

