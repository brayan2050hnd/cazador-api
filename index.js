const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

// Página de inicio para confirmar que todo está bien
app.get('/', (req, res) => {
    res.send('<h1>Servidor Nexus Iframe v1.9</h1><p>Usa la ruta <code>/ver-animal</code> para tu app.</p>');
});

// RUTA PARA TU APP (La que carga el reproductor original)
app.get('/ver-animal', (req, res) => {
    // Usamos la Opción 1 que vimos en tu archivo prueba.txt
    const urlPlayer = "https://www.tvporinternet2.com/live/animalplanet.php";

    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Nexus Player</title>
            <style>
                body, html { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; }
                iframe { width: 100%; height: 100%; border: none; position: absolute; top: 0; left: 0; }
            </style>
        </head>
        <body>
            <iframe 
                src="${urlPlayer}" 
                allow="autoplay; encrypted-media; fullscreen" 
                allowfullscreen>
            </iframe>
        </body>
        </html>
    `);
});

app.listen(PORT, '0.0.0.0', () => console.log("Servidor Iframe listo en puerto " + PORT));
