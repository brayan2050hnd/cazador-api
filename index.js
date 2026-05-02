const express = require('express');
const app = express();

const PORT = process.env.PORT || 8080;

// 1. PÁGINA DE INICIO
app.get('/', (req, res) => {
    res.send('<h1>Servidor de Iframe Nexus</h1>');
});

// 2. EL CREADOR DE IFRAME (Aquí ocurre la magia)
app.get('/player', (req, res) => {
    const urlM3u8 = req.query.url;
    if(!urlM3u8) return res.send("Falta el link .m3u8");

    // Generamos un HTML con el reproductor Clappr (es muy bueno para Android)
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <script src="https://cdn.jsdelivr.net/npm/clappr@latest/dist/clappr.min.js"></script>
            <style>
                body, html { margin:0; padding:0; width:100%; height:100%; background:#000; overflow:hidden; }
                #player { width: 100vw; height: 100vh; }
            </style>
        </head>
        <body>
            <div id="player"></div>
            <script>
                var player = new Clappr.Player({
                    source: "${urlM3u8}",
                    parentId: "#player",
                    width: "100%",
                    height: "100%",
                    autoPlay: true,
                    mimeType: "application/x-mpegURL",
                    plugins: {
                        html5Video: {
                            hlsjsConfig: {
                                // Esto ayuda a que cargue más rápido
                                enableWorker: true,
                                lowLatencyMode: true,
                            }
                        }
                    }
                });
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, '0.0.0.0', () => console.log(`Reproductor listo en puerto ${PORT}`));
