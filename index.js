const { chromium } = require('playwright');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/animal-planet', async (req, res) => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.new_context({
        userAgent: 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36'
    });
    const page = await context.newPage();
    let m3u8Url = null;

    page.on('request', request => {
        const url = request.url();
        if (url.includes('.m3u8') && url.includes('regionales')) {
            m3u8Url = url;
        }
    });

    try {
        await page.goto('https://www.tvporinternet2.com/animal-planet-en-vivo-por-internet.html', { 
            waitUntil: 'networkidle', timeout: 60000 
        });
        let espera = 0;
        while (!m3u8Url && espera < 15) {
            await new Promise(r => setTimeout(r, 1000));
            espera++;
        }
    } catch (e) { console.error(e); }

    await browser.close();

    if (m3u8Url) {
        res.redirect(m3u8Url); 
    } else {
        res.status(404).send("No se pudo capturar el link");
    }
});

app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
