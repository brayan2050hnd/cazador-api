const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 8080;
const AGENT = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

// 1. RUTA AUTOMÁTICA (La que usarás en tu App Nexus)
app.get('/automatico', async (req, res) => {
    console.log(">>> [AUTO] Iniciando rastreo de señal...");
    
    // Probamos las 3 opciones principales que vimos en tu archivo prueba.txt
    const fuentes = [
        'https://www.tvporinternet2.com/live/animalplanet.php',
        'https://www.tvporinternet2.com/live4/animalplanet.php',
        'https://www.tvporinternet2.com/live6/animalplanet.php'
    ];

    for (let url of fuentes) {
        try {
            console.log(">>> Buscando en: " + url);
            const response = await axios.get(url, {
                headers: { 
                    'User-Agent': AGENT,
                    'Referer': 'https://www.tvporinternet2.com/',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                timeout: 6000
            });

            // Buscamos el patrón del link con token que vimos en Reqable
            const regex = /https?[:\/\\]+[^"']*(regionales|saohgdasregions|46_)[^"']+\.m3u8\?token=[^"'\s&]+/i;
            const match = response.data.match(regex);

            if (match) {
                const linkLimpio = match[0].replace(/\\/g, '');
                console.log(">>> ¡BINGO! Link cazado automáticamente.");
                // Te redirige directo al reproductor con el link nuevo
                return res.redirect(`/player?url=${encodeURIComponent(linkLimpio)}`);
            }
        } catch (e) {
            console.log(">>> Opción fallida o bloqueada.");
            continue;
        }
    }

    res.status(404).send("<h1>El robot no pudo hallar el link</h1><p>Es posible que el servidor de TV haya bloqueado a Railway. Intenta el modo /manual.</p>");
});

// 2. EL REPRODUCTOR (Mismo de antes, pero optimizado)
app.get('/player', (req, res) => {
    const urlM3u8 = req.query.url;
    if(!urlM3u8) return res.send("Falta el link");
    res.send(`
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <script src="https://cdn.jsdelivr.net/npm/clappr@latest/dist/clappr.min.js"></script>
            <style>body{margin:0; background:#000;} #p{width:100vw; height:100vh;}</style>
        </head>
        <body>
            <div id="p"></div>
            <script>
                new Clappr.Player({
                    source: "${urlM3u8}",
                    parentId: "#p",
                    width: "100%", height: "100%", autoPlay: true,
                    mimeType: "application/x-mpegURL"
                });
            </script>
        </body>
        </html>
    `);
});

// 3. MODO MANUAL (Por si las moscas)
app.get('/manual', (req, res) => {
    res.redirect(`/player?url=${encodeURIComponent(req.query.url)}`);
});

app.get('/', (req, res) => res.send('<h1>Cazador Nexus v1.7 - Automático</h1>'));
app.listen(PORT, '0.0.0.0');
