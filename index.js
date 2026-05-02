const { chromium } = require('playwright');
const express = require('express');
const app = express();

const PORT = process.env.PORT || 8080;

app.get('/animal-planet', async (req, res) => {
    console.log("Iniciando cacería de link...");
    let browser;
    try {
        browser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        
        // Configuramos un perfil que parezca un humano real
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            extraHTTPHeaders: {
                'Referer': 'https://www.tvporinternet2.com/',
                'Origin': 'https://www.tvporinternet2.com'
            }
        });
        
        const page = await context.newPage();
        let m3u8Url = null;

        // Capturamos el tráfico de red
        page.on('request', request => {
            const url = request.url();
            if (url.includes('.m3u8')) {
                m3u8Url = url;
            }
        });

        // Vamos a la web
        await page.goto('https://www.tvporinternet2.com/animal-planet-en-vivo-por-internet.html', { 
            waitUntil: 'networkidle', 
            timeout: 60000 
        });

        // Esperamos un poco a que el reproductor cargue el link
        let espera = 0;
        while (!m3u8Url && espera < 15) {
            await new Promise(r => setTimeout(r, 1000));
            espera++;
        }

        await browser.close();

        if (m3u8Url) {
            // En lugar de redirección simple, enviamos una página con el link
            // Esto ayuda a que el navegador no bloquee la petición de golpe
            res.send(`
                <html>
                    <body style="background: #111; color: #fff; font-family: sans-serif; text-align: center; padding: 50px;">
                        <h1>¡Link Capturado!</h1>
                        <p>Copia este enlace en VLC o tu App de IPTV:</p>
                        <textarea style="width: 80%; height: 100px; word-break: break-all;">${m3u8Url}</textarea>
                        <br><br>
                        <a href="${m3u8Url}" style="color: #00ff00; text-decoration: none; border: 1px solid #00ff00; padding: 10px;">Probar abrir directamente</a>
                    </body>
                </html>
            `);
        } else {
            res.status(404).send("No se encontró el link. El canal podría estar caído.");
        }
    } catch (e) {
        console.error("Error: ", e.message);
        if (browser) await browser.close();
        res.status(500).send("Error en el servidor: " + e.message);
    }
});

app.get('/', (req, res) => res.send('Servidor Cazador Online. Ve a /animal-planet'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor activo en puerto ${PORT}`);
});
