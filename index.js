const { chromium } = require('playwright');
const express = require('express');
const app = express();

const PORT = process.env.PORT || 8080;

let sessionCookies = '';
let globalUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

app.get('/animal-planet.m3u8', async (req, res) => {
    console.log("=====================================");
    console.log("Iniciando cacería en Alon.one...");
    let browser;
    try {
        browser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process', '--no-zygote'] 
        });
        
        const context = await browser.newContext({
            userAgent: globalUserAgent,
            extraHTTPHeaders: { 'Referer': 'https://alon.one/' }
        });
        
        const page = await context.newPage();

        await page.route('**/*', (route) => {
            const type = route.request().resourceType();
            if (['image', 'stylesheet', 'font'].includes(type)) route.abort(); 
            else route.continue();
        });

        let m3u8Url = null;

        const atraparLink = new Promise((resolve) => {
            page.on('response', async response => {
                const url = response.url();
                if (url.includes('.m3u8') && !m3u8Url) {
                    m3u8Url = url;
                    resolve(); 
                }
            });
        });

        page.goto('https://alon.one/alontv/canal/166-animal-planet-latinoamerica', { waitUntil: 'commit' }).catch(() => {});

        await Promise.race([ atraparLink, new Promise(r => setTimeout(r, 15000)) ]);

        if (m3u8Url) {
            const cookies = await context.cookies();
            sessionCookies = cookies.map(c => `${c.name}=${c.value}`).join('; ');
            console.log("¡Link atrapado!: ", m3u8Url);
        }

        await browser.close();

        if (m3u8Url) {
            res.redirect(`https://${req.get('host')}/proxy/video.m3u8?url=${encodeURIComponent(m3u8Url)}`);
        } else {
            console.log("Fallo: No se encontró el m3u8 en la página.");
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.send("#EXTM3U\n#EXTINF:-1,Canal Caido\nhttp://localhost/error.ts");
        }
    } catch (e) {
        console.error("Error crítico:", e.message);
        if (browser) await browser.close();
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send("#EXTM3U\n#EXTINF:-1,Reintentar\nhttp://localhost/error.ts");
    }
});

app.get('/proxy/:archivo', async (req, res) => {
    const targetUrl = req.query.url;
    const archivo = req.params.archivo; 
    
    if (!targetUrl) return res.status(400).send('Falta URL');

    console.log(`[PROXY] Tu app pide: ${archivo}`);
    console.log(`[PROXY] Descargando desde: ${targetUrl}`);

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'Referer': 'https://alon.one/',
                'Origin': 'https://alon.one',
                'User-Agent': globalUserAgent,
                'Cookie': sessionCookies
            }
        });

        if (!response.ok) {
            console.error(`[PROXY ERROR] El servidor bloqueó la descarga. Código: ${response.status}`);
            return res.status(response.status).end();
        }

        res.setHeader('Access-Control-Allow-Origin', '*');

        if (archivo.includes('.m3u8')) {
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            let text = await response.text();
            
            const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
            const urlObj = new URL(targetUrl);
            const search = urlObj.search;

            // CIRUGÍA DE RUTAS: Arreglamos cómo se construyen los links internos
            let finalM3u8 = text.replace(/^(?!#)(.+)$/gm, (match, p1) => {
                let chunk = p1.trim();
                let fullUrl;
                
                if (chunk.startsWith('http')) {
                    fullUrl = chunk; // Ya está completa
                } else if (chunk.startsWith('/')) {
                    fullUrl = urlObj.origin + chunk; // Ruta desde la raíz del servidor
                } else {
                    fullUrl = baseUrl + chunk; // Ruta relativa normal
                }

                if (!fullUrl.includes('?') && search) fullUrl += search;
                
                let ext = fullUrl.includes('.m3u8') ? 'lista.m3u8' : 'pedazo.ts';
                return `https://${req.get('host')}/proxy/${ext}?url=${encodeURIComponent(fullUrl)}`;
            });
            
            finalM3u8 = finalM3u8.replace(/URI="([^"]+)"/g, (match, p1) => {
                let chunk = p1.trim();
                let fullUrl;
                if (chunk.startsWith('http')) fullUrl = chunk;
                else if (chunk.startsWith('/')) fullUrl = urlObj.origin + chunk;
                else fullUrl = baseUrl + chunk;

                return `URI="https://${req.get('host')}/proxy/llave.key?url=${encodeURIComponent(fullUrl)}"`;
            });

            res.send(finalM3u8);
        } else {
            res.setHeader('Content-Type', 'video/mp2t');
            const buffer = await response.arrayBuffer();
            res.send(Buffer.from(buffer));
        }
    } catch (error) {
        console.error(`[PROXY CATCH ERROR] ${error.message}`);
        res.status(500).end();
    }
});

app.get('/', (req, res) => res.send('Cazador Online.'));
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor en puerto ${PORT}`));

