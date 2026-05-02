const { chromium } = require('playwright');
const express = require('express');
const app = express();

const PORT = process.env.PORT || 8080;

app.get('/animal-planet', async (req, res) => {
    console.log("Iniciando cacería...");
    const browser = await chromium.launch({ 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const context = await browser.new_context();
    const page = await context.newPage();
    let m3u8Url = null;

    page.on('request', request => {
        const url = request.url();
        if (url.includes('.m3u8') && (url.includes('regionales') || url.includes('token'))) {
            m3u8Url = url;
        }
    });

    try {
        await page.goto('https://www.tvporinternet2.com/animal-planet-en-vivo-por-internet.html', { 
            waitUntil: 'networkidle', 
            timeout: 60000 
        });
        let espera = 0;
        while (!m3u8Url && espera < 15) {
            await new Promise(r => setTimeout(r, 1000));
            espera++;
        }
    } catch (e) {
        console.error("Error: ", e.message);
    }

    await browser.close();
    if (m3u8Url) res.redirect(m3u8Url);
    else res.status(404).send("No se encontró el link. Intenta de nuevo.");
});

app.get('/', (req, res) => res.send('Cazador Online Listo. Ve a /animal-planet'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor en puerto ${PORT}`);
});
