const { chromium } = require('playwright');
const express = require('express');
const app = express();

// Railway usa el puerto que él quiere, por eso usamos process.env.PORT
const PORT = process.env.PORT || 8080;

app.get('/animal-planet', async (req, res) => {
    console.log("Iniciando cacería de link...");
    
    // Lanzamos el navegador con configuraciones para que no falle en el servidor
    const browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    const context = await browser.new_context({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    let m3u8Url = null;

    // Escuchamos el tráfico de red para pescar el link .m3u8
    page.on('request', request => {
        const url = request.url();
        if (url.includes('.m3u8') && (url.includes('regionales') || url.includes('token'))) {
            m3u8Url = url;
            console.log("¡Link capturado!: " + m3u8Url);
        }
    });

    try {
        // Entramos a la web que tiene el reproductor
        await page.goto('https://www.tvporinternet2.com/animal-planet-en-vivo-por-internet.html', { 
            waitUntil: 'networkidle', 
            timeout: 60000 
        });

        // Esperamos un máximo de 15 segundos a que aparezca el link en la red
        let espera = 0;
        while (!m3u8Url && espera < 15) {
            await new Promise(r => setTimeout(r, 1000));
            espera++;
        }
    } catch (e) {
        console.error("Error durante la navegación: ", e.message);
    }

    await browser.close();

    if (m3u8Url) {
        // Si lo encontramos, redirigimos al usuario al video
        res.redirect(m3u8Url);
    } else {
        res.status(404).send("No se pudo capturar el link. Intenta de nuevo en unos segundos.");
    }
});

// Ruta principal para saber si el servidor está vivo
app.get('/', (req, res) => {
    res.send('Servidor Cazador Online. Usa /animal-planet para obtener el link.');
});

// IMPORTANTE: '0.0.0.0' es necesario para que Railway acepte conexiones externas
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
