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
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            extraHTTPHeaders: {
                'Referer': 'https://www.tvporinternet2.com/'
            }
        });
        
        const page = await context.newPage();
        let m3u8Url = null;

        page.on('request', request => {
            const url = request.url();
            if (url.includes('.m3u8')) {
                m3u8Url = url;
            }
        });

        await page.goto('https://www.tvporinternet2.com/animal-planet-en-vivo-por-internet.html', { 
            waitUntil: 'networkidle', 
            timeout: 60000 
        });

        let espera = 0;
        while (!m3u8Url && espera < 15) {
            await new Promise(r => setTimeout(r, 1000));
            espera++;
        }

        await browser.close();

        if (m3u8Url) {
            console.log("Link capturado, procesando puente m3u8...");
            
            // 1. Hacemos que Railway pida el archivo m3u8 para saltar el bloqueo de IP/Token
            const response = await fetch(m3u8Url, {
                headers: {
                    'Referer': 'https://www.tvporinternet2.com/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            let m3u8Text = await response.text();

            // 2. Extraemos la ruta base del link original
            const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
            
            // 3. Arreglamos los fragmentos de video (.ts) para que tu app sepa de dónde descargarlos
            // Esta línea mágica añade la URL base a cualquier línea que no empiece con http o #
            m3u8Text = m3u8Text.replace(/^(?!http|#)(.+)$/gm, baseUrl + '$1');

            // 4. Se lo enviamos a tu app indicando que es un formato de video directo
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.send(m3u8Text);

        } else {
            res.status(404).send("No se encontró el link. Intenta de nuevo.");
        }
    } catch (e) {
        console.error("Error: ", e.message);
        if (browser) await browser.close();
        res.status(500).send("Error en el servidor: " + e.message);
    }
});

app.get('/', (req, res) => res.send('Servidor Cazador Online. Pega la ruta /animal-planet en tu app.'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor activo en puerto ${PORT}`);
});
