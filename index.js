const { chromium } = require('playwright');
const express = require('express');
const app = express();

const PORT = process.env.PORT || 8080;

// ¡OJO! Le agregamos .m3u8 a la ruta para que Web Video Caster lo apruebe sin dudar
app.get('/animal-planet.m3u8', async (req, res) => {
    console.log("Iniciando cacería directa...");
    let browser;
    try {
        browser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'] 
        });
        
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            extraHTTPHeaders: { 'Referer': 'https://www.tvporinternet2.com/' }
        });
        
        const page = await context.newPage();
        let m3u8Url = null;
        let m3u8Text = null;

        // MAGIA: En lugar de descargar por fuera, leemos la respuesta original del navegador
        page.on('response', async response => {
            const url = response.url();
            if (url.includes('.m3u8') && !m3u8Text) {
                try {
                    m3u8Url = url;
                    m3u8Text = await response.text(); // Extraemos el archivo directamente
                } catch (e) {
                    console.log("Ignorando lectura de bloque...");
                }
            }
        });

        await page.goto('https://www.tvporinternet2.com/animal-planet-en-vivo-por-internet.html', { 
            waitUntil: 'domcontentloaded', 
            timeout: 30000 
        }).catch(() => {});

        let espera = 0;
        while (!m3u8Text && espera < 15) {
            await new Promise(r => setTimeout(r, 1000));
            espera++;
        }

        await browser.close();

        if (m3u8Text && m3u8Url) {
            console.log("¡M3U8 extraído desde la memoria con éxito!");
            
            // Extraemos la ruta y los Tokens de seguridad del link
            const urlObj = new URL(m3u8Url);
            const search = urlObj.search; // El token oculto
            const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
            
            // Reconstruimos el archivo pegándole el Token de seguridad a CADA pedacito de video
            let finalM3u8 = m3u8Text.replace(/^(?!#|http)(.+)$/gm, (match, p1) => {
                let chunk = p1.trim();
                if (!chunk.includes('?') && search) chunk += search;
                return baseUrl + chunk;
            });

            // Forzamos la etiqueta para Web Video Caster
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            
            // ¡Le enviamos el archivo procesado de frente, sin intermediarios!
            res.send(finalM3u8);
        } else {
            res.status(404).send("No se encontró la transmisión.");
        }
    } catch (e) {
        if (browser) await browser.close();
        res.status(500).send("Error en servidor.");
    }
});

app.get('/', (req, res) => res.send('Cazador Online.'));
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor en puerto ${PORT}`));

