const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 8080;
const AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// 1. FUNCIÓN PARA BUSCAR EL LINK AUTOMÁTICAMENTE
async function buscarLink() {
    try {
        const res = await axios.get('https://www.tvporinternet2.com/animal-planet-en-vivo-por-internet.html', {
            headers: { 'User-Agent': AGENT, 'Referer': 'https://www.google.com/' },
            timeout: 10000
        });
        // Buscamos específicamente el dominio "regionales" o cualquier m3u8 con token
        const regex = /https?[:\/\\]+[^"']*(regionales|saohgdasregions|46_)[^"']+\.m3u8\?token=[^"'\s&]+/i;
        const match = res.data.match(regex);
        return match ? match[0].replace(/\\/g, '') : null;
    } catch (e) {
        return null;
    }
}

// 2. RUTA PARA TU APP (AUTOMÁTICA)
app.get('/animal-planet.m3u8', async (req, res) => {
    console.log(">>> [AUTO] Buscando señal...");
    let link = await buscarLink();
    
    if (link) {
        console.log(">>> [OK] Link encontrado automáticamente.");
        res.redirect(`/proxy/playlist.m3u8?url=${encodeURIComponent(link)}`);
    } else {
        res.status(404).send("<h1>El Cazador no encontró el link automáticamente</h1><p>Cloudflare bloqueó al servidor. Prueba el modo manual: <code>/manual?url=AQUI_EL_LINK_DE_REQABLE</code></p>");
    }
});

// 3. RUTA MANUAL (POR SI CLOUDFLARE BLOQUEA A RAILWAY)
// Solo pegas el link que sacaste de Reqable y el servidor hará el resto
app.get('/manual', (req, res) => {
    const urlReqable = req.query.url;
    if(!urlReqable) return res.send("Pega el link de Reqable así: /manual?url=LINK_DE_REQABLE");
    res.redirect(`/proxy/playlist.m3u8?url=${encodeURIComponent(urlReqable)}`);
});

// 4. EL PROXY (LO QUE HACE QUE EL VIDEO NO SE CORTE)
app.get('/proxy/:archivo', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('Falta URL');

    try {
        const response = await axios({
            method: 'get', url: targetUrl, responseType: 'arraybuffer',
            headers: { 'Referer': 'https://www.tvporinternet2.com/', 'User-Agent': AGENT },
            timeout: 10000
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
    } catch (e) { res.status(500).end(); }
});

app.get('/', (req, res) => res.send('<h1>Cazador Híbrido Activo</h1><p>Canal Automático: /animal-planet.m3u8</p>'));
app.listen(PORT, '0.0.0.0', () => console.log(`Puerto ${PORT}`));

