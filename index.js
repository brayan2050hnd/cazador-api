const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 8080;
const AGENT = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

app.get('/', (req, res) => res.send('Servidor Blindado Activo'));

app.get('/manual', (req, res) => {
    const urlReqable = req.query.url;
    if(!urlReqable) return res.send("Falta el parámetro ?url=");
    res.redirect(`/proxy/playlist.m3u8?url=${encodeURIComponent(urlReqable)}`);
});

app.get('/proxy/:archivo', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('URL no válida');

    // Intentamos extraer tu IP del link de Reqable para "suplantarla"
    // El pedazo 'MTgxLjExNS4xMTkuODY=' equivale a '181.115.119.86'
    const miIpDeHonduras = "181.115.119.86"; 

    try {
        const response = await axios({
            method: 'get',
            url: targetUrl,
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': AGENT,
                'Referer': 'https://www.tvporinternet2.com/',
                'X-Forwarded-For': miIpDeHonduras, // Intentamos engañar al servidor
                'X-Real-IP': miIpDeHonduras,
                'Accept': '*/*',
                'Connection': 'keep-alive'
            },
            timeout: 12000
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
        // Si sigue dando 403, el servidor de la TV es demasiado inteligente
        res.status(e.response ? e.response.status : 500).send("El servidor de TV sigue bloqueando la IP de Railway (Error 403)");
    }
});

app.listen(PORT, '0.0.0.0');
