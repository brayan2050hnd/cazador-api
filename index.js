const { chromium } = require('playwright');
const express = require('express');
const app = express();

// Railway asigna el puerto automáticamente
const PORT = process.env.PORT || 8080;

app.get('/animal-planet', async (req, res) => {
    console.log("Iniciando cacería de link...");
    
    const browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    const context = await browser.new_context({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    let m3u8Url = null;

    // Escuchamos la red para pescar el enlace .m3u8
    page.on('request', request => {
        const url = request.url();
        if (url.includes('.m3u8') && (url.includes('regionales') || url.includes('token'))) {
            m3u8Url = url;
            console.log("¡Link capturado!: " + m3u8Url);
        }
    });

    try {
        await page.goto('https://www.tvporinternet2.com/animal-planet-en-vivo-por-internet.html', { 
            waitUntil: 'networkidle', 
            timeout: 60000 
        });

        // Esperamos hasta 15 segundos a que el link aparezca
        let espera = 0;
        while (!m3u8Url && espera < 15) {
            await new Promise(r => setTimeout(r, 1000));
            espera++;
        }
    } catch (e) {
        console.error("Error en la navegación: ", e.message);
    }

    await browser.close();

    if (m3u8Url) {
        res.redirect(m3u8Url);
    } else {
        res.status(404).send("No se pudo obtener el link dinámico. Intenta de nuevo.");
    }
});

app.get('/', (req, res) => {
    res.send('Servidor Cazador de Enlaces Online. Usa /animal-planet');
});

// IMPORTANTE: '0.0.0.0' permite que el servidor sea accesible externamente
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
