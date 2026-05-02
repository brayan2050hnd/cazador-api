const express = require('express');
const axios = require('axios');
const morgan = require('morgan');
const app = express();

// Usamos morgan para ver las peticiones en tiempo real en los logs de Railway
app.use(morgan('dev'));

const PORT = process.env.PORT || 8080;

// User-Agent de un celular real para no levantar sospechas
const AGENT = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

app.get('/animal-planet.m3u8', async (req, res) => {
    console.log(">>> [INICIO] Buscando señal de Animal Planet...");
    
    try {
        // 1. Intentamos entrar a la web principal
        const res1 = await axios.get('https://www.tvporinternet2.com/animal-planet-en-vivo-por-internet.html', {
            headers: { 
                'User-Agent': AGENT, 
                'Referer': 'https://www.google.com/',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
            },
            timeout: 15000 // 15 segundos de espera antes de rendirse
        });

        const html = res1.data;
        
        // Expresión regular para encontrar el dominio "regionales" que viste en Reqable
        const regexStream = /https?:\/\/[^"']*(regionales|saohgdasregions)[^"']+\.m3u8[^"']*/i;
        let match = html.match(regexStream);

        // 2. Si no aparece en la superficie, buscamos dentro del iframe (reproductor)
        if (!match) {
            console.log(">>> Link no visto en superficie, buscando dentro del iframe...");
            const iframeMatch = html.match(/<iframe[^>]+src="([^"]+)"/i);
            
            if (iframeMatch) {
                const iframeUrl = iframeMatch[1];
                console.log(">>> Entrando al túnel del reproductor: " + iframeUrl);
                
                const res2 = await axios.get(iframeUrl, { 
                    headers: { 'User-Agent': AGENT, 'Referer': 'https://www.tvporinternet2.com/' },
                    timeout: 10000
                });
                match = res2.data.match(regexStream);
            }
        }

        if (match) {
            const linkReal = match[0].replace(/\\/g, ''); // Limpiar caracteres de escape
            console.log(">>> ¡BINGO! Link cazado: " + linkReal);
            
            // Redirigimos al proxy interno para saltar el bloqueo de IP/Referer
            const proxyUrl = `https://${req.get('host')}/proxy/playlist.m3u8?url=${encodeURIComponent(linkReal)}`;
            res.redirect(proxyUrl);
        } else {
            console.log(">>> ERROR: El link no apareció en el código. Puede que el token sea dinámico.");
            res.status(404).send("No se encontró la señal. Intenta refrescar la página en unos minutos.");
        }

    } catch (e) {
        console.error(">>> FALLO TÉCNICO: " + e.message);
        res.status(500).send("Error conectando con la fuente (Posible bloqueo de Cloudflare): " + e.message);
    }
});

// --- MOTOR DEL PROXY (HACE QUE EL VIDEO SE VEA EN TU APP) ---
app.get('/proxy/:archivo', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('Falta URL');

    try {
        const response = await axios({
            method: 'get',
            url: targetUrl,
            responseType: 'arraybuffer',
            headers: {
                'Referer': 'https://www.tvporinternet2.com/', // Indispensable para que el servidor no nos rebote
                'User-Agent': AGENT,
                'Origin': 'https://www.tvporinternet2.com'
            },
            timeout: 10000
        });

        res.setHeader('Access-Control-Allow-Origin', '*');

        // Si es el archivo de lista (.m3u8), corregimos los links de los pedacitos de video (.ts)
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
            // Si es un pedacito de video (.ts), lo pasamos tal cual
            res.setHeader('Content-Type', 'video/mp2t');
            res.send(response.data);
        }
    } catch (error) {
        console.error(">>> ERROR EN PROXY: " + error.message);
        res.status(500).end();
    }
});

// Página de inicio para saber si el servidor está vivo
app.get('/', (req, res) => {
    res.send('<h1>Cazador de Señal Activo v1.2</h1><p>Usa: <code>/animal-planet.m3u8</code> para obtener el link.</p>');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log("========================================");
    console.log(`SERVIDOR INICIADO EN PUERTO ${PORT}`);
    console.log("========================================");
});
