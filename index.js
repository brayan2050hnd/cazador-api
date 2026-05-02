const { chromium } = require('playwright');
const express = require('express');
const app = express();

const PORT = process.env.PORT || 8080;

let sessionCookies = '';
let globalUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// 1. RUTA PRINCIPAL
app.get('/animal-planet.m3u8', async (req, res) => {
    console.log("Iniciando cacería maestra...");
    let browser;
    try {
        browser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
        });
        
        const context = await browser.newContext({
            userAgent: globalUserAgent,
            extraHTTPHeaders: { 'Referer': 'https://www.tvporinternet2.com/' }
        });
        
        const page = await context.newPage();
        let m3u8Url = null;

        page.on('response', async response => {
            const url = response.url();
            if (url.includes('.m3u8') && !m3u8Url) {
                m3u8Url = url;
            }
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

        // Robamos las cookies de seguridad
        const cookies = await context.cookies();
        sessionCookies = cookies.map(c => `${c.name}=${c.value}`).join('; ');

        await browser.close();

        if (m3u8Url) {
            console.log("¡Link atrapado! Redirigiendo al Proxy Camuflado...");
            // Lo mandamos al proxy, pero terminando en .m3u8 para engañar a tu app
            res.redirect(`https://${req.get('host')}/proxy/video.m3u8?url=${encodeURIComponent(m3u8Url)}`);
        } else {
            res.status(404).send("No se encontró el link.");
        }
    } catch (e) {
        if (browser) await browser.close();
        res.status(500).send("Error en servidor.");
    }
});

// 2. EL PROXY CAMUFLADO (Maneja las descargas sin que te bloqueen la IP)
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

        // Si tu app pide una lista de video
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
                
                // Disfrazamos cada pedacito de video para que pase por Railway
                let ext = fullUrl.includes('.m3u8') ? 'lista.m3u8' : 'pedazo.ts';
                return `https://${req.get('host')}/proxy/${ext}?url=${encodeURIComponent(fullUrl)}`;
            });
            
            finalM3u8 = finalM3u8.replace(/URI="([^"]+)"/g, (match, p1) => {
                let fullUrl = p1.startsWith('http') ? p1 : baseUrl + p1;
                return `URI="https://${req.get('host')}/proxy/llave.key?url=${encodeURIComponent(fullUrl)}"`;
            });

            res.send(finalM3u8);
        } else {
            // Si tu app pide el pedazo de video real (.ts), Railway lo descarga y te lo manda
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
