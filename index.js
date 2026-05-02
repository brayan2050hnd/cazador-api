const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
    res.send('<h1>Servidor Nexus Activo</h1><p>Prueba estas rutas en tu app:</p><ul><li><a href="/opcion1">Opción Normal</a></li><li><a href="/opcion2">Opción FHD</a></li></ul>');
});

// OPCIÓN 1 (Normal)
app.get('/opcion1', (req, res) => {
    enviarIframe(res, "https://www.tvporinternet2.com/live/animalplanet.php");
});

// OPCIÓN 2 (FHD - La que vimos en tu archivo)
app.get('/opcion2', (req, res) => {
    enviarIframe(res, "https://www.tvporinternet2.com/live4/animalplanet.php");
});

function enviarIframe(res, url) {
    res.send(`
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>body,html{margin:0;padding:0;width:100%;height:100%;background:#000;overflow:hidden;} iframe{width:100%;height:100%;border:none;}</style>
        </head>
        <body>
            <iframe src="${url}" allowfullscreen allow="autoplay"></iframe>
        </body>
        </html>
    `);
}

app.listen(PORT, '0.0.0.0');
