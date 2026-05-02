const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => res.send('<h1>Servidor Nexus V1.5 - Activo</h1>'));

app.get('/player', (req, res) => {
    const urlM3u8 = req.query.url;
    if(!urlM3u8) return res.send("Falta el parámetro ?url=");

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link href="https://vjs.zencdn.net/8.10.0/video-js.css" rel="stylesheet" />
            <style>
                body, html { margin:0; padding:0; width:100%; height:100%; background:#000; overflow:hidden; }
                .video-js { width: 100vw; height: 100vh; }
            </style>
        </head>
        <body>
            <video id="video-nexus" class="video-js vjs-default-skin" controls autoplay preload="auto">
                <source src="${urlM3u8}" type="application/x-mpegURL">
            </video>

            <script src="https://vjs.zencdn.net/8.10.0/video.min.js"></script>
            <script>
                var player = videojs('video-nexus', {
                    fluid: true,
                    html5: {
                        vhs: { overrideNative: true },
                        nativeVideoTracks: false,
                        nativeAudioTracks: false,
                        nativeTextTracks: false
                    }
                });

                player.ready(function() {
                    console.log('Reproductor listo');
                    this.play().catch(function(error) {
                        console.log("El autoplay fue bloqueado, esperando interacción.");
                    });
                });

                player.on('error', function() {
                    var error = player.error();
                    alert("Error de video (" + error.code + "): " + error.message);
                });
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, '0.0.0.0');
