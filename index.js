const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 8080;
const AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

app.get('/animal-planet.m3u8', async (req, res) => {
    console.log("=== Iniciando extracción automática de Token ===");
    try {
        // 1. Entramos a la página de forma quirúrgica (solo el texto)
        const response = await axios.get('https://www.tvporinternet2.com/animal-planet-en-vivo-por-internet.html', {
            headers: { 
                'User-Agent': AGENT,
                'Referer': 'https://www.google.com/' 
            }
        });

        const html = response.data;

        // 2. Buscamos el link que encontraste con Reqable usando una expresión regular
        // Buscamos algo que diga "regionales... .m3u8?token=..."
        const regex = /https:\/\/regionales[^\s"']+\.m3u8\?token=[a-zA-Z0-9_-]+&expires=[0-9]+/g;
        const match = html.match(regex);

        if (match && match[0]) {
            let realUrl = match[0];
            console.log("¡Token Atrapado Automáticamente!: " + realUrl);
            
            // 3. Redirigimos a nuestro proxy para saltar el bloqueo de IP/Referer
            res.redirect(`https://${req.get('host')}/proxy/video.m3u8?url=${encodeURIComponent(realUrl)}`);
        } else {
            console.log("Error: El token no estaba en el HTML. Puede que usen un iframe.");
            // Si falla, intentamos buscar el iframe
            const iframeRegex = /src="(https:\/\/wv.[^"]+)"/;
            const iframeMatch = html.match(iframeRegex);
            
            if (iframeMatch) {
                console.log("Buscando dentro del iframe: " + iframeMatch[1]);
                // Aquí podrías repetir el proceso para el iframe si fuera necesario
            }
            
            res.status(404).send("No se pudo cazar el link. La página cambió el formato.");
        }
    } catch (e) {
        console.error("Error en la cacería: ", e.message);
        res.status(500).send("Error del servidor");
    }
});

// PROXY SEGURO (Mantiene el Referer correcto para que el servidor no nos bloquee)
app.get('/proxy/:archivo', async (req, res) => {
    const targetUrl = req.query.url;
    const archivo = req.params.archivo;
    if (!targetUrl) return res.status(400).send('Falta URL');

    try {
        const response = await axios({
            method: 'get',
            url: targetUrl,
            responseType: 'arraybuffer',
            headers: {
                'Referer': 'https://www.tvporinternet2.com/', // Indispensable
                'User-Agent': AGENT
            }
        });

        res.setHeader('Access-Control-Allow-Origin', '*');

        if (archivo.includes('.m3u8')) {
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            let text = Buffer.from(response.data).toString();
            
            const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
            
            // Corregimos los links internos de los segmentos .ts
            let finalM3u8 = text.replace(/^(?!#)(.+)$/gm, (match, p1) => {
                let chunk = p1.trim();
                let fullUrl = chunk.startsWith('http') ? chunk : baseUrl + chunk;
                return `https://${req.get('host')}/proxy/segmento.ts?url=${encodeURIComponent(fullUrl)}`;
            });

            res.send(finalM3u8);
        } else {
            res.setHeader('Content-Type', 'video/mp2t');
            res.send(response.data);
        }
    } catch (error) {
        res.status(500).end();
    }
});

app.get('/', (req, res) => res.send('Cazador Automático Activo.'));
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor listo en puerto ${PORT}`));

