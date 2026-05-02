const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 8080;
const AGENT = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

app.get('/animal-planet.m3u8', async (req, res) => {
    console.log("=== Iniciando Rastreo Profundo ===");
    try {
        // 1. Entramos a la web principal
        const res1 = await axios.get('https://www.tvporinternet2.com/animal-planet-en-vivo-por-internet.html', {
            headers: { 'User-Agent': AGENT, 'Referer': 'https://www.google.com/' }
        });

        let html = res1.data;
        let regexLink = /https?:\/\/[^"']+\.m3u8\?token=[^"']+/i;
        let match = html.match(regexLink);

        // 2. Si no aparece, buscamos el reproductor (iframe)
        if (!match) {
            console.log("Link no visto en superficie, buscando en el reproductor...");
            const iframeMatch = html.match(/<iframe[^>]+src="([^"]+)"/i);
            
            if (iframeMatch) {
                const iframeUrl = iframeMatch[1];
                console.log("Entrando al túnel: " + iframeUrl);
                const res2 = await axios.get(iframeUrl, { 
                    headers: { 'User-Agent': AGENT, 'Referer': 'https://www.tvporinternet2.com/' } 
                });
                match = res2.data.match(regexLink);
            }
        }

        if (match) {
            const linkReal = match[0].replace(/\\/g, ''); // Limpiamos barras raras
            console.log("¡LO TENEMOS!: " + linkReal);
            res.redirect(`https://${req.get('host')}/proxy/video.m3u8?url=${encodeURIComponent(linkReal)}`);
        } else {
            console.log("La página escondió el link muy bien. Intenta refrescar.");
            res.status(404).send("Error: No se encontró la señal. La página está bloqueando el acceso.");
        }

    } catch (e) {
        console.error("Fallo técnico: ", e.message);
        res.status(500).send("Error del servidor: " + e.message);
    }
});

// PROXY (No lo toques, es el que hace que se vea en verde)
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
                'Referer': 'https://www.tvporinternet2.com/',
                'User-Agent': AGENT
            }
        });

        res.setHeader('Access-Control-Allow-Origin', '*');

        if (archivo.includes('.m3u8')) {
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            let text = Buffer.from(response.data).toString();
            const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
            
            let finalM3u8 = text.replace(/^(?!#)(.+)$/gm, (match, p1) => {
                let chunk = p1.trim();
                let fullUrl = chunk.startsWith('http') ? chunk : baseUrl + chunk;
                return `https://${req.get('host')}/proxy/chunk.ts?url=${encodeURIComponent(fullUrl)}`;
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

app.get('/', (req, res) => res.send('Cazador Activo y Listo.'));
app.listen(PORT, '0.0.0.0', () => console.log(`Puerto ${PORT}`));
