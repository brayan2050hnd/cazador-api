const express = require('express');
const axios = require('axios');
const morgan = require('morgan');
const app = express();

app.use(morgan('dev'));

const PORT = process.env.PORT || 8080;
const AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

app.get('/animal-planet.m3u8', async (req, res) => {
    console.log(">>> [LOG] Iniciando búsqueda de señal...");
    try {
        // 1. Pedimos la página con headers de un navegador humano
        const response = await axios.get('https://www.tvporinternet2.com/animal-planet-en-vivo-por-internet.html', {
            headers: { 
                'User-Agent': AGENT,
                'Referer': 'https://www.google.com/',
                'Accept-Language': 'es-ES,es;q=0.9'
            },
            timeout: 12000
        });

        const html = response.data;
        console.log(">>> [LOG] Tamaño de página recibida: " + html.length + " caracteres.");

        // REGEX ULTRA-POTENTE: Busca cualquier cosa que termine en .m3u8 y tenga un token
        // Esto atrapará el dominio "regionales" que vimos en Reqable
        const regex = /https?[:\/\\]+[^"']+\.m3u8\?token=[^"'\s&]+/i;
        let match = html.match(regex);

        // 2. Si no lo encuentra, busca el reproductor secundario (el túnel)
        if (!match) {
            console.log(">>> [LOG] No se vio el link. Buscando reproductor oculto...");
            const iframeMatch = html.match(/iframe[^>]+src="([^"]+)"/i);
            if (iframeMatch) {
                console.log(">>> [LOG] Entrando al iframe: " + iframeMatch[1]);
                const res2 = await axios.get(iframeMatch[1], { 
                    headers: { 'User-Agent': AGENT, 'Referer': 'https://www.tvporinternet2.com/' } 
                });
                match = res2.data.match(regex);
            }
        }

        if (match) {
            let streamUrl = match[0].replace(/\\/g, ''); // Limpiar el link
            console.log(">>> [EXITO] Link Atrapado: " + streamUrl);
            
            // REDIRECCIÓN DIRECTA AL PROXY
            res.redirect(`https://${req.get('host')}/proxy/playlist.m3u8?url=${encodeURIComponent(streamUrl)}`);
        } else {
            // Si llegamos aquí, imprimimos un pedazo del código en los logs para saber qué pasa
            console.log(">>> [ERROR] No hay rastro del link. El código empieza con: " + html.substring(0, 200));
            res.status(404).send("Error: La señal está escondida. Intenta refrescar o verifica los logs de Railway.");
        }

    } catch (e) {
        console.error(">>> [FALLO]: " + e.message);
        res.status(500).send("Error de conexión: " + e.message);
    }
});

// PROXY (Esto hace que el video cargue en Honduras aunque el servidor esté en USA)
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
                'User-Agent': AGENT
            }
        });

        res.setHeader('Access-Control-Allow-Origin', '*');

        if (req.params.archivo.includes('.m3u8')) {
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            let text = Buffer.from(response.data).toString();
            const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
            
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
        res.status(500).end();
    }
});

app.get('/', (req, res) => res.send('<h1>Cazador Activo v1.3</h1><p>Prueba el canal en: <a href="/animal-planet.m3u8">/animal-planet.m3u8</a></p>'));
app.listen(PORT, '0.0.0.0', () => console.log(`Iniciado en puerto ${PORT}`));
