const { chromium } = require('playwright');
const express = require('express');
const app = express();

const PORT = process.env.PORT || 8080;

let sessionCookies = '';
let globalUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

app.get('/animal-planet.m3u8', async (req, res) => {
    console.log("Iniciando cacería Ninja (Extrema rapidez)...");
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
            extraHTTPHeaders: { 'Referer': 'https://www.tvporinternet2.com/' }
        });
        
        const page = await context.newPage();

        // Bloqueo extremo: Solo dejamos pasar scripts vitales
        await page.route('**/*', (route) => {
            const type = route.request().resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
                route.abort(); 
            } else {
                route.continue();
            }
        });

        let m3u8Url = null;

        // LA CLAVE: Promesa que estalla apenas encuentra el link
        const atraparLink = new Promise((resolve) => {
            page.on('response', async response => {
                const url = response.url();
                if (url.includes('.m3u8') && !m3u8Url) {
                    m3u8Url = url;
                    resolve(); // ¡Encontrado, salimos de aquí!
                }
            });
        });

        // Entramos sin esperar a que cargue todo (evita que Railway se ahogue)
        page.goto('https://www.tvporinternet2.com/animal-planet-en-vivo-por-internet.html', { 
            waitUntil: 'commit' 
        }).catch(() => {});

        // Esperamos máximo 15 segundos o hasta que el Ninja lo encuentre
        await Promise.race([ atraparLink, new Promise(r => setTimeout(r, 15000)) ]);

        if (m3u8Url) {
            const cookies = await context.cookies();
            sessionCookies = cookies.map(c => `${c.name}=${c.value}`).join('; ');
            console.log("¡Link atrapado al vuelo! Saliendo antes de crashear.");
        }

        await browser.close();

        if (m3u8Url) {
            res.redirect(`https://${req.get('host')}/proxy/video.m3u8?url=${encodeURIComponent(m3u8Url)}`);
        } else {
            // Mandamos un video "falso" para que la app no tire error de formato
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.send("#EXTM3U\n#EXTINF:-1,Canal Caido\nhttp://localhost/error.ts");
        }
    } catch (e) {
        console.error("Error crítico evadido:", e.message);
        if (browser) await browser.close();
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send("#EXTM3U\n#EXTINF:-1,Reintentar\nhttp://localhost/error.ts");
    }
});

// EL PROXY CAMUFLADO (Se mantiene igual)
app.get('/proxy/:archivo', async (req, res) => {
    const targetUrl = req.query.url;
    const archivo = req.params.archivo; 
    if (!targetUrl) return res.status(400).send('Falta URL');

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'Referer': 'https://www.tvporinternet2.com/',
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

