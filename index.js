const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 8080;
const AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

app.get('/animal-planet.m3u8', async (req, res) => {
    console.log("=== Iniciando extracción automática ===");
    try {
        const response = await axios.get('https://www.tvporinternet2.com/animal-planet-en-vivo-por-internet.html', {
            headers: { 
                'User-Agent': AGENT,
                'Referer': 'https://www.google.com/' 
            }
        });

        const html = response.data;
        // Buscamos el link que encontraste con Reqable
        const regex = /https:\/\/regionales[^\s"']+\.m3u8\?token=[a-zA-Z0-9_-]+&expires=[0-9]+/g;
        const match = html.match(regex);

        if (match && match[0]) {
            console.log("¡Token Atrapado!: " + match[0]);
            res.redirect(`https://${req.get('host')}/proxy/video.m3u8?url=${encodeURIComponent(match[0])}`);
        } else {
            res.status(404).send("No se encontró el link en el código. Puede que el token esté oculto.");
        }
    } catch (e) {
        res.status(500).send("Error: " + e.message);
    }
});

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

app.get('/', (req, res) => res.send('Cazador Online y Ligero.'));
app.listen(PORT, '0.0.0.0', () => console.log(`Puerto ${PORT}`));
