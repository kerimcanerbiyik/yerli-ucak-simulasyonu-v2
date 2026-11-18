const canvas = document.getElementById('oyunEkrani');
const ctx = canvas.getContext('2d');

function boyutlandir() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', boyutlandir);
boyutlandir();

// Uçak Aerodinamik Durumu
const ucak = {
    x: 0,
    z: -400,
    irtifa: 1200,
    hiz: 280,
    gaz: 65,
    yunuslama: 0, // Pitch (derece)
    yatis: 0,     // Roll (derece)
    yon: 0,       // Yaw (radyan)
    dikeyHiz: 0,
    yerde: false
};

function ucagiSifirla() {
    ucak.x = 0;
    ucak.z = -300;
    ucak.irtifa = 1200;
    ucak.hiz = 280;
    ucak.gaz = 65;
    ucak.yunuslama = 0;
    ucak.yatis = 0;
    ucak.yon = 0;
    ucak.yerde = false;
}

// 3D Dağ Zirveleri Üretici (Deterministik ve Telifsiz)
const daglar = [];
for (let i = 0; i < 65; i++) {
    const aci = (i / 65) * Math.PI * 2;
    const mesafe = 4500 + (i % 5) * 1800;
    daglar.push({
        x: Math.cos(aci) * mesafe,
        z: Math.sin(aci) * mesafe + 3000,
        genislik: 900 + (i % 4) * 450,
        yukseklik: 900 + (i % 6) * 420
    });
}

// 3D Kabarık Bulut Kümesi
const bulutlar = [];
for (let i = 0; i < 45; i++) {
    bulutlar.push({
        x: ((i * 977) % 12000) - 6000,
        y: 2200 + (i % 5) * 650,
        z: ((i * 1301) % 14000) - 2000,
        boyut: 350 + (i % 4) * 180
    });
}

// Yeryüzü Tarla ve Arazi Blokları
const araziBloklari = [];
for (let gx = -12; gx <= 12; gx++) {
    for (let gz = -4; gz <= 20; gz++) {
        if (Math.abs(gx) === 0 && gz >= 0 && gz <= 6) continue; // Pist alanı hariç
        const ton = Math.abs((gx * 7 + gz * 13) % 4);
        const renkler = ['#1e3a1e', '#244721', '#2d5224', '#1a331b'];
        araziBloklari.push({
            x: gx * 800,
            z: gz * 800,
            w: 800,
            d: 800,
            renk: renkler[ton]
        });
    }
}

// Klavye Kontrolleri
const tuslar = {};
window.addEventListener('keydown', (e) => {
    tuslar[e.code] = true;
    if (e.code === 'KeyM') sesBaslatDurdur();
    if (e.code === 'KeyR') ucagiSifirla();
});
window.addEventListener('keyup', (e) => tuslar[e.code] = false);

// Web Audio API ile Gerçekçi Jet Türbini ve Rüzgar Sesi
let sesAktif = false;
let audioCtx, motorOsc, altOsc, kazanc;

function sesBaslatDurdur() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        motorOsc = audioCtx.createOscillator();
        altOsc = audioCtx.createOscillator();
        kazanc = audioCtx.createGain();

        motorOsc.type = 'sawtooth';
        altOsc.type = 'triangle';
        motorOsc.frequency.value = 65;
        altOsc.frequency.value = 32;
        kazanc.gain.value = 0.08;

        motorOsc.connect(kazanc);
        altOsc.connect(kazanc);
        kazanc.connect(audioCtx.destination);

        motorOsc.start();
        altOsc.start();
        sesAktif = true;
    } else {
        sesAktif = !sesAktif;
        kazanc.gain.value = sesAktif ? 0.08 : 0;
    }
}

// 3D Dünya Noktasını 2D Ekran Koordinatına Çevir (Kamera Projeksiyonu)
function projeksiyon(wx, wy, wz) {
    const dx = wx - ucak.x;
    const dy = wy - ucak.irtifa;
    const dz = wz - ucak.z;

    // Uçağın pusula yönüne (Yaw) göre döndür
    const cosY = Math.cos(-ucak.yon);
    const sinY = Math.sin(-ucak.yon);
    const rx = dx * cosY - dz * sinY;
    const rz = dx * sinY + dz * cosY;

    if (rz <= 25) return null; // Kameranın arkasında kalan noktalar

    const fov = 680;
    const olcek = fov / rz;
    const sx = rx * olcek;
    const sy = -dy * olcek + (ucak.yunuslama * 11);

    return { x: sx, y: sy, olcek: olcek, z: rz };
}

// Aerodinamik Uçuş Fiziği
function fizikGuncelle() {
    if (tuslar['KeyW'] && ucak.gaz < 100) ucak.gaz += 0.4;
    if (tuslar['KeyS'] && ucak.gaz > 0) ucak.gaz -= 0.4;

    const hedefHiz = 70 + (ucak.gaz * 5.2);
    // Tırmanışta hız düşer, dalışta hız artar
    const egimEtkisi = -Math.sin(ucak.yunuslama * Math.PI / 180) * 1.4;
    ucak.hiz += ((hedefHiz - ucak.hiz) * 0.015) + egimEtkisi;
    if (ucak.hiz < 60) ucak.hiz = 60;

    // Burun kontrolü
    if (tuslar['ArrowUp']) ucak.yunuslama = Math.max(ucak.yunuslama - 1.1, -55);
    else if (tuslar['ArrowDown']) ucak.yunuslama = Math.min(ucak.yunuslama + 1.1, 55);
    else ucak.yunuslama *= 0.96;

    // Kanat yatışı (Roll)
    if (tuslar['ArrowLeft']) ucak.yatis = Math.max(ucak.yatis - 1.8, -75);
    else if (tuslar['ArrowRight']) ucak.yatis = Math.min(ucak.yatis + 1.8, 75);
    else ucak.yatis *= 0.95;

    // Stall (Tutunma Kaybı) kontrolü
    const stall = ucak.hiz < 135 && ucak.irtifa > 20;
    const stallEtiketi = document.getElementById('stallUyari');
    if (stall) {
        stallEtiketi.classList.remove('gizli');
        ucak.yunuslama -= 0.9; // Burun otomatik aşağı düşer
    } else {
        stallEtiketi.classList.add('gizli');
    }

    // Yatış açısına bağlı gerçekçi dönüş (Banking Turn)
    ucak.yon += Math.sin(ucak.yatis * Math.PI / 180) * 0.018;

    // Kaldırma kuvveti ve dikey hız
    const kaldirma = Math.min(ucak.hiz / 220, 1.2);
    const oncekiIrtifa = ucak.irtifa;
    ucak.irtifa += Math.sin(ucak.yunuslama * Math.PI / 180) * (ucak.hiz * 0.06) * kaldirma - (stall ? 4.5 : 0);

    // Piste iniş ve yer teması kontrolü
    const pistUzerinde = Math.abs(ucak.x) < 120 && ucak.z >= 0 && ucak.z <= 4800;
    if (ucak.irtifa <= 15) {
        ucak.irtifa = 15;
        ucak.yerde = true;
        if (ucak.yunuslama < 0) ucak.yunuslama = 0;
        ucak.yatis *= 0.8;
        if (!pistUzerinde && ucak.hiz > 120) {
            ucak.hiz *= 0.96; // Toprak zeminde sürtünme
        }
    } else {
        ucak.yerde = false;
    }

    ucak.dikeyHiz = Math.round((ucak.irtifa - oncekiIrtifa) * 60);

    // İleri hareket
    ucak.z += Math.cos(ucak.yon) * (ucak.hiz * 0.18);
    ucak.x += Math.sin(ucak.yon) * (ucak.hiz * 0.18);

    // Sonsuz bulut döngüsü
    bulutlar.forEach(b => {
        if (b.z - ucak.z < -2000) b.z += 14000;
        if (b.z - ucak.z > 12000) b.z -= 14000;
    });

    // Motor sesi frekansı
    if (sesAktif && motorOsc) {
        motorOsc.frequency.value = 45 + (ucak.hiz * 0.18);
        altOsc.frequency.value = 25 + (ucak.gaz * 0.4);
    }

    // HUD Güncelleme
    const pusulaAci = ((Math.round(ucak.yon * 180 / Math.PI) % 360) + 360) % 360;
    document.getElementById('pusulaDegeri').textContent = `HDG ${String(pusulaAci).padStart(3, '0')}°`;
    document.getElementById('hizDegeri').textContent = Math.round(ucak.hiz);
    document.getElementById('irtifaDegeri').textContent = Math.round(ucak.irtifa);
    document.getElementById('vsiDegeri').textContent = `VS ${ucak.dikeyHiz > 0 ? '+' : ''}${ucak.dikeyHiz}`;
    document.getElementById('gazDegeri').textContent = `%${Math.round(ucak.gaz)}`;
    document.getElementById('yunuslamaDegeri').textContent = `${Math.round(ucak.yunuslama)}°`;
    document.getElementById('yatisDegeri').textContent = `${Math.round(ucak.yatis)}°`;
    document.getElementById('durumDegeri').textContent = ucak.yerde ? (pistUzerinde ? 'PİSTTE' : 'ARAZİDE') : 'UÇUŞTA';
}

// 3D Poligon Çizim Yardımcısı
function poligonCiz(noktalar, dolguRengi, kenarRengi = null) {
    const ekranNoktalari = noktalar.map(n => projeksiyon(n.x, n.y, n.z));
    if (ekranNoktalari.some(p => p === null)) return;

    ctx.beginPath();
    ctx.moveTo(ekranNoktalari[0].x, ekranNoktalari[0].y);
    for (let i = 1; i < ekranNoktalari.length; i++) {
        ctx.lineTo(ekranNoktalari[i].x, ekranNoktalari[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = dolguRengi;
    ctx.fill();

    if (kenarRengi) {
        ctx.strokeStyle = kenarRengi;
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

// Yapay Ufuk Derece Merdiveni (Pitch Ladder)
function yapayUfukCiz(ufukY) {
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.65)';
    ctx.fillStyle = '#00ff66';
    ctx.font = '12px Courier New';
    ctx.lineWidth = 1.5;

    for (let derece = -40; derece <= 40; derece += 10) {
        if (derece === 0) continue;
        const y = ufukY - (derece * 11);
        const genislik = 75;

        ctx.beginPath();
        if (derece < 0) ctx.setLineDash([6, 4]);
        else ctx.setLineDash([]);

        ctx.moveTo(-genislik, y);
        ctx.lineTo(-25, y);
        ctx.moveTo(25, y);
        ctx.lineTo(genislik, y);
        ctx.stroke();

        ctx.fillText(`${derece}`, -genislik - 28, y + 4);
        ctx.fillText(`${derece}`, genislik + 8, y + 4);
    }
    ctx.setLineDash([]);
}

function sahneCiz() {
    const w = canvas.width;
    const h = canvas.height;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-ucak.yatis * Math.PI / 180);

    const ufukY = ucak.yunuslama * 11;

    // Atmosferik Gökyüzü Gradyanı
    const gokyuzu = ctx.createLinearGradient(0, -h * 1.5, 0, ufukY);
    gokyuzu.addColorStop(0, '#09152b');
    gokyuzu.addColorStop(0.55, '#1d4ed8');
    gokyuzu.addColorStop(1, '#93c5fd');
    ctx.fillStyle = gokyuzu;
    ctx.fillRect(-w * 1.5, -h * 2, w * 3, h * 2 + ufukY);

    // Yeryüzü Temel Zemini
    const zemin = ctx.createLinearGradient(0, ufukY, 0, h * 1.5);
    zemin.addColorStop(0, '#475569'); // Ufukta puslu atmosfer
    zemin.addColorStop(0.15, '#1e3a1e');
    zemin.addColorStop(1, '#0f2411');
    ctx.fillStyle = zemin;
    ctx.fillRect(-w * 1.5, ufukY, w * 3, h * 2);

    // 3D Yeryüzü Tarla ve Arazi Dokuları
    araziBloklari.forEach(b => {
        poligonCiz([
            { x: b.x, y: 0, z: b.z },
            { x: b.x + b.w, y: 0, z: b.z },
            { x: b.x + b.w, y: 0, z: b.z + b.d },
            { x: b.x, y: 0, z: b.z + b.d }
        ], b.renk);
    });

    // 3D Havalimanı Asfalt İniş Pisti
    poligonCiz([
        { x: -110, y: 1, z: 0 },
        { x: 110, y: 1, z: 0 },
        { x: 110, y: 1, z: 4800 },
        { x: -110, y: 1, z: 4800 }
    ], '#1e293b', '#94a3b8');

    // Pist Orta Şerit Çizgileri ve Yaklaşma Işıkları
    for (let pz = 200; pz < 4600; pz += 320) {
        poligonCiz([
            { x: -6, y: 2, z: pz },
            { x: 6, y: 2, z: pz },
            { x: 6, y: 2, z: pz + 140 },
            { x: -6, y: 2, z: pz + 140 }
        ], '#f8fafc');

        // Pist Kenar Işıkları
        const solIsik = projeksiyon(-105, 5, pz);
        const sagIsik = projeksiyon(105, 5, pz);
        if (solIsik && sagIsik) {
            ctx.fillStyle = pz < 1000 ? '#ef4444' : '#fde047';
            ctx.beginPath();
            ctx.arc(solIsik.x, solIsik.y, Math.max(1.5, 4 * solIsik.olcek), 0, Math.PI * 2);
            ctx.arc(sagIsik.x, sagIsik.y, Math.max(1.5, 4 * sagIsik.olcek), 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 3D Gölgeli ve Karlı Dağ Zirveleri
    daglar.forEach(d => {
        const solTaban = projeksiyon(d.x - d.genislik, 0, d.z);
        const sagTaban = projeksiyon(d.x + d.genislik, 0, d.z);
        const zirve = projeksiyon(d.x, d.yukseklik, d.z);
        const ortaTaban = projeksiyon(d.x + d.genislik * 0.15, 0, d.z - 80);

        if (solTaban && sagTaban && zirve && ortaTaban) {
            // Güneş alan sol yamaç
            ctx.beginPath();
            ctx.moveTo(solTaban.x, solTaban.y);
            ctx.lineTo(zirve.x, zirve.y);
            ctx.lineTo(ortaTaban.x, ortaTaban.y);
            ctx.closePath();
            ctx.fillStyle = '#334155';
            ctx.fill();

            // Gölgede kalan sağ yamaç
            ctx.beginPath();
            ctx.moveTo(ortaTaban.x, ortaTaban.y);
            ctx.lineTo(zirve.x, zirve.y);
            ctx.lineTo(sagTaban.x, sagTaban.y);
            ctx.closePath();
            ctx.fillStyle = '#1e293b';
            ctx.fill();
        }
    });

    // 3D Kabarık Bulutlar
    bulutlar.forEach(b => {
        const p = projeksiyon(b.x, b.y, b.z);
        if (p) {
            const r = b.boyut * p.olcek;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.arc(p.x - r * 0.7, p.y + r * 0.2, r * 0.75, 0, Math.PI * 2);
            ctx.arc(p.x + r * 0.75, p.y + r * 0.2, r * 0.8, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    // Ufuk Çizgisi ve HUD Pitch Ladder
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-w * 1.5, ufukY);
    ctx.lineTo(w * 1.5, ufukY);
    ctx.stroke();

    yapayUfukCiz(ufukY);

    ctx.restore();
}

function oyunDongusu() {
    fizikGuncelle();
    sahneCiz();
    requestAnimationFrame(oyunDongusu);
}

oyunDongusu();
