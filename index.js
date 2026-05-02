const { chromium } = require('playwright');
const express = require('express');
const app = express();

const PORT = process.env.PORT || 8080;

app.get('/animal-planet', async (req, res) => {
    console.log("Iniciando cacería de link...");
    let browser;
    try {
        // 1. OPTIMIZACIÓN DE MEMORIA: Añadimos comandos para evitar que Railway se quede sin RAM
        browser = await chromium.launch({ 
            headless: true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage', // Evita crashes en Docker/Railway
                '--disable-gpu',
                '--single-process'
            ] 
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

        // 2. EVITAR TIMEOUTS: Cambiamos 'networkidle' por 'domcontentloaded' (es más rápido y no espera a los anuncios)
        await page.goto('https://www.tvporinternet2.com/animal-planet-en-vivo-por-internet.html', { 
            waitUntil: 'domcontentloaded', 
            timeout: 30000 
        }).catch(() => console.log("Aviso: Navegación detenida, pero buscando link..."));

        let espera = 0;
        while (!m3u8Url && espera < 15) {
            await new Promise(r => setTimeout(r, 1000));
            espera++;
        }

        await browser.close();

        if (m3u8Url) {
            console.log("Link capturado, procesando Proxy Total...");
            
            const response = await fetch(m3u8Url, {
                headers: {
                    'Referer': 'https://www.tvporinternet2.com/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            let m3u8Text = await response.text();
            const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
            
            // Detectamos la URL de tu app en Railway automáticamente
            const serverUrl = `https://${req.get('host')}`;
            
            // 3. PROXY TOTAL: Reescribimos TODAS las rutas de video para que pasen por Railway
            m3u8Text = m3u8Text.replace(/^(?!#)(.+)$/gm, (match, p1) => {
                let fullUrl = p1.startsWith('http') ? p1 : baseUrl + p1;
                return `${serverUrl}/proxy-video?url=${encodeURIComponent(fullUrl)}`;
            });

            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.send(m3u8Text);

        } else {
            res.status(404).send("No se encontró el link.");
        }
    } catch (e) {
        console.error("Error general: ", e.message);
        if (browser) await browser.close();
        res.status(500).send("Error en el servidor.");
    }
});

// 4. EL NUEVO PUENTE: Este endpoint descarga los videos por ti y te los envía
app.get('/proxy-video', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('Falta URL');

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'Referer': 'https://www.tvporinternet2.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) throw new Error(`Error de origen: ${response.status}`);

        res.setHeader('Content-Type', response.headers.get('content-type') || 'video/mp2t');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));

    } catch (error) {
        res.status(500).end();
    }
});

app.get('/', (req, res) => res.send('Servidor activo. Pega la ruta /animal-planet en tu app.'));

app.listen(PORT, '0.0.0.0', () => console.log(`Servidor en puerto ${PORT}`));
