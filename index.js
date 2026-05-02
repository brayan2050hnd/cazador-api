const { chromium } = require('playwright');
const express = require('express');
const app = express();

const PORT = process.env.PORT || 8080;

app.get('/animal-planet', async (req, res) => {
    console.log("Iniciando caceria...");
    let browser;
    try {
        browser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        
        // CORREGIDO: Usamos newContext() en lugar de new_context
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
        });
        
        const page = await context.newPage();
        let m3u8Url = null;

        page.on('request', request => {
            const url = request.url();
            if (url.includes('.m3u8') && (url.includes('regionales') || url.includes('token'))) {
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
            res.redirect(m3u8Url);
        } else {
            res.status(404).send("No se encontró el link. Intenta de nuevo en unos segundos.");
        }
    } catch (e) {
        console.error("Error detectado: ", e.message);
        if (browser) await browser.close();
        res.status(500).send("Error en el servidor: " + e.message);
    }
});

app.get('/', (req, res) => res.send('Servidor Cazador Online. Usa /animal-planet'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor en puerto ${PORT}`);
});
