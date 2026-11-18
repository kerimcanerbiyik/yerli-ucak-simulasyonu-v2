import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const PORT = 3000;
const KLASOR = import.meta.dirname;

const mimeTurleri = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8'
};

const sunucu = http.createServer(async (req, res) => {
    try {
        const dosyaAdi = req.url === '/' ? 'index.html' : req.url;
        const dosyaYolu = path.join(KLASOR, dosyaAdi);
        const uzanti = path.extname(dosyaYolu);

        const icerik = await fs.readFile(dosyaYolu);
        res.writeHead(200, { 'Content-Type': mimeTurleri[uzanti] || 'text/plain' });
        res.end(icerik);
    } catch (hata) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Dosya bulunamadi');
    }
});

sunucu.listen(PORT, () => {
    console.log(`Yerli Ucak Simulasyonu v2.0 hazir: http://localhost:${PORT}`);
});
