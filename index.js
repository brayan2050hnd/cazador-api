const { chromium } = require('playwright');
const express = require('express');
const app = express();

const PORT = process.env.PORT || 8080;

let sessionCookies = '';
let globalUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

app.get('/animal-planet.m3u8', async (req, res) => {
    console.log("Iniciando cacería optimizada (Anti-Crash)...");
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

        // ¡NUEVO: BLOQUEADOR DE ANUNCIOS Y COSAS PESADAS!
        // Esto evita que Railway se quede sin memoria RAM y se apague
        await page.route('**/*', (route) => {
            const type = route.request().resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
                route.abort(); // Cancelamos la carga de basura
            } else {
                route.continue();
            }
        });

        let m3u8Url = null;

        page.on('response', async response => {
            const url = response.url();
            if (url.includes('.m3u8') && !m3u8Url) {
                m3u8Url = url;
            }
        });

        // Aumentamos el tiempo de espera por si la web está lenta
        await page.goto('https://www.tvporinternet2.com/animal-planet-en-vivo-por-internet.html', { 
            waitUntil: 'domcontentloaded', 
            timeout: 45000 
        }).catch(e => console.log("Aviso de navegación:", e.message));

        let espera = 0;
        while (!m3u8Url && espera < 15) {
            await new Promise(r => setTimeout(r, 1000));
            espera++;
        }

        if(m3u8Url) {
            const cookies = await context.cookies();
            sessionCookies = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        }

        await browser.close();

        if (m3u8Url) {
            console.log("¡Link atrapado! Redirigiendo...");
            res.redirect(`https://${req.get('host')}/proxy/video.m3u8?url=${encodeURIComponent(m3u8Url)}`);
        } else {
            // Mandamos un video vacío para que WVC no lance error feo
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.send("#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:10.0,\nhttp://localhost/vacio.ts");
        }
    } catch (e) {
        console.error("Error crítico:", e.message);
        if (browser) await browser.close();
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send("#EXTM3U\n#EXTINF:10.0,\nhttp://localhost/vacio.ts");
    }
});

// EL PROXY CAMUFLADO (Queda intacto)
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

