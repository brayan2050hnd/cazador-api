const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 8080;
const AGENT = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

// RUTA AUTOMÁTICA: Intenta cazar el link entrando a los PHP que encontré en tu archivo
app.get('/animal-planet.m3u8', async (req, res) => {
    // Estas son las rutas que vi en tu prueba.txt
    const opciones = [
        'https://www.tvporinternet2.com/live/animalplanet.php',
        'https://www.tvporinternet2.com/live4/animalplanet.php', // Opción FHD
        'https://www.tvporinternet2.com/live6/animalplanet.php'
    ];

    console.log(">>> Iniciando rastreo en las 6 opciones...");

    for (let url de opciones) {
        try {
            const response = await axios.get(url, {
                headers: { 'User-Agent': AGENT, 'Referer': 'https://www.tvporinternet2.com/' },
                timeout: 5000
            });
            
            // Buscamos el dominio saohgdasregions que aparece en tu archivo
            const regex = /https?[:\/\\]+[^"']*(regionales|saohgdasregions)[^"']+\.m3u8\?token=[^"'\s&]+/i;
            const match = response.data.match(regex);

            if (match) {
                let streamUrl = match[0].replace(/\\/g, '');
                console.log(">>> ¡LOGRADO! Link capturado de: " + url);
                return res.redirect(`/player?url=${encodeURIComponent(streamUrl)}`);
            }
        } catch (e) { continue; }
    }
    res.status(404).send("No se pudo cazar el link. Usa el modo /manual con Reqable.");
});

// EL REPRODUCTOR (IFRAME) - Basado en lo que pidió tu App
app.get('/player', (req, res) => {
    const urlM3u8 = req.query.url;
    if(!urlM3u8) return res.send("Falta el link");
    res.send(`
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <script src="https://cdn.jsdelivr.net/npm/clappr@latest/dist/clappr.min.js"></script>
        </head>
        <body style="margin:0; background:#000;">
            <div id="player" style="width:100vw; height:100vh;"></div>
            <script>
                var player = new Clappr.Player({
                    source: "${urlM3u8}",
                    parentId: "#player",
                    width: "100%", height: "100%", autoPlay: true,
                    mimeType: "application/x-mpegURL"
                });
            </script>
        </body>
        </html>
    `);
});

// MODO MANUAL (El que nunca falla)
app.get('/manual', (req, res) => {
    const urlReqable = req.query.url;
    if(!urlReqable) return res.send("Usa: /manual?url=LINK_DE_REQABLE");
    res.redirect(`/player?url=${encodeURIComponent(urlReqable)}`);
});

app.get('/', (req, res) => res.send('<h1>Cazador Nexus v1.6</h1>'));
app.listen(PORT, '0.0.0.0');
