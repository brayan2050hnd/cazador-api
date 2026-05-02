const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 8080;

// User-Agent de un celular Android real para engañar al servidor
const AGENT = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

app.get('/', (req, res) => {
    res.send('<h1>Servidor Camaleón Activo</h1>');
});

app.get('/manual', (req, res) => {
    const urlReqable = req.query.url;
    if(!urlReqable) return res.status(400).send("Pega el link de Reqable tras el ?url=");
    res.redirect(`/proxy/playlist.m3u8?url=${encodeURIComponent(urlReqable)}`);
});

app.get('/proxy/:archivo', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('URL no válida');

    try {
        const response = await axios({
            method: 'get',
            url: targetUrl,
            responseType: 'arraybuffer',
            headers: {
                // Estas 3 líneas son las que saltan el Error 403
                'User-Agent': AGENT,
                'Referer': 'https://www.tvporinternet2.com/',
                'Origin': 'https://www.tvporinternet2.com',
                'Accept': '*/*',
                'Connection': 'keep-alive'
            },
            timeout: 15000
        });

        // Permitir que cualquier app (como la tuya) lea el video
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

        if (req.params.archivo.includes('.m3u8')) {
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            let text = Buffer.from(response.data).toString();
            const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
            
            // Re-escribimos los segmentos para que también pasen por el proxy
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
    } catch (e) {
        console.error("Fallo en el proxy:", e.message);
        // Si el servidor nos rebota, te lo digo claramente
        res.status(e.response ? e.response.status : 500).send(`Error del Servidor Original: ${e.message}`);
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Online en puerto ${PORT}`));
