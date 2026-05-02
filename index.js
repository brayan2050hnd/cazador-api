const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 8080;
const AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

app.get('/automatico', async (req, res) => {
    console.log(">>> [LOG] Iniciando rastreo...");
    
    // Probamos la ruta que vimos en tu archivo prueba.txt
    const urlBase = 'https://www.tvporinternet2.com/live/animalplanet.php';

    try {
        const response = await axios.get(urlBase, {
            headers: { 
                'User-Agent': AGENT,
                'Referer': 'https://www.tvporinternet2.com/',
                'Accept': 'text/html'
            },
            timeout: 8000
        });

        const html = response.data;
        console.log(">>> [LOG] Página recibida. Longitud: " + html.length);

        // Buscamos el dominio saohgdasregions o regionales
        const regex = /https?[:\/\\]+[^"']*(regionales|saohgdasregions|46_)[^"']+\.m3u8\?token=[^"'\s&]+/i;
        const match = html.match(regex);

        if (match) {
            const link = match[0].replace(/\\/g, '');
            console.log(">>> [EXITO] Link capturado.");
            return res.redirect(`/player?url=${encodeURIComponent(link)}`);
        } else {
            // SI FALLA, vamos a ver qué recibió el servidor (Primeros 300 caracteres)
            console.log(">>> [ERROR] No se halló el link. El servidor recibió esto: " + html.substring(0, 300));
            res.status(404).send("<h1>Error de Rastreo</h1><p>El servidor de TV no entregó el link a Railway. Revisa los logs.</p>");
        }
    } catch (e) {
        console.log(">>> [FALLO TOTAL] Error de conexión: " + e.message);
        res.status(500).send("Error de conexión: " + e.message);
    }
});

// REPRODUCTOR
app.get('/player', (req, res) => {
    const urlM3u8 = req.query.url;
    res.send(`
        <html>
        <head><meta name="viewport" content="width=device-width, initial-scale=1"><script src="https://cdn.jsdelivr.net/npm/clappr@latest/dist/clappr.min.js"></script></head>
        <body style="margin:0; background:#000;"><div id="p" style="width:100vw; height:100vh;"></div>
        <script>new Clappr.Player({source: "${urlM3u8}", parentId: "#p", width: "100%", height: "100%", autoPlay: true, mimeType: "application/x-mpegURL"});</script>
        </body></html>
    `);
});

app.get('/', (req, res) => res.send('Servidor Activo v1.8'));
app.listen(PORT, '0.0.0.0');
