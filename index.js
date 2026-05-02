const { chromium } = require('playwright');
const express = require('express');
const app = express();

const PORT = process.env.PORT || 8080;

// Dejamos el "cerebro" del navegador vivo en la memoria
let globalContext = null;

async function initBrowser() {
    if (!globalContext) {
        const browser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'] 
        });
        globalContext = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            extraHTTPHeaders: { 'Referer': 'https://alon.one/' }
        });
    }
    return globalContext;
}

app.get('/animal-planet.m3u8', async (req, res) => {
    console.log("=====================================");
    console.log("Iniciando cacería (Nivel Dios con Chromium Vivo)...");
    
    try {
        const context = await initBrowser();
        const page = await context.newPage();

        await page.route('**/*', (route) => {
            if (['image', 'stylesheet', 'font'].includes(route.request().resourceType())) route.abort(); 
            else route.continue();
        });

        let m3u8Url = null;

        const atraparLink = new Promise((resolve) => {
            page.on('request', request => {
                const url = request.url();
                if (url.includes('.m3u8') && !m3u8Url) {
                    m3u8Url = url;
                    resolve(); 
                }
            });
        });

        page.goto('https://alon.one/alontv/canal/166-animal-planet-latinoamerica', { waitUntil: 'commit' }).catch(() => {});

        await Promise.race([ atraparLink, new Promise(r => setTimeout(r, 15000)) ]);

        // ¡ATENCIÓN!: Ya no cerramos el browser, solo cerramos la pestaña (page)
        await page.close();

        if (m3u8Url) {
            console.log("¡Link atrapado! Pasando el mando al motor Chromium.");
            res.redirect(`https://${req.get('host')}/proxy/video.m3u8?url=${encodeURIComponent(m3u8Url)}`);
        } else {
            console.log("Fallo: No se encontró el m3u8.");
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.send("#EXTM3U\n#EXTINF:-1,Canal Caido\nhttp://localhost/error.ts");
        }
    } catch (e) {
        console.error("Error crítico:", e.message);
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send("#EXTM3U\n#EXTINF:-1,Reintentar\nhttp://localhost/error.ts");
    }
});

// NUESTRO PROXY IMPARABLE
app.get('/proxy/:archivo', async (req, res) => {
    const targetUrl = req.query.url;
    const archivo = req.params.archivo; 
    
    if (!targetUrl) return res.status(400).send('Falta URL');

    try {
        // Si por alguna razón el navegador se apagó, lo encendemos
        if (!globalContext) await initBrowser();

        console.log(`[PROXY] Descargando vía Chromium: ${archivo}`);

        // MAGIA ABSOLUTA: Chromium descarga el archivo por nosotros (adiós Node.js fetch)
        const response = await globalContext.request.get(targetUrl, {
            headers: { 'Referer': 'https://alon.one/' }
        });

        if (!response.ok()) {
            console.error(`[PROXY ERROR] Código: ${response.status()}`);
            return res.status(response.status()).end();
        }

        res.setHeader('Access-Control-Allow-Origin', '*');

        if (archivo.includes('.m3u8')) {
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            let text = await response.text();
            
            const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
            const urlObj = new URL(targetUrl);
            const search = urlObj.search;

            let finalM3u8 = text.replace(/^(?!#)(.+)$/gm, (match, p1) => {
                let chunk = p1.trim();
                let fullUrl;
                if (chunk.startsWith('http')) fullUrl = chunk;
                else if (chunk.startsWith('/')) fullUrl = urlObj.origin + chunk;
                else fullUrl = baseUrl + chunk;

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
            // Mandamos los pedazos de video puros a tu Web Video Caster
            res.setHeader('Content-Type', 'video/mp2t');
            const buffer = await response.body();
            res.send(buffer);
        }
    } catch (error) {
        console.error(`[PROXY CATCH ERROR] ${error.message}`);
        res.status(500).end();
    }
});

app.get('/', (req, res) => res.send('Cazador Online.'));
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor en puerto ${PORT}`));

