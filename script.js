// ==================== KONFIGURASI ====================
const CONFIG = {
    SPREADSHEET_ID: '1zc5lh-8XWEhGYJajqooWGK3Vo89kqob1iAaIdaIiXc0',
    API_KEY: 'AIzaSyAG16CaL_CwY6Hktj6nNrxCoPjYXcJZHcE'
};

// ==================== VARIABEL GLOBAL ====================
let currentUser = null, currentUjian = null, dataSoal = [], indexSoal = 0, jawabanLokal = {}, raguLokal = {},
    timerInterval = null, waktuSelesai = null, waktuMulaiServer = null, minimalMenit = 0, ujianSelesai = false,
    idSesi = null, pelanggaranCount = 0, totalPenalti = 0, tombolSelesaiAktif = false, isFullscreen = false,
    isFrozen = false, freezeInterval = null, pendingUser = null, pendingUjian = null, pendingWaktuSelesai = null,
    pendingSesiAktif = null, isLocked = false, debounceTimer = null, freezeDuration = 30, maxPelanggaran = 5,
    pendingSiswa = null, daftarUjianAktif = [], countdownInterval = null, isDragging = false, screenshotBlocked = false, lastVisibilityChangeTime = 0;

window.currentMatchingSoal = null;
window.currentMatchingJawaban = {};
window.hurufMapping = {};
window.skorPerSoal = {};
window.pelanggaranPerJenis = {};

// ==================== PENGATURAN PELANGGARAN ====================
let pengaturanPelanggaran = {};
let globalFreeze = 30;
let globalMaxPelanggaran = 5;

async function loadPengaturanPelanggaran() {
    try {
        const snap = await window.Firebase.getDocs(window.Firebase.collection(window.db, 'pengaturan'));
        snap.forEach(d => {
            if (d.id === 'pelanggaran') {
                const data = d.data();
                globalFreeze = data.globalFreeze || 30;
                globalMaxPelanggaran = data.globalMax || 5;
                pengaturanPelanggaran = data.items || {};
                freezeDuration = globalFreeze;
                maxPelanggaran = globalMaxPelanggaran;
                console.log('✅ Pengaturan pelanggaran dimuat:', Object.keys(pengaturanPelanggaran).length, 'item');
            }
        });
    } catch(e) { console.warn('⚠️ Gagal load pengaturan:', e); }
}

function isPelanggaranAktif(kode) {
    const p = pengaturanPelanggaran[kode];
    if (!p) return true;
    return p.enabled !== false;
}

function getFreezeDuration(kode) {
    const p = pengaturanPelanggaran[kode];
    if (!p) return globalFreeze;
    return p.freeze !== undefined ? p.freeze : globalFreeze;
}

function getMaxPelanggaran(kode) {
    const p = pengaturanPelanggaran[kode];
    if (!p) return globalMaxPelanggaran;
    return p.max !== undefined ? p.max : globalMaxPelanggaran;
}

// ==================== TOAST & MODAL ====================
function showToast(m, t = "info", d = 2000) { const c = document.getElementById("toastContainer"); if (!c) { alert(m); return; } const e = document.createElement("div"); e.className = `toast ${t}`; e.innerHTML = `<i class="fas fa-${t === "success" ? "check-circle" : t === "error" ? "times-circle" : t === "warning" ? "exclamation-triangle" : "info-circle"}"></i> ${m}`; c.appendChild(e); setTimeout(() => { e.classList.add("hide"); setTimeout(() => e.remove(), 300); }, d); }
function showModal(o) { const v = document.getElementById("modalOverlay"); if (!v) { alert(o.message); return; } const { icon: i, iconType: t = "info", title: d, message: m, showCheckbox: s = false, checkboxLabel: c = "", buttons: b = [], onClose: l } = o; document.getElementById("modalIcon").textContent = i || (t === "success" ? "✅" : t === "error" ? "❌" : t === "warning" ? "⚠️" : "ℹ️"); document.getElementById("modalIcon").className = `modal-icon ${t}`; document.getElementById("modalTitle").textContent = d; document.getElementById("modalMessage").textContent = m; const h = document.getElementById("modalCheckboxContainer"); if (s) { h.style.display = "flex"; document.getElementById("modalCheckboxLabel").textContent = c; document.getElementById("modalCheckbox").checked = false; } else h.style.display = "none"; const u = document.getElementById("modalButtons"); u.innerHTML = ""; b.forEach(n => { const x = document.createElement("button"); x.className = `modal-btn ${n.type || "secondary"}`; x.textContent = n.text; x.onclick = () => { if (n.onClick) n.onClick(s ? document.getElementById("modalCheckbox").checked : false); closeModal(); }; u.appendChild(x); }); v.style.display = "flex"; v.onclick = e => { if (e.target === v) { closeModal(); if (l) l(); } }; }
function closeModal() { document.getElementById("modalOverlay").style.display = "none"; }
function showSuccess(m) { showToast(m, "success"); }
function showError(m) { showToast(m, "error"); }

// ==================== FREEZE ====================
function freezeScreen(d = null) {
    if (isFrozen) return;
    if (d === 0) return;
    isFrozen = true;
    const dur = d !== null ? d : freezeDuration;
    const o = document.getElementById("freezeOverlay"), t = document.getElementById("freezeTimer");
    o.style.display = "flex";
    let r = dur;
    const e = () => {
        const m = Math.floor(r / 60), s = r % 60;
        t.textContent = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
        if (r <= 0) { clearInterval(freezeInterval); o.style.display = "none"; isFrozen = false; showToast("Layar sudah tidak dibekukan!", "warning", 5000); }
        r--;
    };
    e();
    freezeInterval = setInterval(e, 1000);
}

// ==================== HELPER ====================
function togglePassword() { const i = document.getElementById("passwordInput"); if (i) { i.type = i.type === "password" ? "text" : "password"; const icon = document.querySelector('.toggle-password-modern'); if (icon) icon.className = i.type === "password" ? "fas fa-eye toggle-password-modern" : "fas fa-eye-slash toggle-password-modern"; } }
function toggleNav() { if (isFrozen) return; document.getElementById("navPanel").classList.toggle("show"); }
function toggleRagu() { if (isFrozen || !dataSoal[indexSoal]) return; raguLokal[dataSoal[indexSoal].id] = !raguLokal[dataSoal[indexSoal].id]; renderNavigator(); showToast(raguLokal[dataSoal[indexSoal].id] ? "Ditandai ragu" : "Tanda ragu dihapus", "info", 1500); }
function updateNavInfo() { const t = dataSoal.length, j = Object.keys(jawabanLokal).length, e = document.getElementById("navInfo"); if (e) e.textContent = `✅ ${j}/${t} terjawab`; }

function parseTanggal(s) { if (!s) return null; s = String(s).trim(); const p = s.split('-'); if (p.length === 3) return new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2])); const p2 = s.split('/'); if (p2.length === 3) return new Date(parseInt(p2[2]), parseInt(p2[1])-1, parseInt(p2[0])); return null; }
function formatTanggal(d) { if (!d) return ''; const t = new Date(d); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; }
function parseWaktu(w, ref) { if (!w || !w.trim()) return null; const p = String(w).trim().split(':'); if (p.length >= 2) { const t = ref ? new Date(ref) : new Date(); t.setHours(parseInt(p[0]), parseInt(p[1]), 0, 0); return t; } return null; }

// ==================== FULLSCREEN ====================
function enterFullscreen(){const e=document.documentElement;if(e.requestFullscreen){e.requestFullscreen().catch(()=>{isFullscreen=true})}else if(e.webkitRequestFullscreen){e.webkitRequestFullscreen();isFullscreen=true}else{isFullscreen=true;showToast('📱 Mode ujian aktif!','info',2000)}}
function showFullscreenPrompt(){if(/iPhone|iPad|iPod/i.test(navigator.userAgent)){isFullscreen=true;return}showModal({iconType:"info",title:"Mode Fullscreen Wajib",message:"Klik tombol di bawah untuk masuk fullscreen.",buttons:[{text:"Masuk Fullscreen",type:"primary",onClick:()=>enterFullscreen()}],onClose:()=>{if(!isFullscreen)showFullscreenPrompt()}})}
document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement) { if (currentUser && !ujianSelesai) { isFullscreen = false; catatPelanggaran("FULLSCREEN_EXIT", "Keluar fullscreen"); if (isPelanggaranAktif('FULLSCREEN_EXIT')) { const dur = getFreezeDuration('FULLSCREEN_EXIT'); if (dur > 0) freezeScreen(dur); } showFullscreenPrompt(); } } else isFullscreen = true; });

// ==================== ANTI-CURANG ====================
window.addEventListener('pagehide', () => { isLocked = true; });
window.addEventListener('pageshow', () => { if (isLocked) isLocked = false; });

document.addEventListener("contextmenu", e => { e.preventDefault(); if (currentUser && !ujianSelesai && !isFrozen && isPelanggaranAktif('RIGHT_CLICK')) { catatPelanggaran("RIGHT_CLICK", "Klik kanan"); const dur = getFreezeDuration('RIGHT_CLICK'); if (dur > 0) freezeScreen(dur); } });

document.addEventListener('selectstart', e => { if (currentUser && !ujianSelesai) e.preventDefault(); });

document.addEventListener("keydown", e => {
    if (!currentUser || ujianSelesai || isFrozen) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    if (e.key === "F11" || e.key === "Escape" || e.key === "PrintScreen") {
        e.preventDefault();
        if (e.key === "PrintScreen" && isPelanggaranAktif('PRINT_SCREEN')) {
            catatPelanggaran('PRINT_SCREEN', 'Screenshot');
            const dur = getFreezeDuration('PRINT_SCREEN');
            if (dur > 0) freezeScreen(dur);
            showToast('🚫 Screenshot tidak diizinkan!', 'error');
        }
        return false;
    }
    if (e.ctrlKey && ['w','t','n','p','c','v','a','x'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        if (isPelanggaranAktif('KEYBOARD')) {
            catatPelanggaran("KEYBOARD", `Ctrl+${e.key.toUpperCase()}`);
            showToast(`🚫 Ctrl+${e.key.toUpperCase()} dilarang!`, 'warning');
            const dur = getFreezeDuration('KEYBOARD');
            if (dur > 0) freezeScreen(dur);
        }
        return false;
    }
});

window.addEventListener("beforeunload", e => { if (currentUser && !ujianSelesai) { e.preventDefault(); e.returnValue = ""; } });

// ==================== CATAT PELANGGARAN ====================
function catatPelanggaran(j, d) {
    if (!currentUser || ujianSelesai) return;
    if (!isPelanggaranAktif(j)) { console.log(`⏭️ ${j} OFF, skip`); return; }
    
    pelanggaranCount++;
    totalPenalti++;
    if (!window.pelanggaranPerJenis) window.pelanggaranPerJenis = {};
    window.pelanggaranPerJenis[j] = (window.pelanggaranPerJenis[j] || 0) + 1;
    
    const maxJenis = getMaxPelanggaran(j);
    console.warn(`⚠️ ${j} - ${d} (${window.pelanggaranPerJenis[j]}/${maxJenis})`);
    
    if (window.pelanggaranPerJenis[j] >= maxJenis && maxJenis > 0) {
        showModal({
            iconType: 'error',
            title: '⛔ UJIAN DIBATALKAN',
            message: `${d} terdeteksi ${window.pelanggaranPerJenis[j]}x (maks: ${maxJenis}). Ujian diakhiri.`,
            buttons: [{ text: 'OK', type: 'primary', onClick: () => selesaiUjian() }]
        });
    }
}

// ==================== ANTI-FLOATING APPS ====================
let blurCount = 0, lastBlurTime = 0, lastWindowSize = { width: innerWidth, height: innerHeight }, resizeTimer = null, touchStart = 0, touchCount = 0, devtoolsOpen = false, lastVisChange = 0;
const BLUR_COOLDOWN = 5000, DEV_THRESHOLD = 160, VIS_COOLDOWN = 3000;

window.addEventListener('blur', () => {
    if (!currentUser || ujianSelesai || isFrozen || isDragging) return;
    if (!isPelanggaranAktif('WINDOW_BLUR')) return;
    const n = Date.now();
    if (n - lastBlurTime < BLUR_COOLDOWN) return;
    lastBlurTime = n;
    blurCount++;
    catatPelanggaran('WINDOW_BLUR', `Keluar (${blurCount})`);
    const dur = getFreezeDuration('WINDOW_BLUR');
    if (dur > 0) freezeScreen(dur);
    document.getElementById('alertOverlay').style.display = 'block';
    document.getElementById('alertSound').play();
    showToast(`⚠️ Jangan buka aplikasi lain!`, 'error', 5000);
    setTimeout(() => document.getElementById('alertOverlay').style.display = 'none', 3000);
});

window.addEventListener('resize', () => {
    if (!currentUser || ujianSelesai || isFrozen) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        const nW = innerWidth, nH = innerHeight;
        if ((Math.abs(nW - lastWindowSize.width) / lastWindowSize.width > 0.4 || Math.abs(nH - lastWindowSize.height) / lastWindowSize.height > 0.4) && isFullscreen && isPelanggaranAktif('RESIZE_DRASTIC')) {
            catatPelanggaran('RESIZE_DRASTIC', 'Ukuran drastis');
            showToast('⚠️ Perubahan mencurigakan!', 'warning', 4000);
        }
        lastWindowSize = { width: nW, height: nH };
    }, 500);
});

document.addEventListener('mouseleave', e => {
    if (!currentUser || ujianSelesai || isFrozen || isDragging) return;
    if (!isPelanggaranAktif('MOUSE_LEAVE')) return;
    if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= innerWidth || e.clientY >= innerHeight) {
        const n = Date.now();
        if (n - lastBlurTime < BLUR_COOLDOWN) return;
        lastBlurTime = n;
        catatPelanggaran('MOUSE_LEAVE', 'Kursor keluar');
        showToast('👆 Kursor keluar area!', 'warning', 3000);
    }
});

document.addEventListener('touchstart', e => {
    if (!currentUser || ujianSelesai || isFrozen || isDragging) return;
    if (e.touches.length > 3 && isPelanggaranAktif('MULTI_TOUCH')) {
        catatPelanggaran('MULTI_TOUCH', `${e.touches.length} jari`);
        showToast(`⚠️ Multi-touch ${e.touches.length} jari!`, 'warning', 3000);
    }
    const n = Date.now();
    if (n - touchStart < 100) {
        touchCount++;
        if (touchCount > 5 && isPelanggaranAktif('RAPID_TOUCH')) {
            catatPelanggaran('RAPID_TOUCH', 'Sentuhan cepat');
            showToast('⚠️ Terlalu cepat!', 'warning', 3000);
            touchCount = 0;
        }
    } else touchCount = 0;
    touchStart = n;
});

document.addEventListener('touchstart', function(e) {
    if (e.touches.length >= 3 && currentUser && !ujianSelesai && isPelanggaranAktif('SCREENSHOT_DETECT')) {
        e.preventDefault();
        showToast('🚫 Screenshot tidak diizinkan!', 'error', 2000);
    }
}, { passive: false });

function detectDevTools() {
    if (!currentUser || ujianSelesai) return;
    if (!isPelanggaranAktif('DEVTOOLS_OPEN')) return;
    if ((outerWidth - innerWidth > DEV_THRESHOLD || outerHeight - innerHeight > DEV_THRESHOLD) && !devtoolsOpen) {
        devtoolsOpen = true;
        catatPelanggaran('DEVTOOLS_OPEN', 'DevTools');
        const dur = getFreezeDuration('DEVTOOLS_OPEN');
        if (dur > 0) freezeScreen(dur);
        showToast('🚫 Developer tools!', 'error', 5000);
    } else devtoolsOpen = false;
}
setInterval(detectDevTools, 1000);

document.addEventListener('visibilitychange', () => {
    if (document.hidden && currentUser && !ujianSelesai && !isFrozen) {
        const n = Date.now();
        if (n - lastVisChange < VIS_COOLDOWN) return;
        lastVisChange = n;
        if (n - lastVisibilityChangeTime < 500 && isPelanggaranAktif('SCREENSHOT_DETECT')) {
            catatPelanggaran('SCREENSHOT_DETECT', 'Kemungkinan screenshot');
            showToast('🚫 Screenshot terdeteksi!', 'error', 3000);
        }
        lastVisibilityChangeTime = n;
        if (!isLocked && isPelanggaranAktif('TAB_SWITCH')) {
            catatPelanggaran('TAB_SWITCH', 'Pindah tab');
            const dur = getFreezeDuration('TAB_SWITCH');
            if (dur > 0) freezeScreen(dur);
            document.getElementById('alertOverlay').style.display = 'block';
            document.getElementById('alertSound').play();
            showToast('🚫 Jangan pindah tab!', 'error', 4000);
            setTimeout(() => document.getElementById('alertOverlay').style.display = 'none', 3000);
        }
    }
});

// ==================== UPDATE TOMBOL SELESAI (MINIMAL WAKTU AKTIF) ====================
function updateTombolSelesai() {
    const b = document.querySelector(".btn-selesai-modern");
    if (!b || !waktuMulaiServer) return;
    
    // Jika minimalMenit = 0, langsung aktif
    if (minimalMenit <= 0) {
        tombolSelesaiAktif = true;
        b.disabled = false;
        b.innerHTML = `<i class="fas fa-check-circle"></i> SELESAI`;
        return;
    }
    
    // Hitung sisa waktu minimal
    const m = Math.floor((new Date() - waktuMulaiServer) / 60000);
    const r = Math.max(minimalMenit - m, 0);
    
    if (r > 0 && !ujianSelesai) {
        tombolSelesaiAktif = false;
        b.disabled = true;
        b.innerHTML = `<i class="fas fa-lock"></i> (${r}m)`;
    } else {
        tombolSelesaiAktif = true;
        b.disabled = false;
        b.innerHTML = `<i class="fas fa-check-circle"></i> SELESAI`;
    }
}

// ==================== PARSE ISTILAH ====================
function parseIstilahDariPertanyaan(teks) { const map = {}; let t = teks; ['BAGIAN B','Bagian B','Pilihan:','Pilihan Jawaban:','\nA.','\nA)','\nA ','A. if','A. '].forEach(m => { const i = teks.indexOf(m); if (i !== -1) t = teks.substring(0, i); }); const lines = t.split('\n'); let cur = null; lines.forEach(l => { l = l.trim(); if (!l) return; const m = l.match(/^(\d+)\.\s+(.+)$/); if (m) { cur = m[1]; map[cur] = m[2]; } else if (cur) map[cur] += ' ' + l; }); if (!Object.keys(map).length) { const r = /(\d+)\.\s*([^\n]+)/g; let m; while ((m = r.exec(t)) !== null) map[m[1]] = m[2].trim(); } return map; }

// ==================== LOGIN (FIREBASE) ====================
async function handleLogin() {
    const u = document.getElementById("usernameInput").value.trim(), p = document.getElementById("passwordInput").value.trim();
    if (!u) { showError("Isi username!"); return; }
    if (!p) { showError("Isi password!"); return; }
    try {
        await loadPengaturanPelanggaran();
        
        const coll = window.Firebase.collection(window.db, 'cache_siswa');
        const q = window.Firebase.query(coll, window.Firebase.where('username', '==', u));
        const snap = await window.Firebase.getDocs(q);
        if (snap.empty) { showError("Username tidak terdaftar!"); return; }
        const data = snap.docs[0].data();
        if (data.password !== p) { showError("Password salah!"); return; }
        const siswa = { nis: data.nis, nama: data.nama, username: data.username, kelas: data.kelas, jenjang: data.jenjang };
        document.getElementById("passwordInput").value = "";
        pendingSiswa = siswa;
        document.getElementById("loginScreen").style.display = "none";
        document.getElementById("dashboardScreen").style.display = "block";
        document.getElementById("dashboardNama").textContent = siswa.nama;
        document.getElementById("dashboardNIS").textContent = siswa.nis;
        document.getElementById("dashboardKelas").textContent = siswa.kelas;
        await loadUjianAktif(siswa);
    } catch (e) { console.error(e); showError("Gagal terhubung."); }
}

// ==================== CEK RESET (FIREBASE) ====================
async function cekResetUjian(u, m, j) {
    try {
        const snap = await window.Firebase.getDocs(window.Firebase.collection(window.db, 'cache_reset'));
        for (const d of snap.docs) {
            const row = d.data();
            if (row.username === u && (row.mapel === m || row.mapel === '*' || row.mapel === 'SEMUA') && (row.jenis === j || row.jenis === '*' || row.jenis === 'SEMUA') && row.reset === 'YA') return true;
        }
    } catch(e) {}
    return false;
}

// ==================== LOAD UJIAN AKTIF (FIREBASE) ====================
async function loadUjianAktif(siswa) {
    const container = document.getElementById("ujianAktifList");
    try {
        const jadwalColl = window.Firebase.collection(window.db, 'cache_jadwal');
        const jadwalQ = window.Firebase.query(jadwalColl, window.Firebase.where('jenjang', '==', siswa.jenjang), window.Firebase.where('status', '==', 'Aktif'));
        const jadwalSnap = await window.Firebase.getDocs(jadwalQ);
        
        const tokenColl = window.Firebase.collection(window.db, 'cache_token');
        const tokenSnap = await window.Firebase.getDocs(tokenColl);
        const tokenMap = {};
        tokenSnap.forEach(d => { const t = d.data(); tokenMap[t.token] = t; });
        
        const now = new Date(), hariIni = formatTanggal(now);
        daftarUjianAktif = [];
        
        for (const docSnap of jadwalSnap.docs) {
            const row = docSnap.data();
            const tgl = parseTanggal(row.tanggal);
            if (!tgl || formatTanggal(tgl) !== hariIni) continue;
            
            const tokenInfo = tokenMap[row.token];
            const mapelCek = tokenInfo?.mapel || row.mapel;
            const jenisCek = tokenInfo?.jenis || row.jenis;
            
            let statusWaktu = 'tersedia', mulaiObj = null, selesaiObj = null;
            if (row.waktuMulai && row.waktuSelesai) {
                mulaiObj = parseWaktu(row.waktuMulai, tgl);
                selesaiObj = parseWaktu(row.waktuSelesai, tgl);
                if (mulaiObj && selesaiObj) statusWaktu = now < mulaiObj ? 'belum_mulai' : (now > selesaiObj ? 'selesai' : 'berlangsung');
            }
            
            let sudahSelesai = false, nilaiData = null;
            if (!(await cekResetUjian(siswa.username, mapelCek, jenisCek)) && window.db) {
                try {
                    const q = window.Firebase.query(window.Firebase.collection(window.db,'nilai_akhir'), window.Firebase.where('username','==',siswa.username), window.Firebase.where('mapel','==',mapelCek), window.Firebase.where('jenisUjian','==',jenisCek));
                    const snap = await window.Firebase.getDocs(q);
                    if (!snap.empty) { sudahSelesai = true; nilaiData = snap.docs[0].data(); }
                } catch(e) {}
            }
            
            daftarUjianAktif.push({
                token: row.token, mapel: mapelCek, jenis: jenisCek, tanggal: hariIni,
                waktuMulai: row.waktuMulai, waktuSelesai: row.waktuSelesai,
                waktuMulaiObj: mulaiObj, waktuSelesaiObj: selesaiObj,
                minimalMenit: row.minimalMenit || 0,
                statusWaktu, sudahSelesai, nilaiData, password: row.password || ''
            });
        }
        
        daftarUjianAktif.sort((a,b) => a.statusWaktu === 'berlangsung' ? -1 : 1);
        renderUjianList(daftarUjianAktif);
        startCountdown();
    } catch (e) { console.error(e); container.innerHTML = `<div class="ujian-empty"><i class="fas fa-exclamation-triangle"></i><h4>Gagal Memuat</h4></div>`; }
}

// ==================== RENDER UJIAN LIST ====================
function renderUjianList(list) {
    const container = document.getElementById("ujianAktifList");
    if (!list.length) { container.innerHTML = `<div class="ujian-empty"><i class="fas fa-calendar-times"></i><h4>Tidak Ada Ujian</h4></div>`; return; }
    let html = ''; const now = new Date();
    list.forEach((u, i) => {
        let status = '', cls = '', can = false, waktu = '';
        if (u.sudahSelesai) { status = `✅ Selesai | ${u.nilaiData?.totalSkor?.toFixed(0)||'0'}/${u.nilaiData?.totalBobot||'?'}`; cls = 'status-selesai'; waktu = `<span><i class="fas fa-check-circle"></i> Sudah dikerjakan</span>`; }
        else if (!u.waktuMulaiObj) { status = '📋 Tersedia'; cls = 'status-berlangsung'; can = true; waktu = `<span><i class="fas fa-clock"></i> ${u.waktuMulai||'-'} - ${u.waktuSelesai||'-'}</span>`; }
        else if (now < u.waktuMulaiObj) { const d = Math.floor((u.waktuMulaiObj - now) / 1000); status = `⏰ Mulai <span class="countdown" data-i="${i}" data-type="mulai">${String(Math.floor(d/3600)).padStart(2,'0')}:${String(Math.floor((d%3600)/60)).padStart(2,'0')}:${String(d%60).padStart(2,'0')}</span>`; cls = 'status-belum'; waktu = `<span><i class="fas fa-clock"></i> ${u.waktuMulai} - ${u.waktuSelesai}</span>`; }
        else if (now > u.waktuSelesaiObj) { status = '❌ Berakhir'; cls = 'status-selesai'; waktu = `<span><i class="fas fa-clock"></i> ${u.waktuMulai} - ${u.waktuSelesai}</span>`; }
        else { const d = Math.floor((u.waktuSelesaiObj - now) / 1000); status = `🟢 Sisa <span class="countdown" data-i="${i}" data-type="selesai">${String(Math.floor(d/3600)).padStart(2,'0')}:${String(Math.floor((d%3600)/60)).padStart(2,'0')}:${String(d%60).padStart(2,'0')}</span>`; cls = 'status-berlangsung'; can = true; waktu = `<span><i class="fas fa-hourglass-half"></i> ${u.waktuMulai} - ${u.waktuSelesai}</span>`; }
        html += `<div class="ujian-card" data-index="${i}" onclick="pilihUjian('${u.token}')"><div class="ujian-card-header"><div class="ujian-icon"><i class="fas fa-book-open"></i></div><div class="ujian-info"><h4>${u.mapel}</h4><div class="ujian-meta"><span><i class="fas fa-tag"></i> ${u.jenis}</span>${waktu}</div></div></div><div class="ujian-card-footer"><span class="ujian-status ${cls}">${status}</span><button class="btn-mulai" ${can?'':'disabled'} onclick="event.stopPropagation();pilihUjian('${u.token}')"><i class="fas fa-play"></i> Mulai</button></div></div>`;
    });
    container.innerHTML = html;
}

// ==================== COUNTDOWN ====================
function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    function update() {
        const now = new Date(); let render = false;
        daftarUjianAktif.forEach((u, i) => {
            if (u.sudahSelesai || !u.waktuMulaiObj) return;
            const card = document.querySelector(`.ujian-card[data-index="${i}"]`); if (!card) return;
            const span = card.querySelector('.ujian-status'), btn = card.querySelector('.btn-mulai');
            if (now < u.waktuMulaiObj) {
                const d = Math.floor((u.waktuMulaiObj - now) / 1000);
                const c = span?.querySelector('.countdown');
                if (c) c.textContent = `${String(Math.floor(d/3600)).padStart(2,'0')}:${String(Math.floor((d%3600)/60)).padStart(2,'0')}:${String(d%60).padStart(2,'0')}`;
            } else if (now > u.waktuSelesaiObj) {
                span.className = 'ujian-status status-selesai'; span.textContent = '❌ Berakhir';
                if (btn) btn.disabled = true; u.statusWaktu = 'selesai';
            } else {
                const d = Math.floor((u.waktuSelesaiObj - now) / 1000);
                if (u.statusWaktu !== 'berlangsung') { u.statusWaktu = 'berlangsung'; render = true; }
                else { const c = span?.querySelector('.countdown'); if (c) c.textContent = `${String(Math.floor(d/3600)).padStart(2,'0')}:${String(Math.floor((d%3600)/60)).padStart(2,'0')}:${String(d%60).padStart(2,'0')}`; }
            }
        });
        if (render) renderUjianList(daftarUjianAktif);
    }
    countdownInterval = setInterval(update, 1000);
    update();
}

// ==================== PILIH UJIAN ====================
async function pilihUjian(token) {
    const u = daftarUjianAktif.find(x => x.token === token);
    if (!u) { showError("Ujian tidak ditemukan!"); return; }
    if (u.sudahSelesai) { showError("Sudah selesai!"); return; }
    const now = new Date();
    if (u.waktuMulaiObj && now < u.waktuMulaiObj) { showError(`Belum mulai! Sisa ${Math.floor((u.waktuMulaiObj-now)/60000)} menit.`); return; }
    if (u.waktuSelesaiObj && now > u.waktuSelesaiObj) { showError("Sudah berakhir!"); return; }
    if (u.password && u.password.trim() !== '') { const pw = prompt('🔐 Ujian ini terkunci. Masukkan password:'); if (pw !== u.password) { showError('❌ Password salah!'); return; } showToast('✅ Password benar!', 'success', 1000); }
    document.getElementById("tokenInput").value = token;
    await prosesUjianDipilih(u);
}

// ==================== PROSES UJIAN DIPILIH ====================
async function prosesUjianDipilih(u) {
    const siswa = pendingSiswa;
    try {
        const tokenColl = window.Firebase.collection(window.db, 'cache_token');
        const tokenQ = window.Firebase.query(tokenColl, window.Firebase.where('token', '==', u.token), window.Firebase.where('status', '==', 'Aktif'));
        const tokenSnap = await window.Firebase.getDocs(tokenQ);
        if (tokenSnap.empty) { showError("Token tidak valid!"); return; }
        const info = tokenSnap.docs[0].data();
        if (info.jenjang !== siswa.jenjang) { showError(`Untuk kelas ${info.jenjang}!`); return; }
        
        const jadwalColl = window.Firebase.collection(window.db, 'cache_jadwal');
        const jadwalQ = window.Firebase.query(jadwalColl, window.Firebase.where('jenjang', '==', info.jenjang), window.Firebase.where('mapel', '==', info.mapel), window.Firebase.where('jenis', '==', info.jenis), window.Firebase.where('status', '==', 'Aktif'));
        const jadwalSnap = await window.Firebase.getDocs(jadwalQ);
        if (jadwalSnap.empty) { showError("Jadwal tidak ditemukan!"); return; }
        const jadwal = jadwalSnap.docs[0].data();
        
        const now = new Date(), tgl = parseTanggal(jadwal.tanggal);
        if (formatTanggal(tgl) !== formatTanggal(now)) { showError(`Jadwal tanggal ${formatTanggal(tgl)}`); return; }
        if (jadwal.waktuMulai) { const m = parseWaktu(jadwal.waktuMulai, tgl); if (m && now < m) { showError(`Belum mulai!`); return; } }
        if (jadwal.waktuSelesai) { const s = parseWaktu(jadwal.waktuSelesai, tgl); if (s && now > s) { showError(`Sudah berakhir!`); return; } }
        
        const wS = parseWaktu(jadwal.waktuSelesai, tgl) || new Date();
        const jadwalLengkap = { ...info, ...jadwal, min: jadwal.minimalMenit || 0 };
        
        if (!(await cekResetUjian(siswa.username, info.mapel, info.jenis)) && window.db) {
            const sesiSnap = await window.Firebase.getDocs(window.Firebase.query(window.Firebase.collection(window.db,'sesi_ujian'), window.Firebase.where('username','==',siswa.username), window.Firebase.where('status','==','Aktif'), window.Firebase.where('mapel','==',info.mapel)));
            if (!sesiSnap.empty) {
                const sesi = sesiSnap.docs[0].data(); sesi.idSesi = sesiSnap.docs[0].id;
                pendingUser = siswa; pendingUjian = jadwalLengkap; pendingWaktuSelesai = wS; pendingSesiAktif = sesi;
                clearInterval(countdownInterval);
                document.getElementById("dashboardScreen").style.display = "none";
                document.getElementById("resumeScreen").style.display = "block";
                document.getElementById("resumeMapel").textContent = info.mapel;
                document.getElementById("resumeJenis").textContent = info.jenis;
                const sisa = Math.max(Math.floor((wS - now) / 1000), 0);
                document.getElementById("resumeSisaWaktu").textContent = `${Math.floor(sisa/3600)}j ${Math.floor((sisa%3600)/60)}m`;
                return;
            }
            const nilaiSnap = await window.Firebase.getDocs(window.Firebase.query(window.Firebase.collection(window.db,'nilai_akhir'), window.Firebase.where('username','==',siswa.username), window.Firebase.where('mapel','==',info.mapel), window.Firebase.where('jenisUjian','==',info.jenis)));
            if (!nilaiSnap.empty) {
                const n = nilaiSnap.docs[0].data();
                showModal({ iconType: 'warning', title: '⏰ Sudah Selesai', message: `Nilai: ${n.totalSkor}/${n.totalBobot}`, buttons: [{ text: 'OK', type: 'primary' }] });
                return;
            }
        }
        
        clearInterval(countdownInterval);
        document.getElementById("dashboardScreen").style.display = "none";
        document.getElementById("confirmScreen").style.display = "block";
        pendingUser = siswa; pendingUjian = jadwalLengkap; pendingWaktuSelesai = wS;
        document.getElementById("confirmNIS").textContent = siswa.nis;
        document.getElementById("confirmNama").textContent = siswa.nama;
        document.getElementById("confirmKelas").textContent = siswa.kelas;
        document.getElementById("confirmMapel").textContent = `${info.mapel} - ${info.jenis}`;
        document.getElementById("confirmWaktu").textContent = `${jadwal.waktuMulai||'-'} - ${jadwal.waktuSelesai||'-'}`;
    } catch (e) { console.error(e); showError("Gagal memproses."); }
}

// ==================== LOGOUT & CANCEL ====================
function logoutToLogin() { clearInterval(countdownInterval); pendingSiswa = null; document.getElementById("dashboardScreen").style.display = "none"; document.getElementById("loginScreen").style.display = "block"; document.getElementById("usernameInput").value = document.getElementById("passwordInput").value = ""; }
function cancelConfirm() { document.getElementById("confirmScreen").style.display = "none"; document.getElementById("dashboardScreen").style.display = "block"; startCountdown(); }
function cancelResume() { if (!confirm("Hapus sesi?")) return; if (pendingSesiAktif && window.db) window.Firebase.addDoc(window.Firebase.collection(window.db,'sesi_ujian'), {...pendingSesiAktif, status:'Dibatalkan'}); document.getElementById("resumeScreen").style.display = "none"; document.getElementById("confirmScreen").style.display = "block"; document.getElementById("confirmNIS").textContent = pendingUser.nis; document.getElementById("confirmNama").textContent = pendingUser.nama; document.getElementById("confirmKelas").textContent = pendingUser.kelas; document.getElementById("confirmMapel").textContent = `${pendingUjian.mapel} - ${pendingUjian.jenis}`; document.getElementById("confirmWaktu").textContent = `${pendingUjian.waktuMulai||pendingUjian.mulai||'-'} - ${pendingUjian.waktuSelesai||pendingUjian.selesai||'-'}`; }

// ==================== CONTINUE & START EXAM ====================
async function continueExam() {
    if (!pendingUser || !pendingUjian || !pendingSesiAktif) { cancelResume(); return; }
    currentUser = pendingUser; currentUjian = pendingUjian; waktuSelesai = pendingWaktuSelesai;
    minimalMenit = pendingUjian.min || 0; idSesi = pendingSesiAktif.idSesi;
    waktuMulaiServer = new Date(pendingSesiAktif.waktuMulai);
    try { const s = localStorage.getItem(`skor_${idSesi}`); window.skorPerSoal = s ? JSON.parse(s) : {}; } catch (e) { window.skorPerSoal = {}; }
    document.getElementById("resumeScreen").style.display = "none";
    document.getElementById("examScreen").style.display = "block";
    document.getElementById("namaDisplay").innerText = `${currentUser.nama} | ${currentUser.kelas}`;
    document.getElementById("infoDisplay").innerText = `${currentUjian.mapel} - ${currentUjian.jenis}`;
    await ambilSoal(currentUser.jenjang, currentUjian.mapel, currentUjian.jenis);
    await loadJawabanDariFirebase();
    mulaiTimer(); renderNavigator(); showFullscreenPrompt();
    updateTombolSelesai();
    setInterval(updateTombolSelesai, 1000);
}

async function startExam() {
    if (!pendingUser || !pendingUjian) { cancelConfirm(); return; }
    currentUser = pendingUser; currentUjian = pendingUjian; waktuSelesai = pendingWaktuSelesai;
    minimalMenit = pendingUjian.min || 0; waktuMulaiServer = new Date();
    idSesi = 'SES-' + Date.now() + '-' + Math.random().toString(36).substr(2,9);
    window.skorPerSoal = {}; localStorage.removeItem(`skor_${idSesi}`);
    if (window.db) window.Firebase.addDoc(window.Firebase.collection(window.db,'sesi_ujian'), {
        idSesi, username: currentUser.username, nis: currentUser.nis, nama: currentUser.nama,
        jenjang: currentUser.jenjang, kelas: currentUser.kelas, mapel: currentUjian.mapel,
        jenisUjian: currentUjian.jenis, waktuMulai: new Date().toISOString(), status: 'Aktif',
        token: document.getElementById("tokenInput").value, totalSkorSementara: 0
    });
    document.getElementById("confirmScreen").style.display = "none";
    document.getElementById("examScreen").style.display = "block";
    document.getElementById("namaDisplay").innerText = `${currentUser.nama} | ${currentUser.kelas}`;
    document.getElementById("infoDisplay").innerText = `${currentUjian.mapel} - ${currentUjian.jenis}`;
    await ambilSoal(currentUser.jenjang, currentUjian.mapel, currentUjian.jenis);
    mulaiTimer(); renderNavigator(); showFullscreenPrompt();
    updateTombolSelesai();
    setInterval(updateTombolSelesai, 1000);
}

// ==================== LOAD JAWABAN ====================
async function loadJawabanDariFirebase() {
    if (!window.db || !idSesi) return;
    const snap = await window.Firebase.getDocs(window.Firebase.query(window.Firebase.collection(window.db,'jawaban_siswa'), window.Firebase.where('idSesi','==',idSesi)));
    snap.forEach(d => { const data = d.data(); jawabanLokal[data.idSoal] = data.jawaban; });
    if (snap.size) renderNavigator();
}

// ==================== ACAK SOAL ====================
function shuffleArray(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function acakSoalDenganGrup(l) { const g = {}, t = []; l.forEach(s => { if (s.grupSoal) { const n = s.grupSoal.trim(); if (!g[n]) g[n] = []; g[n].push(s); } else t.push(s); }); const b = Object.values(g), semua = [...b, ...t.map(s => [s])], acak = shuffleArray(semua), hasil = []; acak.forEach(block => block.forEach(s => hasil.push(s))); return hasil; }

async function ambilSoal(j, m, js) {
    try {
        const coll = window.Firebase.collection(window.db, 'cache_soal');
        const q = window.Firebase.query(coll, window.Firebase.where('jenjang', '==', String(j)), window.Firebase.where('mapel', '==', String(m)), window.Firebase.where('jenis', '==', String(js)), window.Firebase.where('status', '==', 'Aktif'));
        const snap = await window.Firebase.getDocs(q);
        let mentah = [];
        snap.forEach(d => {
            const row = d.data();
            mentah.push({
                id: row.id, tipe: row.tipe, pertanyaan: row.pertanyaan,
                pilihan: [row.pilihanA, row.pilihanB, row.pilihanC, row.pilihanD, row.pilihanE].filter(p => p),
                kunci: row.kunci, bobot: row.bobot, gambar: row.gambar, grupSoal: row.grupSoal
            });
        });
        if (!mentah.length) { document.getElementById("soalContainer").innerHTML = "<p>Belum ada soal.</p>"; return; }
        dataSoal = acakSoalDenganGrup(mentah);
        renderSoal(0);
    } catch(e) { console.error(e); }
}

// ==================== RENDER NAVIGASI ====================
function renderNavigator() { let h = ""; for (let i = 0; i < dataSoal.length; i++) { const s = dataSoal[i], a = jawabanLokal[s.id] !== undefined, r = raguLokal[s.id], c = i === indexSoal; let cls = a ? "answered" : "unanswered"; if (r && !c) cls = "ragu"; if (c) cls = "current"; h += `<button class="nav-btn-num ${cls}" onclick="goToSoal(${i})">${i+1}</button>`; } document.getElementById("navGrid").innerHTML = h; updateNavInfo(); }
function goToSoal(i) { if (isFrozen) return; renderSoal(i); renderNavigator(); if (window.innerWidth <= 500) document.getElementById("navPanel").classList.remove("show"); }

// ==================== RENDER SOAL ====================
function renderSoal(idx) {
    indexSoal = idx; const s = dataSoal[idx];
    document.getElementById("progressFill").style.width = ((idx+1)/dataSoal.length*100)+"%";
    let h = `<h3>Soal ${idx+1}/${dataSoal.length} [${s.tipe}]</h3>`;
    if (s.gambar) { let u = s.gambar; if (u.match(/^[a-zA-Z0-9_-]{20,}$/)) u = `https://drive.google.com/uc?export=view&id=${u}`; h += `<img src="${u}" style="max-width:100%;">`; }
    h += `<p><strong>${s.pertanyaan}</strong></p>`; const jaw = jawabanLokal[s.id];
    
    if (s.tipe === "PG") {
        s.pilihan.forEach((o,i) => { const hu = String.fromCharCode(65+i); h += `<label class="option-label"><input type="radio" name="jwb" value="${hu}" ${jaw===hu?"checked":""} ${isFrozen?"disabled":""} onchange="autoSavePG('${s.id}')"> ${hu}. ${o}</label>`; });
        h += `<button class="btn-simpan" onclick="simpanPG('${s.id}')" ${isFrozen?"disabled":""}><i class="fas fa-save"></i> Simpan</button>`;
    } else if (s.tipe === "PGK") {
        let a = []; try { a = JSON.parse(jaw||"[]"); } catch(e){}
        s.pilihan.forEach((o,i) => { const hu = String.fromCharCode(65+i); h += `<label class="option-label"><input type="checkbox" name="jwb" value="${hu}" ${a.includes(hu)?"checked":""} ${isFrozen?"disabled":""} onchange="autoSavePGK('${s.id}')"> ${hu}. ${o}</label>`; });
        h += `<button class="btn-simpan" onclick="simpanPGK('${s.id}')" ${isFrozen?"disabled":""}><i class="fas fa-save"></i> Simpan</button>`;
    } else if (s.tipe === "B/S") {
        const p = s.pilihan.filter(x=>x);
        if (!p.length) {
            h += `<div style="background:#f8fafc;padding:16px;border-radius:12px;"><p>${s.pertanyaan}</p><div style="display:flex;gap:24px;"><label><input type="radio" name="bs_single" value="B" ${jaw==='B'?'checked':''} onchange="autoSaveBSSingle('${s.id}')"> ✅ BENAR</label><label><input type="radio" name="bs_single" value="S" ${jaw==='S'?'checked':''} onchange="autoSaveBSSingle('${s.id}')"> ❌ SALAH</label></div></div>`;
            h += `<button class="btn-simpan" onclick="simpanBSSingle('${s.id}')"><i class="fas fa-save"></i> Simpan</button>`;
        } else {
            let a = []; try { a = jaw ? JSON.parse(jaw) : []; } catch(e){ a = (jaw==='B'||jaw==='S') ? [jaw] : []; }
            p.forEach((t,i) => { const jwb = a[i]||''; h += `<div style="background:#f8fafc;padding:14px;border-radius:12px;margin-bottom:10px;"><p>${i+1}. ${t}</p><div style="display:flex;gap:20px;"><label><input type="radio" name="bs_${i}" value="B" ${jwb==='B'?'checked':''} onchange="autoSaveBS('${s.id}',${p.length})"> ✅ Benar</label><label><input type="radio" name="bs_${i}" value="S" ${jwb==='S'?'checked':''} onchange="autoSaveBS('${s.id}',${p.length})"> ❌ Salah</label></div></div>`; });
            h += `<button class="btn-simpan" onclick="simpanBS('${s.id}',${p.length})"><i class="fas fa-save"></i> Simpan</button>`;
        }
    } else if (s.tipe === "Jodoh") {
        let k = {}, o = {}; try { k = JSON.parse(s.kunci); o = jaw ? JSON.parse(jaw) : {}; } catch(e){ o = {}; }
        const istilahMap = parseIstilahDariPertanyaan(s.pertanyaan);
        const istilahList = Object.keys(istilahMap).length > 0 ? Object.keys(istilahMap) : Object.keys(k);
        const opsi = s.pilihan.filter(p => p && p.trim());
        h += `<div style="background:#E8F0FE;padding:12px;border-radius:12px;margin-bottom:16px;"><p style="font-weight:600;color:#1E3A8A;margin:0;"><i class="fas fa-info-circle"></i> Pilih jawaban yang tepat untuk setiap istilah di bawah ini!</p></div>`;
        h += `<div style="display:flex;gap:12px;flex-wrap:wrap;">`;
        h += `<div style="flex:1;min-width:240px;background:#FFF9E6;padding:14px;border-radius:14px;border:2px solid #FDE68A;"><div style="font-weight:700;margin-bottom:10px;color:#92400E;">📋 DAFTAR ISTILAH</div>`;
        istilahList.forEach((key, idx) => {
            const namaIstilah = istilahMap[key] || key;
            const selected = o[key] || '';
            h += `<div style="background:white;padding:12px;border-radius:10px;margin-bottom:8px;border:2px solid #FDE68A;"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span style="font-weight:700;color:#1E3A8A;">${idx+1}.</span><span style="font-weight:600;color:#1E293B;font-size:13px;flex:1;">${namaIstilah}</span><select id="jodoh_${s.id}_${key}" onchange="autoSaveJodohDropdown('${s.id}')" style="padding:8px;border-radius:8px;border:2px solid #E2E8F0;font-size:13px;" ${isFrozen?'disabled':''}><option value="">-- Pilih --</option>`;
            opsi.forEach((opt, i) => { const hu = String.fromCharCode(65 + i); const usedByOther = Object.entries(o).some(([k, v]) => k !== key && v === hu); h += `<option value="${hu}" ${selected === hu ? 'selected' : ''} ${usedByOther ? 'disabled' : ''}>${hu}. ${opt.replace(/^[A-E]\.\s*/, '')}${usedByOther ? ' (dipakai)' : ''}</option>`; });
            h += `</select></div></div>`;
        });
        h += `</div><div style="flex:1;min-width:240px;background:#E8F4FD;padding:14px;border-radius:14px;border:2px solid #BFDBFE;"><div style="font-weight:700;margin-bottom:10px;color:#1E40AF;">📦 DAFTAR JAWABAN</div>`;
        opsi.forEach((opt, i) => { const hu = String.fromCharCode(65 + i); const isUsed = Object.values(o).includes(hu); h += `<div style="background:${isUsed?'#DCFCE7':'white'};padding:10px 12px;border-radius:8px;margin-bottom:6px;border:1px solid ${isUsed?'#BBF7D0':'#E2E8F0'};font-size:13px;"><strong style="color:#1E3A8A;">${hu}.</strong> ${opt.replace(/^[A-E]\.\s*/, '')}${isUsed ? ' ✅' : ''}</div>`; });
        h += `</div></div>`;
        h += `<button class="btn-simpan" onclick="simpanJodohDropdown('${s.id}')" ${isFrozen?'disabled':''} style="margin-top:12px;"><i class="fas fa-save"></i> Simpan Jawaban</button>`;
    } else if (s.tipe === "Isian") {
        h += `<input type="text" id="isian" value="${jaw||''}" placeholder="Ketik jawaban..." style="width:100%;padding:14px;border-radius:16px;border:1px solid #E2E8F0;" ${isFrozen?"disabled":""} oninput="debounceAutoSaveIsian('${s.id}')">`;
        h += `<button class="btn-simpan" onclick="simpanIsian('${s.id}')"><i class="fas fa-save"></i> Simpan</button>`;
    }
    document.getElementById("soalContainer").innerHTML = h;
}

// ==================== SIMPAN JAWABAN ====================
async function simpanJawabanKeFirebase(idSoal, jawaban, skor) {
    if (!window.db || !idSesi) return;
    try {
        const coll = window.Firebase.collection(window.db, 'jawaban_siswa');
        const q = window.Firebase.query(coll, window.Firebase.where('idSesi','==',idSesi), window.Firebase.where('idSoal','==',idSoal));
        const snap = await window.Firebase.getDocs(q);
        if (!snap.empty) await window.Firebase.updateDoc(snap.docs[0].ref, { jawaban, skor, timestamp: new Date().toISOString() });
        else await window.Firebase.addDoc(coll, { idSesi, username: currentUser.username, nis: currentUser.nis, nama: currentUser.nama, jenjang: currentUser.jenjang, kelas: currentUser.kelas, mapel: currentUjian.mapel, jenisUjian: currentUjian.jenis, idSoal, jawaban, skor, timestamp: new Date().toISOString() });
        const skorPerSoal = JSON.parse(localStorage.getItem(`skor_${idSesi}`) || '{}');
        const skorLama = skorPerSoal[idSoal] || 0;
        skorPerSoal[idSoal] = skor;
        localStorage.setItem(`skor_${idSesi}`, JSON.stringify(skorPerSoal));
        const sesiQ = window.Firebase.query(window.Firebase.collection(window.db,'sesi_ujian'), window.Firebase.where('idSesi','==',idSesi));
        const sesiSnap = await window.Firebase.getDocs(sesiQ);
        if (!sesiSnap.empty) { const old = sesiSnap.docs[0].data().totalSkorSementara || 0; await window.Firebase.updateDoc(sesiSnap.docs[0].ref, { totalSkorSementara: old - skorLama + skor }); }
    } catch (e) {}
}

function simpanKeLocalStorage() { if (idSesi) localStorage.setItem(`jawaban_${idSesi}`, JSON.stringify(jawabanLokal)); }

function autoSavePG(id) { const s = document.querySelector('input[name="jwb"]:checked'); if (!s) return; jawabanLokal[id] = s.value; renderNavigator(); simpanKeLocalStorage(); const soal = dataSoal.find(q=>q.id===id); simpanJawabanKeFirebase(id, s.value, s.value === soal.kunci ? soal.bobot : 0); showToast('Tersimpan','success',800); }

// PGK SISTEM 1: ALL-OR-NOTHING
function autoSavePGK(id) {
    const a = Array.from(document.querySelectorAll('input[name="jwb"]:checked')).map(c=>c.value);
    if (!a.length) return;
    jawabanLokal[id] = JSON.stringify(a);
    renderNavigator();
    simpanKeLocalStorage();
    const soal = dataSoal.find(q=>q.id===id);
    let s = 0;
    try {
        const ja = [...a].sort();
        const ka = JSON.parse(soal.kunci).sort();
        if (ja.length === ka.length && ja.every((v, i) => v === ka[i])) s = soal.bobot;
    } catch(e){}
    simpanJawabanKeFirebase(id, JSON.stringify(a), s);
    showToast('Tersimpan','success',800);
}

function autoSaveBSSingle(id) { const s = document.querySelector('input[name="bs_single"]:checked'); if (!s) return; jawabanLokal[id] = s.value; renderNavigator(); simpanKeLocalStorage(); const soal = dataSoal.find(q=>q.id===id); simpanJawabanKeFirebase(id, s.value, s.value === soal.kunci ? soal.bobot : 0); showToast('Tersimpan','success',800); }

function autoSaveBS(id, n) {
    let semua = true;
    for (let i=0; i<n; i++) if (!document.querySelector(`input[name="bs_${i}"]:checked`)) { semua = false; break; }
    if (!semua) return;
    const a = [];
    for (let i=0; i<n; i++) a.push(document.querySelector(`input[name="bs_${i}"]:checked`).value);
    jawabanLokal[id] = JSON.stringify(a);
    renderNavigator();
    simpanKeLocalStorage();
    const soal = dataSoal.find(q=>q.id===id);
    let s = 0;
    try { const k = JSON.parse(soal.kunci); let b = 0; for (let i=0; i<k.length; i++) if (a[i] === k[i]) b++; s = (b/k.length) * soal.bobot; } catch(e){}
    simpanJawabanKeFirebase(id, JSON.stringify(a), s);
    showToast('Tersimpan','success',800);
}

function debounceAutoSaveIsian(id) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        const i = document.getElementById('isian');
        if (!i?.value.trim()) return;
        jawabanLokal[id] = i.value.trim();
        renderNavigator();
        simpanKeLocalStorage();
        const soal = dataSoal.find(q=>q.id===id);
        let s = 0;
        if (soal.kunci.toLowerCase().replace(/\s+/g,' ').trim() === i.value.trim().toLowerCase().replace(/\s+/g,' ').trim()) s = soal.bobot;
        simpanJawabanKeFirebase(id, i.value.trim(), s);
        showToast('Tersimpan','success',800);
    }, 1000);
}

function simpanPG(id) { autoSavePG(id); }
function simpanPGK(id) { autoSavePGK(id); }
function simpanBSSingle(id) { autoSaveBSSingle(id); }
function simpanBS(id, n) { autoSaveBS(id, n); }

function autoSaveJodohDropdown(id) {
    const soal = dataSoal.find(q=>q.id===id);
    if (!soal) return;
    let k = {}; try { k = JSON.parse(soal.kunci); } catch(e){ return; }
    const o = {};
    let allFilled = true;
    const totalKey = Object.keys(k).length;
    Object.keys(k).forEach(key => {
        const select = document.getElementById(`jodoh_${id}_${key}`);
        if (select && select.value) { o[key] = select.value; } else { allFilled = false; }
    });
    if (allFilled) {
        jawabanLokal[id] = JSON.stringify(o);
        renderNavigator();
        simpanKeLocalStorage();
        let benar = 0;
        for (let key in k) if (o[key] === k[key]) benar++;
        simpanJawabanKeFirebase(id, JSON.stringify(o), (benar/totalKey)*soal.bobot);
        showToast(`✅ Tersimpan otomatis! (${benar}/${totalKey} benar)`,'success',1500);
    } else {
        showToast(`📝 ${Object.keys(o).length}/${totalKey} terjawab`,'info',1000);
    }
}

function simpanJodohDropdown(id) {
    const soal = dataSoal.find(q=>q.id===id);
    if (!soal) return;
    let k = {}; try { k = JSON.parse(soal.kunci); } catch(e) { showError('Format kunci salah!'); return; }
    const o = {};
    const totalKey = Object.keys(k).length;
    Object.keys(k).forEach(key => {
        const select = document.getElementById(`jodoh_${id}_${key}`);
        if (select && select.value) o[key] = select.value;
    });
    const filledKey = Object.keys(o).length;
    if (filledKey < totalKey) { showError(`Baru ${filledKey} dari ${totalKey} yang dijawab!`); return; }
    jawabanLokal[id] = JSON.stringify(o);
    renderNavigator();
    simpanKeLocalStorage();
    let benar = 0;
    for (let key in k) if (o[key] === k[key]) benar++;
    simpanJawabanKeFirebase(id, JSON.stringify(o), (benar/totalKey)*soal.bobot);
    showSuccess(`✅ Jawaban tersimpan! (${benar}/${totalKey} benar)`);
}

function simpanIsian(id) {
    const i = document.getElementById('isian');
    if (!i?.value.trim()) { showError("Isi jawaban!"); return; }
    jawabanLokal[id] = i.value.trim();
    renderNavigator();
    simpanKeLocalStorage();
    const soal = dataSoal.find(q=>q.id===id);
    let s = 0;
    if (soal.kunci.toLowerCase().replace(/\s+/g,' ').trim() === i.value.trim().toLowerCase().replace(/\s+/g,' ').trim()) s = soal.bobot;
    simpanJawabanKeFirebase(id, i.value.trim(), s);
    showSuccess("Tersimpan!");
}

function prevSoal() { if (isFrozen) return; if (indexSoal > 0) goToSoal(indexSoal-1); }
function nextSoal() { if (isFrozen) return; if (indexSoal < dataSoal.length-1) goToSoal(indexSoal+1); }

// ==================== TIMER ====================
function mulaiTimer() {
    if (!waktuSelesai) return;
    if (timerInterval) clearInterval(timerInterval);
    function tick() {
        const s = Math.max(waktuSelesai - new Date(), 0), d = Math.floor(s/1000);
        document.getElementById("timerDisplay").innerText = `${Math.floor(d/60)}:${String(d%60).padStart(2,'0')}`;
        if (d === 0 && !ujianSelesai) {
            ujianSelesai = true;
            clearInterval(timerInterval);
            showModal({ iconType: "warning", title: "Waktu Habis", message: "Ujian berakhir.", buttons: [{ text: "OK", type: "primary", onClick: selesaiUjian }] });
        }
    }
    tick();
    timerInterval = setInterval(tick, 1000);
}

// ==================== KONFIRMASI SELESAI (MINIMAL WAKTU AKTIF) ====================
function konfirmasiSelesai() {
    if (isFrozen) return;
    
    // Cek minimal waktu
    if (!tombolSelesaiAktif) {
        const s = Math.max(minimalMenit - Math.floor((new Date() - waktuMulaiServer) / 60000), 0);
        showError(`⏰ Tunggu ${s} menit lagi sebelum bisa selesai!`);
        return;
    }
    
    const b = dataSoal.filter(s => !jawabanLokal[s.id]).length;
    showModal({
        iconType: "warning", title: "Akhiri Ujian?",
        message: `📝 ${dataSoal.length-b} dijawab\n⚠️ ${b} belum`,
        showCheckbox: true, checkboxLabel: "Saya yakin",
        buttons: [
            { text: "Lanjutkan", type: "secondary" },
            { text: "Ya, Selesai", type: "warning", onClick: c => { if (!c) showError("Centang!"); else selesaiUjian(); } }
        ]
    });
}

// ==================== SELESAI UJIAN ====================
async function selesaiUjian() {
    clearInterval(timerInterval);
    if (freezeInterval) clearInterval(freezeInterval);
    ujianSelesai = true;
    
    let totalSkor = 0, totalBobot = 0, jumlahBenar = 0;
    if (window.db && idSesi) {
        try {
            const snap = await window.Firebase.getDocs(window.Firebase.query(window.Firebase.collection(window.db,'sesi_ujian'), window.Firebase.where('idSesi','==',idSesi)));
            if (!snap.empty) totalSkor = snap.docs[0].data().totalSkorSementara || 0;
        } catch(e){}
    }
    
    dataSoal.forEach(s => {
        const b = s.bobot || 1;
        totalBobot += b;
        const j = jawabanLokal[s.id];
        if (!j) return;
        
        if (s.tipe === "PG" && j === s.kunci) { totalSkor += b; jumlahBenar++; }
        else if (s.tipe === "PGK") {
            try {
                const ja = JSON.parse(j).sort();
                const ka = JSON.parse(s.kunci).sort();
                if (ja.length === ka.length && ja.every((v, i) => v === ka[i])) { totalSkor += b; jumlahBenar++; }
            } catch(e){}
        }
        else if (s.tipe === "B/S") {
            try {
                if (j.startsWith('[')) {
                    const ja = JSON.parse(j), ka = JSON.parse(s.kunci);
                    let x = 0;
                    for (let i = 0; i < ka.length; i++) if (ja[i] === ka[i]) x++;
                    totalSkor += (x/ka.length)*b;
                    if (x === ka.length) jumlahBenar++;
                } else { if (j === s.kunci) { totalSkor += b; jumlahBenar++; } }
            } catch(e) { if (j === s.kunci) { totalSkor += b; jumlahBenar++; } }
        }
        else if (s.tipe === "Jodoh") {
            try {
                const jo = JSON.parse(j), ko = JSON.parse(s.kunci);
                let benar = 0;
                const tt = Object.keys(ko).length;
                for (let key in ko) if (jo[key] === ko[key]) benar++;
                totalSkor += (benar/tt)*b;
                if (benar === tt) jumlahBenar++;
            } catch(e){}
        }
        else if (s.tipe === "Isian") {
            const jn = String(j).toLowerCase().replace(/\s+/g,' ').trim();
            const kn = String(s.kunci).toLowerCase().replace(/\s+/g,' ').trim();
            if (kn === '*' || kn === 'semua' || kn === 'all') { totalSkor += b; jumlahBenar++; }
            else if (kn.includes('|')) { if (kn.split('|').map(k=>k.trim()).includes(jn)) { totalSkor += b; jumlahBenar++; } }
            else if (jn === kn) { totalSkor += b; jumlahBenar++; }
        }
    });
    
    if (totalSkor > totalBobot) totalSkor = totalBobot;
    const persen = totalBobot > 0 ? Math.round((totalSkor / totalBobot) * 100) : 0;
    
    if (document.exitFullscreen) document.exitFullscreen();
    document.getElementById("freezeOverlay").style.display = "none";
    
    if (window.db) {
        try {
            const nilaiData = {
                idSesi, username: currentUser?.username || pendingUser?.username, nis: currentUser?.nis || pendingUser?.nis,
                nama: currentUser?.nama || pendingUser?.nama, kelas: currentUser?.kelas || pendingUser?.kelas,
                jenjang: currentUser?.jenjang || pendingUser?.jenjang, mapel: currentUjian?.mapel || pendingUjian?.mapel,
                jenisUjian: currentUjian?.jenis || pendingUjian?.jenis, totalSkor, jumlahBenar,
                jumlahSoal: dataSoal.length, totalBobot, persentase: persen+'%',
                pelanggaran: window.pelanggaranPerJenis || {}, totalPelanggaran: pelanggaranCount,
                timestamp: new Date().toISOString()
            };
            const q = window.Firebase.query(window.Firebase.collection(window.db,'nilai_akhir'), window.Firebase.where('idSesi','==',idSesi));
            const snap = await window.Firebase.getDocs(q);
            if (!snap.empty) await window.Firebase.updateDoc(snap.docs[0].ref, nilaiData);
            else await window.Firebase.addDoc(window.Firebase.collection(window.db,'nilai_akhir'), nilaiData);
        } catch(e){}
        try {
            const q = window.Firebase.query(window.Firebase.collection(window.db,'sesi_ujian'), window.Firebase.where('idSesi','==',idSesi));
            const snap = await window.Firebase.getDocs(q);
            snap.forEach(d => window.Firebase.updateDoc(d.ref, { status: 'Selesai', waktuSelesai: new Date().toISOString() }));
        } catch(e){}
    }
    
    localStorage.removeItem(`jawaban_${idSesi}`);
    localStorage.removeItem(`skor_${idSesi}`);
    
    showModal({ iconType: "success", title: "🎉 Ujian Selesai!", message: "", buttons: [{ text: "Tutup", type: "success", onClick: () => location.reload() }] });
    setTimeout(() => {
        document.querySelector(".modal-message").innerHTML = `<div style="text-align:center;"><div style="font-size:56px;font-weight:800;color:#1E3A8A;">${totalSkor}/${totalBobot}</div><div style="font-size:16px;color:#64748B;margin-top:8px;">Total Skor</div><div style="margin-top:20px;padding-top:16px;border-top:1px solid #E2E8F0;"><span style="font-size:14px;color:#94A3B8;">${persen}%</span></div></div>`;
    }, 50);
}

// ==================== INISIALISASI ====================
document.addEventListener('DOMContentLoaded', () => { const y = document.getElementById('currentYear'); if (y) y.textContent = new Date().getFullYear(); });
