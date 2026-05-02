const express = require('express');
const axios = require('axios');
const morgan = require('morgan');
const app = express();

app.use(morgan('dev')); // Esto nos mostrará cada petición en los logs

const PORT = process.env.PORT || 8080;
const AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

app.get('/animal-planet.m3u8', async (req, res) => {
    console.log(">>> BUSCANDO SEÑAL...");
    try {
        // Intentamos entrar a la página
        const response = await axios.get('https://www.tvporinternet2.com/animal-planet-en-vivo-por-internet.html', {
            headers: { 'User-Agent': AGENT, 'Referer': 'https://www.google.com/' },
            timeout: 10000
        });

        const html = response.data;
        
        // Buscamos el dominio que cazaste con Reqable
        // Buscamos cualquier cosa que tenga "regionales" y termine en ".m3u8"
        const regex = /https?:\/\/[^"']*(regionales|saohgdasregions)[^"']+\.m3u8[^"']*/i;
        const match = html.match(regex);

        if (match) {
            let streamUrl = match[0].replace(/\\/g, ''); // Limpiar barras de escape
            console.log(">>> ¡ENCONTRADO!: " + streamUrl);
            
            // REDIRIGIMOS AL PROXY (Esto es clave para que funcione con tu IP)
            res.redirect(`https://${req.get('host')}/proxy/playlist.m3u8?url=${encodeURIComponent(streamUrl)}`);
        } else {
            console.log(">>> El link no está en el HTML. Buscando alternativas...");
            res.status(404).send("No se encontró el link. Es posible que el sitio use JavaScript dinámico.");
        }
    } catch (e) {
        console.error(">>> ERROR AL ENTRAR A LA WEB: " + e.message);
        res.status(500).send("Error conectando con la fuente: " + e.message);
    }
});

// EL MOTOR DEL PROXY (No tocar, es sagrado)
app.get('/proxy/:archivo', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('Falta URL');

    try {
        const response = await axios({
            method: 'get',
            url: targetUrl,
            responseType: 'arraybuffer',
            headers: {
                'Referer': 'https://www.tvporinternet2.com/',
                'User-Agent': AGENT,
                'Origin': 'https://www.tvporinternet2.com'
            }
        });

        res.setHeader('Access-Control-Allow-Origin', '*');

        if (req.params.archivo.includes('.m3u8')) {
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            let text = Buffer.from(response.data).toString();
            const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
            
            // Reemplazamos los links de los segmentos para que pasen por el proxy
            let finalM3u8 = text.replace(/^(?!#)(.+)$/gm, (match, p1) => {
                let chunk = p1.trim();
                let fullUrl = chunk.startsWith('http') ? chunk : baseUrl + chunk;
                return `https://${req.get('host')}/proxy/video.ts?url=${encodeURIComponent(fullUrl)}`;
            });
            res.send(finalM3u8);
        } else {
            res.setHeader('Content-Type', 'video/mp2t');
            res.send(response.data);
        }
    } catch (error) {
        console.error(">>> ERROR EN PROXY: " + error.message);
        res.status(500).end();
    }
});

app.get('/', (req, res) => res.send('Servidor de Video Activo v1.2'));

app.listen(PORT, '0.0.0.0', () => {
    console.log("========================================");
    console.log(`Servidor corriendo en puerto ${PORT}`);
    console.log("========================================");
});
