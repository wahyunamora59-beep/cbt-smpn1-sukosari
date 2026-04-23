// ==================== KONFIGURASI SPREADSHEET ====================
const CONFIG = {
    SPREADSHEET_ID: '1zc5lh-8XWEhGYJajqooWGK3Vo89kqob1iAaIdaIiXc0',
    API_KEY: 'AIzaSyAG16CaL_CwY6Hktj6nNrxCoPjYXcJZHcE'
};

// ==================== VARIABEL GLOBAL ====================
let currentUser = null,
    currentUjian = null,
    dataSoal = [],
    indexSoal = 0,
    jawabanLokal = {},
    raguLokal = {},
    timerInterval = null,
    waktuSelesai = null,
    waktuMulaiServer = null,
    minimalMenit = 45,
    ujianSelesai = false,
    idSesi = null,
    pelanggaranCount = 0,
    totalPenalti = 0,
    tombolSelesaiAktif = false,
    isFullscreen = false,
    isFrozen = false,
    freezeInterval = null,
    pendingUser = null,
    pendingUjian = null,
    pendingWaktuSelesai = null,
    pendingSesiAktif = null,
    isLocked = false,
    debounceTimer = null,
    freezeDuration = 30,
    maxPelanggaran = 5,
    pendingSiswa = null,
    daftarUjianAktif = [],
    countdownInterval = null;

window.currentMatchingSoal = null;
window.currentMatchingJawaban = {};
window.hurufMapping = {};

// ==================== TOAST & MODAL ====================
function showToast(m, t = "info", d = 2000) {
    const c = document.getElementById("toastContainer");
    if (!c) { alert(m); return; }
    const e = document.createElement("div");
    e.className = `toast ${t}`;
    e.innerHTML = `<i class="fas fa-${t === "success" ? "check-circle" : t === "error" ? "times-circle" : t === "warning" ? "exclamation-triangle" : "info-circle"}"></i> ${m}`;
    c.appendChild(e);
    setTimeout(() => { e.classList.add("hide"); setTimeout(() => e.remove(), 300); }, d);
}

function showModal(o) {
    const v = document.getElementById("modalOverlay");
    if (!v) { alert(o.message); return; }
    const { icon: i, iconType: t = "info", title: d, message: m, showCheckbox: s = false, checkboxLabel: c = "", buttons: b = [], onClose: l } = o;
    document.getElementById("modalIcon").textContent = i || (t === "success" ? "✅" : t === "error" ? "❌" : t === "warning" ? "⚠️" : "ℹ️");
    document.getElementById("modalIcon").className = `modal-icon ${t}`;
    document.getElementById("modalTitle").textContent = d;
    document.getElementById("modalMessage").textContent = m;
    const h = document.getElementById("modalCheckboxContainer");
    if (s) {
        h.style.display = "flex";
        document.getElementById("modalCheckboxLabel").textContent = c;
        document.getElementById("modalCheckbox").checked = false;
    } else h.style.display = "none";
    const u = document.getElementById("modalButtons");
    u.innerHTML = "";
    b.forEach(n => {
        const x = document.createElement("button");
        x.className = `modal-btn ${n.type || "secondary"}`;
        x.textContent = n.text;
        x.onclick = () => {
            const C = s ? document.getElementById("modalCheckbox").checked : false;
            if (n.onClick) n.onClick(C);
            closeModal();
        };
        u.appendChild(x);
    });
    v.style.display = "flex";
    v.onclick = e => { if (e.target === v) { closeModal(); if (l) l(); } };
}

function closeModal() { document.getElementById("modalOverlay").style.display = "none"; }
function showSuccess(m) { showToast(m, "success"); }
function showError(m) { showToast(m, "error"); }

// ==================== FREEZE ====================
function freezeScreen(d = null) {
    if (isFrozen) return;
    isFrozen = true;
    const durasi = d !== null ? d : freezeDuration;
    const o = document.getElementById("freezeOverlay"),
        t = document.getElementById("freezeTimer");
    o.style.display = "flex";
    let r = durasi;
    const e = () => {
        const m = Math.floor(r / 60),
            s = r % 60;
        t.textContent = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
        if (r <= 0) {
            clearInterval(freezeInterval);
            o.style.display = "none";
            isFrozen = false;
            showToast("Layar sudah tidak dibekukan!", "warning", 5000);
        }
        r--;
    };
    e();
    freezeInterval = setInterval(e, 1000);
}

// ==================== HELPER ====================
function togglePassword() {
    const i = document.getElementById("passwordInput");  // ✅ GANTI ke passwordInput
    if (i) {
        i.type = i.type === "password" ? "text" : "password";
        
        // Ubah icon mata (opsional, untuk UX lebih baik)
        const icon = document.querySelector('.toggle-password-modern');
        if (icon) {
            icon.className = i.type === "password" 
                ? "fas fa-eye toggle-password-modern" 
                : "fas fa-eye-slash toggle-password-modern";
        }
    }
}

function toggleNav() {
    if (isFrozen) return;
    document.getElementById("navPanel").classList.toggle("show");
}

function toggleRagu() {
    if (isFrozen) return;
    if (!dataSoal[indexSoal]) return;
    raguLokal[dataSoal[indexSoal].id] = !raguLokal[dataSoal[indexSoal].id];
    renderNavigator();
    showToast(raguLokal[dataSoal[indexSoal].id] ? "Ditandai ragu" : "Tanda ragu dihapus", "info", 1500);
}

function updateNavInfo() {
    const t = dataSoal.length,
        j = Object.keys(jawabanLokal).length,
        e = document.getElementById("navInfo");
    if (e) e.textContent = `✅ ${j}/${t} terjawab`;
}

// ==================== HELPER TANGGAL & WAKTU ====================
function parseTanggal(tanggalStr) {
    if (!tanggalStr) return null;
    const clean = String(tanggalStr).trim();
    const parts = clean.split('-');
    if (parts.length === 3) {
        const tahun = parseInt(parts[0]);
        const bulan = parseInt(parts[1]);
        const tanggal = parseInt(parts[2]);
        return new Date(tahun, bulan - 1, tanggal);
    }
    const parts2 = clean.split('/');
    if (parts2.length === 3) {
        const tanggal = parseInt(parts2[0]);
        const bulan = parseInt(parts2[1]);
        const tahun = parseInt(parts2[2]);
        return new Date(tahun, bulan - 1, tanggal);
    }
    return null;
}

function formatTanggal(tanggal) {
    if (!tanggal) return '';
    const t = new Date(tanggal);
    const tahun = t.getFullYear();
    const bulan = String(t.getMonth() + 1).padStart(2, '0');
    const hari = String(t.getDate()).padStart(2, '0');
    return `${tahun}-${bulan}-${hari}`;
}

function parseWaktu(waktuStr, tanggalRef) {
    if (!waktuStr || waktuStr.trim() === '') return null;
    const clean = String(waktuStr).trim();
    const parts = clean.split(':');
    if (parts.length >= 2) {
        const jam = parseInt(parts[0]);
        const menit = parseInt(parts[1]);
        if (tanggalRef) {
            const t = new Date(tanggalRef);
            t.setHours(jam, menit, 0, 0);
            return t;
        } else {
            const t = new Date();
            t.setHours(jam, menit, 0, 0);
            return t;
        }
    }
    return null;
}

// ==================== FULLSCREEN ====================
function enterFullscreen() {
    const e = document.documentElement;
    if (e.requestFullscreen) e.requestFullscreen();
    else if (e.webkitRequestFullscreen) e.webkitRequestFullscreen();
    isFullscreen = true;
}

function showFullscreenPrompt() {
    showModal({
        iconType: "info",
        title: "Mode Fullscreen Wajib",
        message: "Klik tombol di bawah untuk masuk fullscreen.",
        buttons: [{ text: "Masuk Fullscreen", type: "primary", onClick: () => enterFullscreen() }],
        onClose: () => { if (!isFullscreen) showFullscreenPrompt(); }
    });
}

document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
        if (currentUser && !ujianSelesai) {
            isFullscreen = false;
            catatPelanggaran("FULLSCREEN_EXIT", "Keluar fullscreen");
            freezeScreen();
            showFullscreenPrompt();
        }
    } else isFullscreen = true;
});

// ==================== ANTI-CURANG ====================
window.addEventListener('pagehide', () => { isLocked = true; });
window.addEventListener('pageshow', () => { if (isLocked) { isLocked = false; } });

document.addEventListener("contextmenu", e => {
    e.preventDefault();
    if (currentUser && !ujianSelesai && !isFrozen) {
        catatPelanggaran("RIGHT_CLICK", "Klik kanan");
        freezeScreen();
    }
});

document.addEventListener('selectstart', e => {
    if (currentUser && !ujianSelesai) e.preventDefault();
});

document.addEventListener("keydown", e => {
    if (!currentUser || ujianSelesai || isFrozen) return;
    
    if (e.key === "F11" || e.key === "Escape" || e.key === "PrintScreen") {
        e.preventDefault();
        if (e.key === "PrintScreen") {
            catatPelanggaran('PRINT_SCREEN', 'Mencoba screenshot');
            freezeScreen();
            showToast('🚫 Screenshot tidak diizinkan!', 'error');
        }
        return false;
    }
    
    if (e.ctrlKey) {
        const blockedKeys = ['w', 't', 'n', 'p', 'c', 'v', 'a', 'x'];
        if (blockedKeys.includes(e.key.toLowerCase())) {
            e.preventDefault();
            catatPelanggaran("KEYBOARD", `Ctrl+${e.key.toUpperCase()}`);
            showToast(`🚫 Shortcut Ctrl+${e.key.toUpperCase()} tidak diizinkan!`, 'warning');
            freezeScreen();
            return false;
        }
    }
});

window.addEventListener("beforeunload", e => {
    if (currentUser && !ujianSelesai) {
        e.preventDefault();
        e.returnValue = "";
    }
});

function catatPelanggaran(j, d) {
    if (!currentUser || ujianSelesai) return;
    pelanggaranCount++;
    totalPenalti++;
    console.warn(`⚠️ Pelanggaran: ${j} - ${d} (Total: ${pelanggaranCount})`);
}

// ==================== ANTI-FLOATING APPS ====================
let blurCount = 0;
const MAX_BLUR_COUNT = 3;
let lastBlurTime = 0;
const BLUR_COOLDOWN = 5000;

window.addEventListener('blur', () => {
    if (!currentUser || ujianSelesai || isFrozen) return;
    const now = Date.now();
    if (now - lastBlurTime < BLUR_COOLDOWN) return;
    lastBlurTime = now;
    blurCount++;
    catatPelanggaran('WINDOW_BLUR', `Keluar dari jendela ujian (${blurCount}/${MAX_BLUR_COUNT})`);
    freezeScreen(30);
    document.getElementById('alertOverlay').style.display = 'block';
    document.getElementById('alertSound').play();
    showToast(`⚠️ Jangan membuka aplikasi lain! (${blurCount}/${MAX_BLUR_COUNT})`, 'error', 5000);
    if (blurCount >= MAX_BLUR_COUNT) {
        showModal({
            iconType: 'error',
            title: '⛔ UJIAN DIBATALKAN',
            message: `Anda telah ${blurCount} kali membuka aplikasi lain. Ujian akan diakhiri.`,
            buttons: [{ text: 'OK', type: 'primary', onClick: () => selesaiUjian() }]
        });
    }
    setTimeout(() => document.getElementById('alertOverlay').style.display = 'none', 3000);
});

let lastWindowSize = { width: window.innerWidth, height: window.innerHeight };
let resizeCheckTimer = null;

window.addEventListener('resize', () => {
    if (!currentUser || ujianSelesai || isFrozen) return;
    clearTimeout(resizeCheckTimer);
    resizeCheckTimer = setTimeout(() => {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;
        const screenWidth = screen.width;
        const screenHeight = screen.height;
        const widthDiff = Math.abs(newWidth - lastWindowSize.width) / lastWindowSize.width;
        const heightDiff = Math.abs(newHeight - lastWindowSize.height) / lastWindowSize.height;
        const drasticChange = widthDiff > 0.4 || heightDiff > 0.4;
        const aspectRatio = newWidth / newHeight;
        const screenAspectRatio = screenWidth / screenHeight;
        const abnormalAspectRatio = Math.abs(aspectRatio - screenAspectRatio) > 0.5;
        if (drasticChange && isFullscreen) {
            catatPelanggaran('RESIZE_DRASTIC', `Ukuran berubah drastis`);
            showToast('⚠️ Perubahan ukuran jendela mencurigakan!', 'warning', 4000);
        }
        if (abnormalAspectRatio && newWidth < screenWidth * 0.7) {
            catatPelanggaran('SPLIT_SCREEN', 'Mode split screen terdeteksi');
            showToast('⚠️ Hindari mode split screen!', 'warning', 4000);
        }
        lastWindowSize = { width: newWidth, height: newHeight };
    }, 500);
});

document.addEventListener('mouseleave', (e) => {
    if (!currentUser || ujianSelesai || isFrozen) return;
    if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        const now = Date.now();
        if (now - lastBlurTime < BLUR_COOLDOWN) return;
        lastBlurTime = now;
        catatPelanggaran('MOUSE_LEAVE', 'Kursor keluar area ujian');
        showToast('👆 Kursor terdeteksi keluar dari area ujian!', 'warning', 3000);
    }
});

let touchStartTime = 0;
let touchCount = 0;

document.addEventListener('touchstart', (e) => {
    if (!currentUser || ujianSelesai || isFrozen) return;
    const touchPoints = e.touches.length;
    if (touchPoints > 3) {
        catatPelanggaran('MULTI_TOUCH', `Multi-touch ${touchPoints} jari`);
        showToast(`⚠️ Multi-touch ${touchPoints} jari terdeteksi!`, 'warning', 3000);
    }
    const now = Date.now();
    if (now - touchStartTime < 100) {
        touchCount++;
        if (touchCount > 5) {
            catatPelanggaran('RAPID_TOUCH', 'Sentuhan terlalu cepat');
            showToast('⚠️ Sentuhan terlalu cepat!', 'warning', 3000);
            touchCount = 0;
        }
    } else {
        touchCount = 0;
    }
    touchStartTime = now;
});

let devtoolsOpen = false;
const threshold = 160;

function detectDevTools() {
    if (!currentUser || ujianSelesai) return;
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;
    if (widthThreshold || heightThreshold) {
        if (!devtoolsOpen) {
            devtoolsOpen = true;
            catatPelanggaran('DEVTOOLS_OPEN', 'Developer tools terbuka');
            freezeScreen(45);
            showToast('🚫 Developer tools terdeteksi!', 'error', 5000);
        }
    } else {
        devtoolsOpen = false;
    }
}
setInterval(detectDevTools, 1000);

let lastVisibilityChange = 0;
const VISIBILITY_COOLDOWN = 3000;

document.addEventListener('visibilitychange', () => {
    if (document.hidden && currentUser && !ujianSelesai && !isFrozen) {
        const now = Date.now();
        if (now - lastVisibilityChange < VISIBILITY_COOLDOWN) return;
        lastVisibilityChange = now;
        if (!isLocked) {
            catatPelanggaran('TAB_SWITCH', 'Pindah tab/aplikasi');
            freezeScreen(30);
            document.getElementById('alertOverlay').style.display = 'block';
            document.getElementById('alertSound').play();
            showToast('🚫 Jangan pindah tab atau aplikasi lain!', 'error', 4000);
            setTimeout(() => document.getElementById('alertOverlay').style.display = 'none', 3000);
        }
    }
});

// ==================== UPDATE TOMBOL SELESAI ====================
function updateTombolSelesai() {
    const b = document.querySelector(".btn-selesai-modern");
    if (!b || !waktuMulaiServer) return;
    const s = new Date(),
        m = Math.floor((s - waktuMulaiServer) / 60000),
        r = Math.max(minimalMenit - m, 0);
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
function parseIstilahDariPertanyaan(teks) {
    const istilahMap = {};
    let teksBagianA = teks;
    const stopMarkers = ['BAGIAN B', 'Bagian B', 'Pilihan:', 'Pilihan Jawaban:', '\nA.', '\nA)', '\nA ', 'A. if', 'A. '];
    for (let marker of stopMarkers) {
        const idx = teks.indexOf(marker);
        if (idx !== -1) { teksBagianA = teks.substring(0, idx); break; }
    }
    const lines = teksBagianA.split('\n');
    let currentNumber = null;
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        const match = line.match(/^(\d+)\.\s+(.+)$/);
        if (match) {
            currentNumber = match[1];
            istilahMap[currentNumber] = match[2];
        } else if (currentNumber && line) {
            istilahMap[currentNumber] += ' ' + line;
        }
    }
    if (Object.keys(istilahMap).length === 0) {
        const regex = /(\d+)\.\s*([^\n]+)/g;
        let m;
        while ((m = regex.exec(teksBagianA)) !== null) {
            istilahMap[m[1]] = m[2].trim();
        }
    }
    return istilahMap;
}

// ==================== CEK RESET DARI SPREADSHEET ====================
async function cekResetUjian(username, mapel, jenis) {
    try {
        const rR = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/RESET_UJIAN!A:E?key=${CONFIG.API_KEY}`),
            rD = await rR.json(),
            rRows = rD.values || [];
        
        for (let i = 1; i < rRows.length; i++) {
            const row = rRows[i];
            const rowUsername = row[0] || '';
            const rowMapel = row[1] || '';
            const rowJenis = row[2] || '';
            const rowReset = row[3] || '';
            
            const usernameMatch = (rowUsername === username);
            const mapelMatch = (rowMapel === mapel || rowMapel === '*' || rowMapel === 'SEMUA');
            const jenisMatch = (rowJenis === jenis || rowJenis === '*' || rowJenis === 'SEMUA');
            
            if (usernameMatch && mapelMatch && jenisMatch && rowReset === 'YA') {
                console.log('🔄 Reset ditemukan untuk:', username, '-', mapel, '-', jenis);
                return true;
            }
        }
        return false;
    } catch (e) {
        console.error('⚠️ Gagal cek sheet RESET_UJIAN:', e);
        return false;
    }
}

// ==================== LOGIN ====================
async function handleLogin() {
    const u = document.getElementById("usernameInput").value.trim();
    const p = document.getElementById("passwordInput").value.trim();
    
    console.log('🔐 Login attempt:', u);
    
    if (!u) { 
        showError("Isi username!"); 
        return; 
    }
    if (!p) { 
        showError("Isi password!"); 
        return; 
    }
    
    try {
        const sR = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/DATA_SISWA!A:H?key=${CONFIG.API_KEY}`),
            sD = await sR.json(),
            sRows = sD.values || [];
        
        console.log('📊 Data siswa loaded:', sRows.length, 'rows');
        
        let siswa = null;
        
        // Loop untuk mencari username (Kolom C = index 2)
        for (let i = 1; i < sRows.length; i++) {
            const row = sRows[i];
            
            // Pastikan row memiliki cukup kolom
            if (row.length < 6) continue;
            
            const usernameSheet = String(row[2] || '').trim();
            
            console.log(`🔍 Checking row ${i}: "${usernameSheet}" vs "${u}"`);
            
            if (usernameSheet === u) {
                const passwordTersimpan = String(row[3] || '').trim();
                
                console.log('👤 Username ditemukan di row', i);
                console.log('🔑 Password sheet:', passwordTersimpan);
                console.log('🔑 Password input:', p);
                
                if (passwordTersimpan !== p) {
                    showError("Password salah!");
                    return;
                }
                
                siswa = {
                    nis: row[0] || '',
                    nama: row[1] || '',
                    username: row[2] || '',
                    password: row[3] || '',
                    kelas: row[4] || '',
                    jenjang: String(row[5] || '').trim()
                };
                break;
            }
        }
        
        if (!siswa) { 
            console.log('❌ Username tidak ditemukan');
            showError("Username tidak terdaftar!"); 
            return; 
        }
        
        console.log('✅ Login berhasil:', siswa.nama, '| Kelas:', siswa.kelas, '| Jenjang:', siswa.jenjang);
        
        // Bersihkan password input
        document.getElementById("passwordInput").value = "";
        
        // Simpan data siswa untuk dashboard
        pendingSiswa = siswa;
        
        // Sembunyikan login, tampilkan dashboard
        document.getElementById("loginScreen").style.display = "none";
        document.getElementById("dashboardScreen").style.display = "block";
        
        // Tampilkan data siswa di dashboard
        document.getElementById("dashboardNama").textContent = siswa.nama || '-';
        document.getElementById("dashboardNIS").textContent = siswa.nis || '-';
        document.getElementById("dashboardKelas").textContent = siswa.kelas || '-';
        
        // Muat daftar ujian aktif hari ini
        await loadUjianAktif(siswa);
        
    } catch (e) { 
        console.error('❌ Login error:', e); 
        showError("Gagal terhubung ke server."); 
    }
}

// ==================== LOAD UJIAN AKTIF (DASHBOARD) ====================
async function loadUjianAktif(siswa) {
    const container = document.getElementById("ujianAktifList");
    
    try {
        const jR = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/JADWAL_UJIAN!A:J?key=${CONFIG.API_KEY}`),
            jD = await jR.json(),
            jRows = jD.values || [];
        
        const tR = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/TOKEN_UJIAN!A:H?key=${CONFIG.API_KEY}`),
            tD = await tR.json(),
            tRows = tD.values || [];
        
        const sekarang = new Date();
        const hariIni = formatTanggal(sekarang);
        
        daftarUjianAktif = [];
        
        for (let i = 1; i < jRows.length; i++) {
            const row = jRows[i];
            const jenjangJadwal = String(row[1] || '').trim();
            const mapelJadwal = String(row[2] || '').trim();
            const jenisJadwal = String(row[3] || '').trim();
            const tanggalStr = row[4] || '';
            const waktuMulai = row[5] || '';
            const waktuSelesai = row[6] || '';
            const minimalMenit = parseInt(row[7]) || 0;
            const token = row[8] || '';
            const status = row[9] || '';
            
            const tanggalJadwal = parseTanggal(tanggalStr);
            if (!tanggalJadwal) continue;
            
            const tanggalJadwalStr = formatTanggal(tanggalJadwal);
            if (tanggalJadwalStr !== hariIni) continue;
            
            // ✅ FILTER PER JENJANG
            if (jenjangJadwal !== siswa.jenjang) continue;
            
            if (status === 'Aktif') {
                let tokenInfo = null;
                for (let j = 1; j < tRows.length; j++) {
                    if (tRows[j][0] === token) {
                        tokenInfo = { mapel: tRows[j][2], jenis: tRows[j][3] };
                        break;
                    }
                }
                
                let statusWaktu = 'tersedia';
                let waktuMulaiObj = null;
                let waktuSelesaiObj = null;
                
                if (waktuMulai && waktuSelesai) {
                    waktuMulaiObj = parseWaktu(waktuMulai, tanggalJadwal);
                    waktuSelesaiObj = parseWaktu(waktuSelesai, tanggalJadwal);
                    
                    if (waktuMulaiObj && waktuSelesaiObj) {
                        if (sekarang < waktuMulaiObj) {
                            statusWaktu = 'belum_mulai';
                        } else if (sekarang > waktuSelesaiObj) {
                            statusWaktu = 'selesai';
                        } else {
                            statusWaktu = 'berlangsung';
                        }
                    }
                }
                
 let sudahSelesai = false;
 let nilaiData = null;

// ✅ CEK RESET DULU
const mapelCek = tokenInfo?.mapel || mapelJadwal;
const jenisCek = tokenInfo?.jenis || jenisJadwal;
const isReset = await cekResetUjian(siswa.username, mapelCek, jenisCek);

console.log('📊 Dashboard - Cek Reset:', siswa.username, mapelCek, jenisCek, '| Reset:', isReset);

if (isReset) {
    console.log('✅ RESET DIAKTIFKAN - Ujian tersedia!');
    sudahSelesai = false;
} else if (window.db) {
    try {
        const nilaiColl = window.Firebase.collection(window.db, 'nilai_akhir');
        const nilaiQ = window.Firebase.query(nilaiColl,
            window.Firebase.where('username', '==', siswa.username),
            window.Firebase.where('mapel', '==', mapelCek),
            window.Firebase.where('jenisUjian', '==', jenisCek));
        const nilaiSnapshot = await window.Firebase.getDocs(nilaiQ);
        
        if (!nilaiSnapshot.empty) {
            sudahSelesai = true;
            nilaiData = nilaiSnapshot.docs[0].data();
            console.log('📊 Nilai ditemukan, status: Selesai');
        }
    } catch (e) {
        console.error('Gagal cek nilai:', e);
    }
}
                
                daftarUjianAktif.push({
                    token,
                    mapel: tokenInfo?.mapel || mapelJadwal,
                    jenis: tokenInfo?.jenis || jenisJadwal,
                    tanggal: tanggalJadwalStr,
                    waktuMulai,
                    waktuSelesai,
                    waktuMulaiObj,
                    waktuSelesaiObj,
                    minimalMenit,
                    statusWaktu,
                    sudahSelesai,
                    nilaiData
                });
            }
        }
        
        daftarUjianAktif.sort((a, b) => {
            if (a.statusWaktu === 'berlangsung' && b.statusWaktu !== 'berlangsung') return -1;
            if (a.statusWaktu !== 'berlangsung' && b.statusWaktu === 'berlangsung') return 1;
            return 0;
        });
        
        renderUjianList(daftarUjianAktif);
        startCountdown();
        
    } catch (e) {
        console.error('Gagal load ujian aktif:', e);
        container.innerHTML = `<div class="ujian-empty"><i class="fas fa-exclamation-triangle"></i><h4>Gagal Memuat</h4><p>Terjadi kesalahan saat memuat daftar ujian.</p></div>`;
    }
}

// ==================== RENDER UJIAN LIST ====================
function renderUjianList(ujianList) {
    const container = document.getElementById("ujianAktifList");
    
    if (ujianList.length === 0) {
        container.innerHTML = `
            <div class="ujian-empty">
                <i class="fas fa-calendar-times"></i>
                <h4>Tidak Ada Ujian Aktif</h4>
                <p>Tidak ada ujian yang tersedia untuk hari ini.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    const sekarang = new Date();
    
    ujianList.forEach((ujian, index) => {
        let statusLabel = '';
        let statusClass = '';
        let canStart = false;
        let waktuInfo = '';
        
        if (ujian.sudahSelesai) {
            statusLabel = `✅ Selesai | Nilai: ${ujian.nilaiData?.totalSkor?.toFixed(2) || '0'}`;
            statusClass = 'status-selesai';
            canStart = false;
            waktuInfo = `<span><i class="fas fa-check-circle"></i> Sudah dikerjakan</span>`;
        } else if (!ujian.waktuMulaiObj || !ujian.waktuSelesaiObj) {
            statusLabel = `📋 Tersedia`;
            statusClass = 'status-berlangsung';
            canStart = true;
            waktuInfo = `<span><i class="fas fa-clock"></i> ${ujian.waktuMulai || '-'} - ${ujian.waktuSelesai || '-'}</span>`;
        } else if (sekarang < ujian.waktuMulaiObj) {
            const diff = Math.floor((ujian.waktuMulaiObj - sekarang) / 1000);
            const jam = Math.floor(diff / 3600);
            const menit = Math.floor((diff % 3600) / 60);
            const detik = diff % 60;
            statusLabel = `⏰ Mulai dalam <span class="countdown" data-index="${index}" data-type="mulai">${jam.toString().padStart(2,'0')}:${menit.toString().padStart(2,'0')}:${detik.toString().padStart(2,'0')}</span>`;
            statusClass = 'status-belum';
            canStart = false;
            waktuInfo = `<span><i class="fas fa-clock"></i> ${ujian.waktuMulai} - ${ujian.waktuSelesai}</span>`;
        } else if (sekarang > ujian.waktuSelesaiObj) {
            statusLabel = `❌ Sudah Berakhir`;
            statusClass = 'status-selesai';
            canStart = false;
            waktuInfo = `<span><i class="fas fa-clock"></i> ${ujian.waktuMulai} - ${ujian.waktuSelesai}</span>`;
        } else {
            const diff = Math.floor((ujian.waktuSelesaiObj - sekarang) / 1000);
            const jam = Math.floor(diff / 3600);
            const menit = Math.floor((diff % 3600) / 60);
            const detik = diff % 60;
            statusLabel = `🟢 Berlangsung | Sisa <span class="countdown" data-index="${index}" data-type="selesai">${jam.toString().padStart(2,'0')}:${menit.toString().padStart(2,'0')}:${detik.toString().padStart(2,'0')}</span>`;
            statusClass = 'status-berlangsung';
            canStart = true;
            waktuInfo = `<span><i class="fas fa-hourglass-half"></i> ${ujian.waktuMulai} - ${ujian.waktuSelesai}</span>`;
        }
        
        html += `
            <div class="ujian-card" data-index="${index}" onclick="pilihUjian('${ujian.token}')">
                <div class="ujian-card-header">
                    <div class="ujian-icon">
                        <i class="fas fa-book-open"></i>
                    </div>
                    <div class="ujian-info">
                        <h4>${ujian.mapel}</h4>
                        <div class="ujian-meta">
                            <span><i class="fas fa-tag"></i> ${ujian.jenis}</span>
                            ${waktuInfo}
                        </div>
                    </div>
                </div>
                <div class="ujian-card-footer">
                    <span class="ujian-status ${statusClass}">${statusLabel}</span>
                    <button class="btn-mulai" ${canStart ? '' : 'disabled'} onclick="event.stopPropagation(); pilihUjian('${ujian.token}')">
                        <i class="fas fa-play"></i> Mulai
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ==================== COUNTDOWN REAL-TIME ====================
function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    
    countdownInterval = setInterval(() => {
        const sekarang = new Date();
        let perluRender = false;
        
        daftarUjianAktif.forEach((ujian, index) => {
            if (ujian.sudahSelesai) return;
            if (!ujian.waktuMulaiObj || !ujian.waktuSelesaiObj) return;
            
            const card = document.querySelector(`.ujian-card[data-index="${index}"]`);
            if (!card) return;
            
            const statusSpan = card.querySelector('.ujian-status');
            const btnMulai = card.querySelector('.btn-mulai');
            
            if (sekarang < ujian.waktuMulaiObj) {
                const diff = Math.floor((ujian.waktuMulaiObj - sekarang) / 1000);
                const jam = Math.floor(diff / 3600);
                const menit = Math.floor((diff % 3600) / 60);
                const detik = diff % 60;
                
                const countdownSpan = statusSpan?.querySelector('.countdown');
                if (countdownSpan) {
                    countdownSpan.textContent = `${jam.toString().padStart(2,'0')}:${menit.toString().padStart(2,'0')}:${detik.toString().padStart(2,'0')}`;
                }
            } else if (sekarang > ujian.waktuSelesaiObj) {
                statusSpan.className = 'ujian-status status-selesai';
                statusSpan.textContent = '❌ Sudah Berakhir';
                if (btnMulai) btnMulai.disabled = true;
                ujian.statusWaktu = 'selesai';
            } else {
                const diff = Math.floor((ujian.waktuSelesaiObj - sekarang) / 1000);
                const jam = Math.floor(diff / 3600);
                const menit = Math.floor((diff % 3600) / 60);
                const detik = diff % 60;
                
                if (ujian.statusWaktu !== 'berlangsung') {
                    ujian.statusWaktu = 'berlangsung';
                    perluRender = true;
                } else {
                    const countdownSpan = statusSpan?.querySelector('.countdown');
                    if (countdownSpan) {
                        countdownSpan.textContent = `${jam.toString().padStart(2,'0')}:${menit.toString().padStart(2,'0')}:${detik.toString().padStart(2,'0')}`;
                    }
                }
            }
        });
        
        if (perluRender) {
            renderUjianList(daftarUjianAktif);
        }
    }, 1000);
}

// ==================== PILIH UJIAN ====================
async function pilihUjian(token) {
    const ujianDipilih = daftarUjianAktif.find(u => u.token === token);
    
    if (!ujianDipilih) {
        showError("Ujian tidak ditemukan!");
        return;
    }
    
    if (ujianDipilih.sudahSelesai) {
        showError("Anda sudah menyelesaikan ujian ini!");
        return;
    }
    
    const sekarang = new Date();
    
    if (ujianDipilih.waktuMulaiObj && sekarang < ujianDipilih.waktuMulaiObj) {
        const diff = Math.floor((ujianDipilih.waktuMulaiObj - sekarang) / 60000);
        showError(`Ujian belum dimulai! Sisa ${diff} menit.`);
        return;
    }
    
    if (ujianDipilih.waktuSelesaiObj && sekarang > ujianDipilih.waktuSelesaiObj) {
        showError(`Ujian sudah berakhir!`);
        return;
    }
    
    document.getElementById("tokenInput").value = token;
    await prosesUjianDipilih(ujianDipilih);
}

// ==================== PROSES UJIAN DIPILIH ====================
async function prosesUjianDipilih(ujian) {
    const siswa = pendingSiswa;
    const token = ujian.token;
    
    try {
        const tR = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/TOKEN_UJIAN!A:H?key=${CONFIG.API_KEY}`),
            tD = await tR.json(),
            tRows = tD.values || [];
        let tokenInfo = null;
        for (let i = 1; i < tRows.length; i++)
            if (tRows[i][0] === token && tRows[i][5] === "Aktif") {
                tokenInfo = { jenjang: tRows[i][1], mapel: tRows[i][2], jenis: tRows[i][3] };
                break;
            }
        
        if (!tokenInfo) { showError("Token tidak valid!"); return; }
        
        if (tokenInfo.jenjang !== siswa.jenjang) {
            showError(`Ujian ini untuk kelas ${tokenInfo.jenjang}!`);
            return;
        }
        
        const jR = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/JADWAL_UJIAN!A:J?key=${CONFIG.API_KEY}`),
            jD = await jR.json(),
            jRows = jD.values || [];
        let jadwal = null;
        for (let i = 1; i < jRows.length; i++)
            if (String(jRows[i][1]).trim() === String(tokenInfo.jenjang).trim() &&
                String(jRows[i][2]).trim() === String(tokenInfo.mapel).trim() &&
                String(jRows[i][3]).trim() === String(tokenInfo.jenis).trim() &&
                jRows[i][9] === "Aktif") {
                jadwal = { 
                    tanggal: jRows[i][4] || '',
                    mulai: jRows[i][5] || '',
                    selesai: jRows[i][6] || '',
                    min: parseInt(jRows[i][7]) || 0
                };
                break;
            }
        
        if (!jadwal) { showError("Jadwal tidak ditemukan!"); return; }
        
        const sekarang = new Date();
        const hariIni = formatTanggal(sekarang);
        const tanggalJadwal = parseTanggal(jadwal.tanggal);
        const tanggalJadwalStr = formatTanggal(tanggalJadwal);
        
        if (tanggalJadwalStr !== hariIni) {
            showError(`Ujian ini dijadwalkan pada tanggal ${tanggalJadwalStr}`);
            return;
        }
        
        if (jadwal.mulai && jadwal.selesai) {
            const waktuMulai = parseWaktu(jadwal.mulai, tanggalJadwal);
            const waktuSelesai = parseWaktu(jadwal.selesai, tanggalJadwal);
            
            if (waktuMulai && sekarang < waktuMulai) {
                const sisa = Math.floor((waktuMulai - sekarang) / 60000);
                showError(`Ujian belum dimulai! Sisa ${sisa} menit.`);
                return;
            }
            
            if (waktuSelesai && sekarang > waktuSelesai) {
                showError(`Ujian sudah berakhir!`);
                return;
            }
        }
        
        const wS = parseWaktu(jadwal.selesai, tanggalJadwal) || new Date();
        const isReset = await cekResetUjian(siswa.username, tokenInfo.mapel, tokenInfo.jenis);
        
        if (window.db && !isReset) {
            try {
                const sesiColl = window.Firebase.collection(window.db, 'sesi_ujian');
                const sesiQ = window.Firebase.query(sesiColl,
                    window.Firebase.where('username', '==', siswa.username),
                    window.Firebase.where('status', '==', 'Aktif'),
                    window.Firebase.where('mapel', '==', tokenInfo.mapel));
                const sesiSnapshot = await window.Firebase.getDocs(sesiQ);
                
                if (!sesiSnapshot.empty) {
                    const sesiAktif = sesiSnapshot.docs[0].data();
                    sesiAktif.idSesi = sesiSnapshot.docs[0].id;
                    pendingUser = siswa;
                    pendingUjian = { ...tokenInfo, ...jadwal };
                    pendingWaktuSelesai = wS;
                    pendingSesiAktif = sesiAktif;
                    
                    if (countdownInterval) clearInterval(countdownInterval);
                    document.getElementById("dashboardScreen").style.display = "none";
                    document.getElementById("resumeScreen").style.display = "block";
                    document.getElementById("resumeMapel").textContent = tokenInfo.mapel;
                    document.getElementById("resumeJenis").textContent = tokenInfo.jenis;
                    
                    const sisaDetik = Math.max(Math.floor((wS - sekarang) / 1000), 0);
                    const sisaMenit = Math.floor(sisaDetik / 60);
                    document.getElementById("resumeSisaWaktu").textContent = `${Math.floor(sisaMenit / 60)}j ${sisaMenit % 60}m`;
                    return;
                }
                
                const nilaiColl = window.Firebase.collection(window.db, 'nilai_akhir');
                const nilaiQ = window.Firebase.query(nilaiColl,
                    window.Firebase.where('username', '==', siswa.username),
                    window.Firebase.where('mapel', '==', tokenInfo.mapel),
                    window.Firebase.where('jenisUjian', '==', tokenInfo.jenis));
                const nilaiSnapshot = await window.Firebase.getDocs(nilaiQ);
                
                if (!nilaiSnapshot.empty) {
                    const nilaiData = nilaiSnapshot.docs[0].data();
                    showModal({
                        iconType: 'warning',
                        title: '⏰ Ujian Sudah Selesai',
                        message: `Anda sudah menyelesaikan ujian ${tokenInfo.mapel} - ${tokenInfo.jenis}.\n\nNilai Anda: ${nilaiData.totalSkor?.toFixed(2) || '0'}\nBenar: ${nilaiData.jumlahBenar}/${nilaiData.jumlahSoal}\n\nHubungi admin jika ingin mengulang.`,
                        buttons: [{ text: 'OK', type: 'primary', onClick: () => {} }]
                    });
                    return;
                }
            } catch (e) { console.warn('⚠️ Gagal cek Firebase:', e); }
        }
        
        if (countdownInterval) clearInterval(countdownInterval);
        document.getElementById("dashboardScreen").style.display = "none";
        document.getElementById("confirmScreen").style.display = "block";
        
        pendingUser = siswa;
        pendingUjian = { ...tokenInfo, ...jadwal };
        pendingWaktuSelesai = wS;
        
        document.getElementById("confirmNIS").textContent = siswa.nis || '-';
        document.getElementById("confirmNama").textContent = siswa.nama || '-';
        document.getElementById("confirmKelas").textContent = siswa.kelas || '-';
        document.getElementById("confirmMapel").textContent = `${tokenInfo.mapel} - ${tokenInfo.jenis}`;
        document.getElementById("confirmWaktu").textContent = `${jadwal.mulai || '-'} - ${jadwal.selesai || '-'}`;
        
    } catch (e) {
        console.error(e);
        showError("Gagal memproses ujian.");
    }
}

// ==================== LOGOUT ====================
function logoutToLogin() {
    if (countdownInterval) clearInterval(countdownInterval);
    pendingSiswa = null;
    daftarUjianAktif = [];
    document.getElementById("dashboardScreen").style.display = "none";
    document.getElementById("loginScreen").style.display = "block";
    document.getElementById("usernameInput").value = "";
    document.getElementById("passwordInput").value = "";
    showToast("Anda telah logout", "info");
}

// ==================== CANCEL CONFIRM ====================
function cancelConfirm() {
    document.getElementById("confirmScreen").style.display = "none";
    document.getElementById("dashboardScreen").style.display = "block";
    pendingUser = null;
    pendingUjian = null;
    pendingWaktuSelesai = null;
    startCountdown();
    showToast("Silakan pilih ujian yang lain", "info");
}

// ==================== CANCEL RESUME ====================
function cancelResume() {
    if (!confirm("Yakin ingin memulai ujian baru? Sesi sebelumnya akan dihapus.")) return;
    if (pendingSesiAktif && window.db) {
        const coll = window.Firebase.collection(window.db, 'sesi_ujian');
        window.Firebase.addDoc(coll, { ...pendingSesiAktif, status: 'Dibatalkan' });
    }
    document.getElementById("resumeScreen").style.display = "none";
    document.getElementById("confirmScreen").style.display = "block";
    document.getElementById("confirmNIS").textContent = pendingUser.nis || '-';
    document.getElementById("confirmNama").textContent = pendingUser.nama || '-';
    document.getElementById("confirmKelas").textContent = pendingUser.kelas || '-';
    document.getElementById("confirmMapel").textContent = `${pendingUjian.mapel} - ${pendingUjian.jenis}`;
    document.getElementById("confirmWaktu").textContent = `${pendingUjian.mulai} - ${pendingUjian.selesai}`;
}

// ==================== CONTINUE EXAM ====================
async function continueExam() {
    if (!pendingUser || !pendingUjian || !pendingSesiAktif) { showError("Data sesi tidak valid."); cancelResume(); return; }
    currentUser = pendingUser;
    currentUjian = pendingUjian;
    waktuSelesai = pendingWaktuSelesai;
    minimalMenit = pendingUjian.min || 0;
    idSesi = pendingSesiAktif.idSesi;
    waktuMulaiServer = new Date(pendingSesiAktif.waktuMulai);
    totalPenalti = pendingSesiAktif.pelanggaran || 0;
    document.getElementById("resumeScreen").style.display = "none";
    document.getElementById("examScreen").style.display = "block";
    document.getElementById("namaDisplay").innerText = `${currentUser.nama || 'N/A'} | ${currentUser.kelas || 'N/A'}`;
    document.getElementById("infoDisplay").innerText = `${currentUjian.mapel || 'N/A'} - ${currentUjian.jenis || 'N/A'}`;
    await ambilSoal(currentUser.jenjang, currentUjian.mapel, currentUjian.jenis);
    await loadJawabanDariFirebase();
    mulaiTimer();
    renderNavigator();
    showFullscreenPrompt();
    updateTombolSelesai();
    setInterval(updateTombolSelesai, 1000);
    showSuccess(`Selamat datang kembali, ${currentUser.nama || 'Siswa'}!`);
}

// ==================== START EXAM ====================
async function startExam() {
    if (!pendingUser || !pendingUjian) { showError("Data tidak valid."); cancelConfirm(); return; }
    currentUser = pendingUser;
    currentUjian = pendingUjian;
    waktuSelesai = pendingWaktuSelesai;
    minimalMenit = pendingUjian.min || 0;
    waktuMulaiServer = new Date();
    idSesi = 'SES-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    if (window.db) {
        try {
            const coll = window.Firebase.collection(window.db, 'sesi_ujian');
            await window.Firebase.addDoc(coll, {
                idSesi, username: currentUser.username, nis: currentUser.nis, nama: currentUser.nama,
                jenjang: currentUser.jenjang, kelas: currentUser.kelas, mapel: currentUjian.mapel,
                jenisUjian: currentUjian.jenis, waktuMulai: new Date().toISOString(), status: 'Aktif',
                token: document.getElementById("tokenInput").value.trim(),
                totalSkorSementara: 0
            });
        } catch (e) { console.error('Gagal simpan sesi:', e); }
    }
    document.getElementById("confirmScreen").style.display = "none";
    document.getElementById("examScreen").style.display = "block";
    document.getElementById("namaDisplay").innerText = `${currentUser.nama || 'N/A'} | ${currentUser.kelas || 'N/A'}`;
    document.getElementById("infoDisplay").innerText = `${currentUjian.mapel || 'N/A'} - ${currentUjian.jenis || 'N/A'}`;
    await ambilSoal(currentUser.jenjang, currentUjian.mapel, currentUjian.jenis);
    mulaiTimer();
    renderNavigator();
    showFullscreenPrompt();
    updateTombolSelesai();
    setInterval(updateTombolSelesai, 1000);
    showSuccess(`Selamat datang, ${currentUser.nama || 'Siswa'}!`);
}

// ==================== LOAD JAWABAN DARI FIREBASE ====================
async function loadJawabanDariFirebase() {
    if (!window.db || !idSesi || !currentUser) return;
    try {
        const coll = window.Firebase.collection(window.db, 'jawaban_siswa');
        const q = window.Firebase.query(coll, window.Firebase.where('idSesi', '==', idSesi));
        const snapshot = await window.Firebase.getDocs(q);
        let loaded = 0;
        snapshot.forEach(doc => {
            const data = doc.data();
            jawabanLokal[data.idSoal] = data.jawaban;
            loaded++;
        });
        if (loaded > 0) {
            renderNavigator();
            showToast(`${loaded} jawaban dimuat`, 'info', 2000);
        }
    } catch (e) { console.error('Gagal load jawaban:', e); }
}

// ==================== ACAK SOAL ====================
function shuffleArray(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function acakSoalDenganGrup(l) {
    const g = {}, t = [];
    l.forEach(s => {
        if (s.grupSoal && s.grupSoal.trim() !== '') {
            const n = s.grupSoal.trim();
            if (!g[n]) g[n] = [];
            g[n].push(s);
        } else t.push(s);
    });
    const b = [];
    for (let n in g) b.push(g[n]);
    const semua = [...b, ...t.map(s => [s])],
        acak = shuffleArray(semua),
        hasil = [];
    acak.forEach(block => { block.forEach(s => hasil.push(s)); });
    return hasil;
}

async function ambilSoal(j, m, js) {
    try {
        const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/BANK_SOAL!A:P?key=${CONFIG.API_KEY}`),
            d = await r.json(),
            rows = d.values || [];
        let mentah = [];
        for (let i = 1; i < rows.length; i++)
            if (String(rows[i][1]).trim() === String(j).trim() &&
                String(rows[i][2]).trim() === String(m).trim() &&
                String(rows[i][3]).trim() === String(js).trim() &&
                rows[i][13] === "Aktif") {
                mentah.push({
                    id: rows[i][0], tipe: rows[i][4], pertanyaan: rows[i][5],
                    pilihan: [rows[i][6], rows[i][7], rows[i][8], rows[i][9], rows[i][10]].filter(p => p),
                    kunci: rows[i][11], bobot: parseFloat(rows[i][12]) || 1,
                    gambar: rows[i][14] || null, grupSoal: rows[i][15] || ''
                });
            }
        if (mentah.length === 0) {
            document.getElementById("soalContainer").innerHTML = "<p>Belum ada soal.</p>";
            return;
        }
        dataSoal = acakSoalDenganGrup(mentah);
        renderSoal(0);
    } catch (e) { console.error(e); }
}

// ==================== RENDER ====================
function renderNavigator() {
    let h = "";
    for (let i = 0; i < dataSoal.length; i++) {
        const s = dataSoal[i],
            a = jawabanLokal[s.id] !== undefined,
            r = raguLokal[s.id],
            c = i === indexSoal;
        let cls = "unanswered";
        if (a) cls = "answered";
        if (r && !c) cls = "ragu";
        if (c) cls = "current";
        h += `<button class="nav-btn-num ${cls}" onclick="goToSoal(${i})">${i + 1}</button>`;
    }
    document.getElementById("navGrid").innerHTML = h;
    updateNavInfo();
}

function goToSoal(i) {
    if (isFrozen) return;
    renderSoal(i);
    renderNavigator();
    if (window.innerWidth <= 500) document.getElementById("navPanel").classList.remove("show");
}

function renderSoal(idx) {
    indexSoal = idx;
    const s = dataSoal[idx];
    document.getElementById("progressFill").style.width = ((idx + 1) / dataSoal.length * 100) + "%";
    let h = `<h3>Soal ${idx + 1}/${dataSoal.length} [${s.tipe}]</h3>`;
    if (s.gambar) {
        let u = s.gambar;
        if (u.match(/^[a-zA-Z0-9_-]{20,}$/)) u = `https://drive.google.com/uc?export=view&id=${u}`;
        h += `<img src="${u}" style="max-width:100%;">`;
    }
    h += `<p><strong>${s.pertanyaan}</strong></p>`;
    const jaw = jawabanLokal[s.id];

    if (s.tipe === "PG") {
        s.pilihan.forEach((o, i) => {
            const hu = String.fromCharCode(65 + i);
            h += `<label class="option-label"><input type="radio" name="jwb" value="${hu}" ${jaw === hu ? "checked" : ""} ${isFrozen ? "disabled" : ""} onchange="autoSavePG('${s.id}')"> ${hu}. ${o}</label>`;
        });
        h += `<button class="btn-simpan" onclick="simpanPG('${s.id}')" ${isFrozen ? "disabled" : ""}><i class="fas fa-save"></i> Simpan</button>`;
    } else if (s.tipe === "PGK") {
        let a = [];
        try { a = JSON.parse(jaw || "[]"); } catch (e) { }
        s.pilihan.forEach((o, i) => {
            const hu = String.fromCharCode(65 + i);
            h += `<label class="option-label"><input type="checkbox" name="jwb" value="${hu}" ${a.includes(hu) ? "checked" : ""} ${isFrozen ? "disabled" : ""} onchange="autoSavePGK('${s.id}')"> ${hu}. ${o}</label>`;
        });
        h += `<button class="btn-simpan" onclick="simpanPGK('${s.id}')" ${isFrozen ? "disabled" : ""}><i class="fas fa-save"></i> Simpan</button>`;
    } else if (s.tipe === "B/S") {
        const p = s.pilihan.filter(p => p && p.trim() !== '');
        if (p.length === 0) {
            h += `<div style="background:#f8fafc;padding:16px;border-radius:12px;margin-bottom:16px;"><p>${s.pertanyaan}</p><div style="display:flex;gap:24px;"><label><input type="radio" name="bs_single" value="B" ${jaw === 'B' ? 'checked' : ''} onchange="autoSaveBSSingle('${s.id}')"> ✅ BENAR</label><label><input type="radio" name="bs_single" value="S" ${jaw === 'S' ? 'checked' : ''} onchange="autoSaveBSSingle('${s.id}')"> ❌ SALAH</label></div></div>`;
            h += `<button class="btn-simpan" onclick="simpanBSSingle('${s.id}')"><i class="fas fa-save"></i> Simpan</button>`;
        } else {
            let a = [];
            try { if (jaw) a = JSON.parse(jaw); } catch (e) { if (jaw === "B" || jaw === "S") a = [jaw]; }
            p.forEach((t, i) => {
                const jwb = a[i] || '';
                h += `<div style="background:#f8fafc;padding:14px;border-radius:12px;margin-bottom:12px;"><p>${i + 1}. ${t}</p><div style="display:flex;gap:20px;"><label><input type="radio" name="bs_${i}" value="B" ${jwb === 'B' ? 'checked' : ''} onchange="autoSaveBS('${s.id}',${p.length})"> ✅ Benar</label><label><input type="radio" name="bs_${i}" value="S" ${jwb === 'S' ? 'checked' : ''} onchange="autoSaveBS('${s.id}',${p.length})"> ❌ Salah</label></div></div>`;
            });
            h += `<button class="btn-simpan" onclick="simpanBS('${s.id}',${p.length})"><i class="fas fa-save"></i> Simpan</button>`;
        }
    } else if (s.tipe === "Jodoh") {
        let k = {}, o = {};
        try { k = JSON.parse(s.kunci); o = jaw ? JSON.parse(jaw) : {}; } catch (e) { o = {}; }
        window.currentMatchingSoal = s;
        window.currentMatchingJawaban = o;
        const istilahMap = parseIstilahDariPertanyaan(s.pertanyaan);
        const keys = Object.keys(k),
            opsi = s.pilihan.filter(p => p && p.trim()),
            map = {};
        opsi.forEach((opt, i) => { map[String.fromCharCode(65 + i)] = opt; });
        window.hurufMapping = map;
        h += `<div style="margin-bottom:12px;padding:10px;background:#e8f0fe;border-radius:12px;"><p style="font-weight:600;color:#1E3A8A;"><i class="fas fa-info-circle"></i> Tarik jawaban (A,B,C,D) dari KANAN ke istilah di KIRI.</p></div><div class="matching-jodoh-container" style="display:flex;gap:16px;">`;
        h += `<div style="flex:1;background:#FEF3C7;padding:12px;border-radius:16px;"><div style="font-weight:600;margin-bottom:12px;text-align:center;">🎯 ISTILAH</div>`;
        for (let key of keys) {
            const f = o[key] !== undefined,
                huruf = o[key] || '',
                teks = map[huruf] || '',
                istilah = istilahMap[key] || key;
            h += `<div class="matching-target ${f ? 'filled' : 'empty'}" data-key="${key}" id="target_${key}" style="background:white;padding:12px;border-radius:12px;margin-bottom:8px;border:2px dashed #D97706;"><div style="text-align:left;">`;
            if (f) {
                h += `<div style="display:flex;align-items:center;gap:8px;"><span style="background:#22C55E;color:white;padding:4px 10px;border-radius:20px;font-size:12px;">${key}</span><span style="color:#16a34a;font-size:13px;"><i class="fas fa-check-circle"></i> ${huruf}. ${teks}</span></div><p style="margin-top:8px;font-size:14px;color:#1E293B;">${istilah}</p>`;
            } else {
                h += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span style="background:#D97706;color:white;padding:4px 10px;border-radius:20px;font-size:12px;">${key}</span><span style="color:#94a3b8;font-size:12px;"><i class="fas fa-arrow-right"></i> Tarik jawaban</span></div><p style="font-size:14px;color:#1E293B;">${istilah}</p>`;
            }
            h += `</div></div>`;
        }
        h += `</div>`;
        h += `<div style="flex:1;background:#DBEAFE;padding:12px;border-radius:16px;"><div style="font-weight:600;margin-bottom:12px;text-align:center;">📦 JAWABAN</div>`;
        opsi.forEach((opt, i) => {
            const hu = String.fromCharCode(65 + i),
                used = Object.values(o).includes(hu);
            if (!used)
                h += `<div class="matching-item-right" draggable="true" data-huruf="${hu}" id="drag_${hu}" style="background:white;padding:12px;border-radius:12px;margin-bottom:8px;border:2px solid #1E3A8A;cursor:grab;"><strong style="color:#1E3A8A;">${hu}.</strong> ${opt.replace(/^[A-E]\.\s*/, '')}</div>`;
            else
                h += `<div class="matching-item-right paired" draggable="false" id="drag_${hu}" style="background:#DCFCE7;padding:12px;border-radius:12px;margin-bottom:8px;border:2px solid #22C55E;"><strong style="color:#1E3A8A;">${hu}.</strong> ${opt.replace(/^[A-E]\.\s*/, '')}<span style="color:#16a34a;margin-left:8px;"><i class="fas fa-check-circle"></i></span></div>`;
        });
        h += `</div></div><div style="display:flex;gap:12px;margin-top:16px;"><button class="btn-reset-matching" onclick="resetMatching()" style="flex:1;"><i class="fas fa-undo"></i> Reset</button><button class="btn-simpan" onclick="simpanJodohDrag('${s.id}')" style="flex:1;"><i class="fas fa-save"></i> Simpan</button></div>`;
        setTimeout(() => initDragDropJodoh(), 50);
    } else if (s.tipe === "Isian") {
        h += `<input type="text" id="isian" value="${jaw || ''}" placeholder="Ketik jawaban..." style="width:100%;padding:14px;border-radius:16px;border:1px solid #E2E8F0;" ${isFrozen ? "disabled" : ""} oninput="debounceAutoSaveIsian('${s.id}')">`;
        h += `<button class="btn-simpan" onclick="simpanIsian('${s.id}')"><i class="fas fa-save"></i> Simpan</button>`;
    }
    document.getElementById("soalContainer").innerHTML = h;
}

// ==================== SIMPAN JAWABAN KE FIREBASE ====================
async function simpanJawabanKeFirebase(idSoal, jawaban, skor) {
    if (!window.db || !idSesi || !currentUser) return;
    try {
        const coll = window.Firebase.collection(window.db, 'jawaban_siswa');
        await window.Firebase.addDoc(coll, {
            idSesi: idSesi, username: currentUser.username, nis: currentUser.nis, nama: currentUser.nama,
            jenjang: currentUser.jenjang, kelas: currentUser.kelas, mapel: currentUjian.mapel,
            jenisUjian: currentUjian.jenis, idSoal: idSoal, jawaban: jawaban, skor: skor,
            timestamp: new Date().toISOString()
        });

        // ✅ OPTIMASI: Update totalSkorSementara
        const sesiColl = window.Firebase.collection(window.db, 'sesi_ujian');
        const sesiQ = window.Firebase.query(sesiColl, window.Firebase.where('idSesi', '==', idSesi));
        const snapshot = await window.Firebase.getDocs(sesiQ);
        
        if (!snapshot.empty) {
            const sesiDoc = snapshot.docs[0];
            const oldScore = sesiDoc.data().totalSkorSementara || 0;
            await window.Firebase.updateDoc(sesiDoc.ref, { 
                totalSkorSementara: oldScore + skor 
            });
        }

        console.log(`✅ Jawaban ${idSoal} tersimpan | Skor: ${skor}`);
    } catch (e) { console.error('❌ Firebase error:', e); }
}

function simpanKeLocalStorage() { if (idSesi) localStorage.setItem(`jawaban_${idSesi}`, JSON.stringify(jawabanLokal)); }

function autoSavePG(id) {
    const s = document.querySelector('input[name="jwb"]:checked');
    if (!s) return;
    jawabanLokal[id] = s.value;
    renderNavigator();
    simpanKeLocalStorage();
    const soal = dataSoal.find(q => q.id === id);
    simpanJawabanKeFirebase(id, s.value, s.value === soal.kunci ? soal.bobot : 0);
    showToast('Tersimpan', 'success', 800);
}

function autoSavePGK(id) {
    const a = Array.from(document.querySelectorAll('input[name="jwb"]:checked')).map(c => c.value);
    if (a.length === 0) return;
    jawabanLokal[id] = JSON.stringify(a);
    renderNavigator();
    simpanKeLocalStorage();
    const soal = dataSoal.find(q => q.id === id);
    let s = 0;
    try { if (JSON.stringify(a.sort()) === JSON.stringify(JSON.parse(soal.kunci).sort())) s = soal.bobot; } catch (e) { }
    simpanJawabanKeFirebase(id, JSON.stringify(a), s);
    showToast('Tersimpan', 'success', 800);
}

function autoSaveBSSingle(id) {
    const s = document.querySelector('input[name="bs_single"]:checked');
    if (!s) return;
    jawabanLokal[id] = s.value;
    renderNavigator();
    simpanKeLocalStorage();
    const soal = dataSoal.find(q => q.id === id);
    simpanJawabanKeFirebase(id, s.value, s.value === soal.kunci ? soal.bobot : 0);
    showToast('Tersimpan', 'success', 800);
}

function autoSaveBS(id, n) {
    let semua = true;
    for (let i = 0; i < n; i++)
        if (!document.querySelector(`input[name="bs_${i}"]:checked`)) { semua = false; break; }
    if (!semua) return;
    const a = [];
    for (let i = 0; i < n; i++) a.push(document.querySelector(`input[name="bs_${i}"]:checked`).value);
    jawabanLokal[id] = JSON.stringify(a);
    renderNavigator();
    simpanKeLocalStorage();
    const soal = dataSoal.find(q => q.id === id);
    let s = 0;
    try {
        const k = JSON.parse(soal.kunci);
        let b = 0;
        for (let i = 0; i < k.length; i++) if (a[i] === k[i]) b++;
        s = (b / k.length) * soal.bobot;
    } catch (e) { }
    simpanJawabanKeFirebase(id, JSON.stringify(a), s);
    showToast('Tersimpan', 'success', 800);
}

function debounceAutoSaveIsian(id) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        const i = document.getElementById('isian');
        if (!i || !i.value.trim()) return;
        jawabanLokal[id] = i.value.trim();
        renderNavigator();
        simpanKeLocalStorage();
        const soal = dataSoal.find(q => q.id === id);
        let s = 0;
        if (soal.kunci.toLowerCase().replace(/\s+/g, ' ').trim() === i.value.trim().toLowerCase().replace(/\s+/g, ' ').trim())
            s = soal.bobot;
        simpanJawabanKeFirebase(id, i.value.trim(), s);
        showToast('Tersimpan', 'success', 800);
    }, 1000);
}

function simpanPG(id) { autoSavePG(id); }
function simpanPGK(id) { autoSavePGK(id); }
function simpanBSSingle(id) { autoSaveBSSingle(id); }
function simpanBS(id, n) { autoSaveBS(id, n); }

function simpanJodohDrag(id) {
    const o = window.currentMatchingJawaban || {},
        soal = window.currentMatchingSoal;
    if (!soal) { showError('Data soal tidak valid!'); return; }
    let k = {};
    try { k = JSON.parse(soal.kunci); } catch (e) { showError('Format kunci salah!'); return; }
    const totalKey = Object.keys(k).length,
        filledKey = Object.keys(o).length;
    if (filledKey < totalKey) { showError(`Baru ${filledKey} dari ${totalKey} yang dipasangkan!`); return; }
    let benar = 0;
    for (let key in k) if (o[key] === k[key]) benar++;
    jawabanLokal[id] = JSON.stringify(o);
    renderNavigator();
    simpanKeLocalStorage();
    const s = (benar / totalKey) * soal.bobot;
    simpanJawabanKeFirebase(id, JSON.stringify(o), s);
    showSuccess(`Jawaban tersimpan! (${benar}/${totalKey} benar)`);
}

function simpanIsian(id) {
    const i = document.getElementById('isian');
    if (!i || !i.value.trim()) { showError("Isi jawaban!"); return; }
    jawabanLokal[id] = i.value.trim();
    renderNavigator();
    simpanKeLocalStorage();
    const soal = dataSoal.find(q => q.id === id);
    let s = 0;
    if (soal.kunci.toLowerCase().replace(/\s+/g, ' ').trim() === i.value.trim().toLowerCase().replace(/\s+/g, ' ').trim())
        s = soal.bobot;
    simpanJawabanKeFirebase(id, i.value.trim(), s);
    showSuccess("Jawaban tersimpan!");
}

function prevSoal() { if (isFrozen) return; if (indexSoal > 0) goToSoal(indexSoal - 1); }
function nextSoal() { if (isFrozen) return; if (indexSoal < dataSoal.length - 1) goToSoal(indexSoal + 1); }

// ==================== DRAG & DROP ====================
function initDragDropJodoh() {
    document.querySelectorAll('.matching-item-right[draggable="true"]').forEach(i => {
        i.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', e.target.dataset.huruf); });
    });
    document.querySelectorAll('.matching-target').forEach(t => {
        t.addEventListener('dragover', e => e.preventDefault());
        t.addEventListener('drop', e => {
            e.preventDefault();
            const tk = t.dataset.key,
                dk = e.dataTransfer.getData('text/plain');
            if (!tk || !dk) return;
            if (!window.currentMatchingJawaban) window.currentMatchingJawaban = {};
            if (window.currentMatchingJawaban[tk]) { showError('Sudah terisi!'); return; }
            if (Object.values(window.currentMatchingJawaban).includes(dk)) { showError('Jawaban sudah dipakai!'); return; }
            window.currentMatchingJawaban[tk] = dk;
            updateMatchingUIJodoh();
            const soal = window.currentMatchingSoal;
            if (soal) {
                let k = {};
                try { k = JSON.parse(soal.kunci); } catch (e) { }
                const totalKey = Object.keys(k).length,
                    filledKey = Object.keys(window.currentMatchingJawaban).length;
                if (filledKey === totalKey) {
                    jawabanLokal[soal.id] = JSON.stringify(window.currentMatchingJawaban);
                    renderNavigator();
                    simpanKeLocalStorage();
                    const s = (filledKey / totalKey) * soal.bobot;
                    simpanJawabanKeFirebase(soal.id, JSON.stringify(window.currentMatchingJawaban), s);
                    showSuccess(`✅ Semua terpasangkan! (${filledKey}/${totalKey})`);
                } else {
                    showSuccess(`Dipasangkan! (${filledKey}/${totalKey})`);
                }
            }
        });
    });
}

function updateMatchingUIJodoh() {
    const s = window.currentMatchingSoal,
        o = window.currentMatchingJawaban || {},
        map = window.hurufMapping || {};
    let k = {};
    try { k = JSON.parse(s.kunci); } catch (e) { }
    const istilahMap = parseIstilahDariPertanyaan(s.pertanyaan);
    const keys = Object.keys(k);
    for (let key of keys) {
        const t = document.getElementById(`target_${key}`);
        if (t) {
            const f = o[key] !== undefined,
                h = o[key] || '',
                teks = map[h] || '',
                istilah = istilahMap[key] || key;
            t.className = `matching-target ${f ? 'filled' : 'empty'}`;
            t.style.background = f ? '#DCFCE7' : 'white';
            t.style.border = f ? '2px solid #22C55E' : '2px dashed #D97706';
            t.innerHTML = `<div style="text-align:left;">`;
            if (f) {
                t.innerHTML += `<div style="display:flex;align-items:center;gap:8px;"><span style="background:#22C55E;color:white;padding:4px 10px;border-radius:20px;font-size:12px;">${key}</span><span style="color:#16a34a;font-size:13px;"><i class="fas fa-check-circle"></i> ${h}. ${teks}</span></div><p style="margin-top:8px;font-size:14px;color:#1E293B;">${istilah}</p>`;
            } else {
                t.innerHTML += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span style="background:#D97706;color:white;padding:4px 10px;border-radius:20px;font-size:12px;">${key}</span><span style="color:#94a3b8;font-size:12px;"><i class="fas fa-arrow-right"></i> Tarik jawaban</span></div><p style="font-size:14px;color:#1E293B;">${istilah}</p>`;
            }
            t.innerHTML += `</div>`;
        }
    }
    const used = Object.values(o),
        opsi = s.pilihan.filter(p => p && p.trim());
    opsi.forEach((opt, i) => {
        const h = String.fromCharCode(65 + i),
            d = document.getElementById(`drag_${h}`);
        if (d) {
            const u = used.includes(h);
            d.className = `matching-item-right${u ? ' paired' : ''}`;
            d.setAttribute('draggable', !u);
            d.style.background = u ? '#DCFCE7' : 'white';
            d.style.border = u ? '2px solid #22C55E' : '2px solid #1E3A8A';
            d.innerHTML = `<strong style="color:#1E3A8A;">${h}.</strong> ${opt.replace(/^[A-E]\.\s*/, '')}${u ? '<span style="color:#16a34a;margin-left:8px;"><i class="fas fa-check-circle"></i></span>' : ''}`;
        }
    });
    initDragDropJodoh();
}

function resetMatching() {
    window.currentMatchingJawaban = {};
    const soal = window.currentMatchingSoal;
    if (soal) {
        delete jawabanLokal[soal.id];
        simpanKeLocalStorage();
        renderNavigator();
    }
    renderSoal(indexSoal);
    showToast('Pasangan direset', 'info');
}

// ==================== TIMER & SELESAI ====================
function mulaiTimer() {
    if (!waktuSelesai) return;
    timerInterval = setInterval(() => {
        const s = Math.max(waktuSelesai - new Date(), 0),
            d = Math.floor(s / 1000),
            m = Math.floor(d / 60),
            sec = d % 60;
        document.getElementById("timerDisplay").innerText = `${m}:${sec < 10 ? "0" : ""}${sec}`;
        if (d === 0 && !ujianSelesai) {
            ujianSelesai = true;
            clearInterval(timerInterval);
            showModal({
                iconType: "warning",
                title: "Waktu Habis",
                message: "Ujian akan otomatis berakhir.",
                buttons: [{ text: "OK", type: "primary", onClick: () => selesaiUjian() }]
            });
        }
    }, 1000);
}

function konfirmasiSelesai() {
    if (isFrozen) return;
    if (!tombolSelesaiAktif) {
        const s = Math.max(minimalMenit - Math.floor((new Date() - waktuMulaiServer) / 60000), 0);
        showError(`Tunggu ${s} menit lagi!`);
        return;
    }
    const b = dataSoal.filter(s => !jawabanLokal[s.id]).length;
    showModal({
        iconType: "warning",
        title: "Akhiri Ujian?",
        message: `📝 ${dataSoal.length - b} soal dijawab\n⚠️ ${b} soal belum`,
        showCheckbox: true,
        checkboxLabel: "Saya yakin ingin mengakhiri ujian",
        buttons: [
            { text: "Lanjutkan", type: "secondary" },
            {
                text: "Ya, Selesai", type: "warning", onClick: c => {
                    if (!c) { showError("Centang konfirmasi!"); return false; }
                    selesaiUjian();
                }
            }
        ]
    });
}

async function selesaiUjian() {
    clearInterval(timerInterval);
    if (freezeInterval) clearInterval(freezeInterval);
    ujianSelesai = true;

    // ✅ AMBIL TOTAL SKOR DARI SESI (HASIL AKUMULASI)
    let totalSkorAkhir = 0;
    if (window.db && idSesi) {
        try {
            const sesiColl = window.Firebase.collection(window.db, 'sesi_ujian');
            const sesiQ = window.Firebase.query(sesiColl, window.Firebase.where('idSesi', '==', idSesi));
            const snapshot = await window.Firebase.getDocs(sesiQ);
            
            if (!snapshot.empty) {
                const sesiData = snapshot.docs[0].data();
                totalSkorAkhir = sesiData.totalSkorSementara || 0;
            }
        } catch (e) { console.error(e); }
    }

    if (document.exitFullscreen) document.exitFullscreen();
    document.getElementById("freezeOverlay").style.display = "none";

    if (window.db) {
        try {
            const coll = window.Firebase.collection(window.db, 'nilai_akhir');
            await window.Firebase.addDoc(coll, {
                idSesi, username: currentUser.username, nis: currentUser.nis, nama: currentUser.nama,
                jenjang: currentUser.jenjang, kelas: currentUser.kelas, mapel: currentUjian.mapel,
                jenisUjian: currentUjian.jenis, totalSkor: totalSkorAkhir, jumlahSoal: dataSoal.length,
                persentase: ((totalSkorAkhir / dataSoal.length) * 100).toFixed(1) + '%',
                timestamp: new Date().toISOString()
            });
            console.log('✅ Nilai akhir tersimpan ke Firebase');
        } catch (e) { console.error('❌ Gagal simpan nilai:', e); }
    }

    if (window.db && idSesi) {
        try {
            const sesiColl = window.Firebase.collection(window.db, 'sesi_ujian');
            const sesiQ = window.Firebase.query(sesiColl, window.Firebase.where('idSesi', '==', idSesi));
            const snapshot = await window.Firebase.getDocs(sesiQ);
            
            snapshot.forEach(async (doc) => {
                await window.Firebase.updateDoc(doc.ref, { 
                    status: 'Selesai', 
                    waktuSelesai: new Date().toISOString() 
                });
            });
            console.log('✅ Status sesi diupdate menjadi Selesai');
        } catch (e) { console.error('❌ Gagal update status sesi:', e); }
    }

    localStorage.removeItem(`jawaban_${idSesi}`);
    showModal({
        iconType: "success",
        title: "🎉 Ujian Selesai!",
        message: "",
        buttons: [{ text: "Tutup", type: "success", onClick: () => location.reload() }]
    });
    setTimeout(() => {
        document.querySelector(".modal-message").innerHTML = `<div style="text-align:center;"><div style="font-size:48px;font-weight:800;color:#1E3A8A;">${totalSkorAkhir.toFixed(2)}</div><div>Total Skor</div></div>`;
    }, 10);
}

// ==================== INISIALISASI ====================
document.addEventListener('DOMContentLoaded', () => {
    const y = document.getElementById('currentYear');
    if (y) y.textContent = new Date().getFullYear();
});
