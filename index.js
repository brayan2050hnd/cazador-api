const { chromium } = require('playwright');
const express = require('express');
const app = express();

const PORT = process.env.PORT || 8080;

let sessionCookies = '';
let globalUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

app.get('/animal-planet.m3u8', async (req, res) => {
    console.log("Iniciando cacería en Alon.one...");
    let browser;
    try {
        browser = await chromium.launch({ 
            headless: true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--single-process',
                '--no-zygote'
            ] 
        });
        
        const context = await browser.newContext({
            userAgent: globalUserAgent,
            // Cambiamos el pase VIP para la nueva página
            extraHTTPHeaders: { 'Referer': 'https://alon.one/' }
        });
        
        const page = await context.newPage();

        // Bloqueamos imágenes y fuentes para no saturar Railway
        await page.route('**/*', (route) => {
            const type = route.request().resourceType();
            if (['image', 'stylesheet', 'font'].includes(type)) {
                route.abort(); 
            } else {
                route.continue();
            }
        });

        let m3u8Url = null;

        const atraparLink = new Promise((resolve) => {
            page.on('response', async response => {
                const url = response.url();
                // Atrapamos el m3u8
                if (url.includes('.m3u8') && !m3u8Url) {
                    m3u8Url = url;
                    resolve(); 
                }
            });
        });

        // Entramos a la NUEVA página
        page.goto('https://alon.one/alontv/canal/166-animal-planet-latinoamerica', { 
            waitUntil: 'domcontentloaded' 
        }).catch(() => {});

        // Le damos 15 segundos máximo para encontrarlo
        await Promise.race([ atraparLink, new Promise(r => setTimeout(r, 15000)) ]);

        if (m3u8Url) {
            const cookies = await context.cookies();
            sessionCookies = cookies.map(c => `${c.name}=${c.value}`).join('; ');
            console.log("¡Link de Alon.one atrapado!: ", m3u8Url);
        }

        await browser.close();

        if (m3u8Url) {
            // Lo enviamos a nuestro proxy
            res.redirect(`https://${req.get('host')}/proxy/video.m3u8?url=${encodeURIComponent(m3u8Url)}`);
        } else {
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.send("#EXTM3U\n#EXTINF:-1,No se encontro link\nhttp://localhost/error.ts");
        }
    } catch (e) {
        console.error("Error crítico evadido:", e.message);
        if (browser) await browser.close();
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send("#EXTM3U\n#EXTINF:-1,Reintentar\nhttp://localhost/error.ts");
    }
});

// NUESTRO PROXY (Ajustado para Alon.one)
app.get('/proxy/:archivo', async (req, res) => {
    const targetUrl = req.query.url;
    const archivo = req.params.archivo; 
    if (!targetUrl) return res.status(400).send('Falta URL');

    try {
        const response = await fetch(targetUrl, {
            headers: {
                // Actualizamos las cabeceras para que coincidan con la nueva web
                'Referer': 'https://alon.one/',
                'Origin': 'https://alon.one',
                'User-Agent': globalUserAgent,
                'Cookie': sessionCookies
            }
        });

        if (!response.ok) return res.status(response.status).end();

        res.setHeader('Access-Control-Allow-Origin', '*');

        if (archivo.includes('.m3u8')) {
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            let text = await response.text();
            
            const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
            const urlObj = new URL(targetUrl);
            const search = urlObj.search;

            let finalM3u8 = text.replace(/^(?!#)(.+)$/gm, (match, p1) => {
                let chunk = p1.trim();
                let fullUrl = chunk.startsWith('http') ? chunk : baseUrl + chunk;
                if (!fullUrl.includes('?') && search) fullUrl += search;
                
                let ext = fullUrl.includes('.m3u8') ? 'lista.m3u8' : 'pedazo.ts';
                return `https://${req.get('host')}/proxy/${ext}?url=${encodeURIComponent(fullUrl)}`;
            });
            
            finalM3u8 = finalM3u8.replace(/URI="([^"]+)"/g, (match, p1) => {
                let fullUrl = p1.startsWith('http') ? p1 : baseUrl + p1;
                return `URI="https://${req.get('host')}/proxy/llave.key?url=${encodeURIComponent(fullUrl)}"`;
            });

            res.send(finalM3u8);
        } else {
            res.setHeader('Content-Type', 'video/mp2t');
            const buffer = await response.arrayBuffer();
            res.send(Buffer.from(buffer));
        }
    } catch (error) {
        res.status(500).end();
    }
});

app.get('/', (req, res) => res.send('Cazador Online.'));
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor en puerto ${PORT}`));
