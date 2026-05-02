const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 8080;
const AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Página de inicio para confirmar que el servidor está vivo
app.get('/', (req, res) => {
    res.send('<h1>Servidor Nexus Online</h1><p>El sistema está listo para recibir el link manual.</p>');
});

// RUTA MANUAL
app.get('/manual', (req, res) => {
    const urlReqable = req.query.url;
    if(!urlReqable) return res.status(400).send("Falta el link. Úsalo así: /manual?url=LINK_AQUÍ");
    
    // Redirigimos al proxy interno
    res.redirect(`/proxy/playlist.m3u8?url=${encodeURIComponent(urlReqable)}`);
});

// MOTOR DEL PROXY (Aquí es donde ocurre la magia)
app.get('/proxy/:archivo', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('URL objetivo no válida');

    try {
        const response = await axios({
            method: 'get',
            url: targetUrl,
            responseType: 'arraybuffer',
            headers: {
                'Referer': 'https://www.tvporinternet2.com/',
                'User-Agent': AGENT
            },
            timeout: 15000
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
    } catch (e) {
        console.error("Error en Proxy:", e.message);
        res.status(500).send("Error en el Proxy: " + e.message);
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Servidor en puerto ${PORT}`));
