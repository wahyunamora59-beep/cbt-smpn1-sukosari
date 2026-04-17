// ==================== KONFIGURASI ====================
const CONFIG = {
    SPREADSHEET_ID: '1zc5lh-8XWEhGYJajqooWGK3Vo89kqob1iAaIdaIiXc0',
    API_KEY: 'AIzaSyAG16CaL_CwY6Hktj6nNrxCoPjYXcJZHcE',
    PROXY_URL: 'https://script.google.com/macros/s/AKfycbzCGEEaroaDG5juhDVl_8hSEMan_dN0CSGzTJEJ154peJjaZh3eUv5_BFiBNzmXJilu/exec'
};

// ==================== VARIABEL GLOBAL ====================
let currentUser = null, currentUjian = null, dataSoal = [], indexSoal = 0;
let jawabanLokal = {}, raguLokal = {}, timerInterval = null, waktuSelesai = null;
let waktuMulaiServer = null, minimalMenit = 45, ujianSelesai = false, idSesi = null;
let pelanggaranCount = 0, totalPenalti = 0, tombolSelesaiAktif = false;
let isFullscreen = false, isFrozen = false, freezeInterval = null;
let pendingUser = null, pendingUjian = null, pendingWaktuSelesai = null;
let isLocked = false;

// ==================== TOAST & MODAL ====================
function showToast(m, t = "info", d = 3000) {
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
    const { icon: i, iconType: t = "info", title: d, message: m, showCheckbox: s = !1, checkboxLabel: c = "", buttons: b = [], onClose: l } = o;
    document.getElementById("modalIcon").textContent = i || (t === "success" ? "✅" : t === "error" ? "❌" : t === "warning" ? "⚠️" : "ℹ️");
    document.getElementById("modalIcon").className = `modal-icon ${t}`;
    document.getElementById("modalTitle").textContent = d;
    document.getElementById("modalMessage").textContent = m;
    const h = document.getElementById("modalCheckboxContainer");
    if (s) { h.style.display = "flex"; document.getElementById("modalCheckboxLabel").textContent = c; document.getElementById("modalCheckbox").checked = !1; }
    else h.style.display = "none";
    const u = document.getElementById("modalButtons");
    u.innerHTML = "";
    b.forEach(n => {
        const x = document.createElement("button");
        x.className = `modal-btn ${n.type || "secondary"}`;
        x.textContent = n.text;
        x.onclick = () => { const C = s ? document.getElementById("modalCheckbox").checked : !1; if (n.onClick) n.onClick(C); closeModal(); };
        u.appendChild(x);
    });
    v.style.display = "flex";
    v.onclick = e => { if (e.target === v) { closeModal(); if (l) l(); } };
}
function closeModal() { document.getElementById("modalOverlay").style.display = "none"; }
function showSuccess(m) { showToast(m, "success"); }
function showError(m) { showToast(m, "error"); }

// ==================== FREEZE LAYAR ====================
function freezeScreen(d = 60) {
    if (isFrozen) return;
    isFrozen = true;
    const o = document.getElementById("freezeOverlay"), t = document.getElementById("freezeTimer");
    o.style.display = "flex";
    let r = d;
    const e = () => {
        const m = Math.floor(r / 60), s = r % 60;
        t.textContent = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
        if (r <= 0) { clearInterval(freezeInterval); o.style.display = "none"; isFrozen = false; showToast("Layar sudah tidak dibekukan!", "warning", 5000); }
        r--;
    };
    e();
    freezeInterval = setInterval(e, 1000);
    o.addEventListener("click", e => e.stopPropagation());
}

// ==================== HELPER ====================
function togglePassword() { const i = document.getElementById("tokenInput"); i.type = i.type === "password" ? "text" : "password"; }
function toggleNav() { if (isFrozen) return; document.getElementById("navPanel").classList.toggle("show"); }
function toggleRagu() { if (isFrozen) return; if (!dataSoal[indexSoal]) return; raguLokal[dataSoal[indexSoal].id] = !raguLokal[dataSoal[indexSoal].id]; renderNavigator(); showToast(raguLokal[dataSoal[indexSoal].id] ? "Ditandai ragu" : "Tanda ragu dihapus", "info", 1500); }
function updateNavInfo() { const t = dataSoal.length, j = Object.keys(jawabanLokal).length, e = document.getElementById("navInfo"); if (e) e.textContent = `✅ ${j}/${t} terjawab`; }

// ==================== FULLSCREEN ====================
function enterFullscreen() { const e = document.documentElement; if (e.requestFullscreen) e.requestFullscreen(); else if (e.webkitRequestFullscreen) e.webkitRequestFullscreen(); isFullscreen = true; }
function showFullscreenPrompt() { showModal({ iconType: "info", title: "Mode Fullscreen Wajib", message: "Klik tombol di bawah untuk masuk fullscreen.", buttons: [{ text: "Masuk Fullscreen", type: "primary", onClick: () => enterFullscreen() }], onClose: () => { if (!isFullscreen) showFullscreenPrompt(); } }); }
document.addEventListener("fullscreenchange", handleFullscreenChange);
document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
function handleFullscreenChange() { if (!document.fullscreenElement && !document.webkitFullscreenElement) { if (currentUser && !ujianSelesai) { isFullscreen = false; catatPelanggaran("FULLSCREEN_EXIT", "Keluar fullscreen"); freezeScreen(60); showFullscreenPrompt(); } } else isFullscreen = true; }

// ==================== ANTI-CURANG (HP TERKUNCI TIDAK DIHITUNG) ====================
window.addEventListener('pagehide', () => { isLocked = true; });
window.addEventListener('pageshow', () => { if (isLocked) { console.log('📱 HP terbuka dari kunci'); isLocked = false; } });
document.addEventListener("visibilitychange", () => {
    if (document.hidden && currentUser && !ujianSelesai && !isFrozen) {
        if (!isLocked) {
            catatPelanggaran("TAB_SWITCH", "Pindah tab/aplikasi");
            freezeScreen(60);
            document.getElementById("alertOverlay").style.display = "block";
            document.getElementById("alertSound").play();
            setTimeout(() => document.getElementById("alertOverlay").style.display = "none", 3000);
        } else {
            console.log('📱 HP terkunci - bukan pelanggaran');
            fetch(CONFIG.PROXY_URL, { method: "POST", body: JSON.stringify({ action: "catatPelanggaran", idSesi, username: currentUser.username, nama: currentUser.nama, kelas: currentUser.kelas, jenis: "SCREEN_LOCK", detail: "HP terkunci (bukan pelanggaran)", ipAddress: "0.0.0.0", bukti: navigator.userAgent }) });
        }
    }
});
document.addEventListener("contextmenu", e => { e.preventDefault(); if (currentUser && !ujianSelesai && !isFrozen) { catatPelanggaran("RIGHT_CLICK", "Klik kanan"); freezeScreen(60); } });
document.addEventListener("keydown", e => { if (!currentUser || ujianSelesai || isFrozen) return; if (e.key === "F11" || e.key === "Escape") e.preventDefault(); if (e.ctrlKey && (e.key === "w" || e.key === "t" || e.key === "n")) { e.preventDefault(); catatPelanggaran("KEYBOARD", `Ctrl+${e.key.toUpperCase()}`); freezeScreen(60); } });
window.addEventListener("beforeunload", e => { if (currentUser && !ujianSelesai) { e.preventDefault(); e.returnValue = ""; } });

function catatPelanggaran(j, d) {
    if (!currentUser || ujianSelesai) return;
    pelanggaranCount++; totalPenalti++;
    fetch(CONFIG.PROXY_URL, { method: "POST", body: JSON.stringify({ action: "catatPelanggaran", idSesi, username: currentUser.username, nama: currentUser.nama, kelas: currentUser.kelas, jenis: j, detail: d, ipAddress: "0.0.0.0", bukti: navigator.userAgent }) });
    document.getElementById("alertOverlay").style.display = "block"; document.getElementById("alertSound").play();
    setTimeout(() => document.getElementById("alertOverlay").style.display = "none", 3000);
    if (pelanggaranCount >= 5) { showModal({ iconType: "error", title: "TERLALU BANYAK PELANGGARAN", message: "Ujian akan otomatis berakhir.", buttons: [{ text: "OK", type: "primary", onClick: () => selesaiUjian() }] }); }
}

// ==================== UPDATE TOMBOL SELESAI ====================
function updateTombolSelesai() {
    const btn = document.querySelector(".btn-selesai");
    if (!btn || !waktuMulaiServer) return;
    const sekarang = new Date();
    const menitBerlalu = Math.floor((sekarang - waktuMulaiServer) / 60000);
    const sisaMenit = Math.max(minimalMenit - menitBerlalu, 0);
    if (sisaMenit > 0 && !ujianSelesai) {
        tombolSelesaiAktif = false;
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-lock"></i> Selesai (${sisaMenit}m lagi)`;
    } else {
        tombolSelesaiAktif = true;
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-check-circle"></i> Selesai`;
    }
}

// ==================== LOGIN ====================
async function handleLogin() {
    const u = document.getElementById("usernameInput").value.trim(), t = document.getElementById("tokenInput").value.trim();
    if (!u || !t) { showError("Isi username dan token!"); return; }
    try {
        const tR = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/TOKEN_UJIAN!A:H?key=${CONFIG.API_KEY}`), tD = await tR.json(), tRows = tD.values || [];
        let tokenInfo = null;
        for (let i = 1; i < tRows.length; i++) if (tRows[i][0] === t && tRows[i][5] === "Aktif") { tokenInfo = { jenjang: tRows[i][1], mapel: tRows[i][2], jenis: tRows[i][3] }; break; }
        if (!tokenInfo) { showError("Token tidak valid!"); return; }
        
        const sR = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/DATA_SISWA!A:H?key=${CONFIG.API_KEY}`), sD = await sR.json(), sRows = sD.values || [];
        let siswa = null;
        for (let i = 1; i < sRows.length; i++) if (sRows[i][2] === u) { siswa = { nis: sRows[i][0] || '', nama: sRows[i][1] || '', username: sRows[i][2], kelas: sRows[i][4] || '', jenjang: sRows[i][5] || '' }; break; }
        if (!siswa) { showError("Username tidak terdaftar!"); return; }
        
        const jR = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/JADWAL_UJIAN!A:J?key=${CONFIG.API_KEY}`), jD = await jR.json(), jRows = jD.values || [];
        let jadwal = null;
        for (let i = 1; i < jRows.length; i++) if (String(jRows[i][1]).trim() === String(tokenInfo.jenjang).trim() && String(jRows[i][2]).trim() === String(tokenInfo.mapel).trim() && String(jRows[i][3]).trim() === String(tokenInfo.jenis).trim() && jRows[i][9] === "Aktif") { jadwal = { mulai: jRows[i][5], selesai: jRows[i][6], min: parseInt(jRows[i][7]) || 0 }; break; }
        if (!jadwal) { showError("Jadwal tidak ditemukan!"); return; }
        if (!jadwal.mulai || !jadwal.selesai) { showError("Format waktu salah!"); return; }
        
        const now = new Date();
        const [hS, mS] = String(jadwal.selesai).split(':').map(n => parseInt(n));
        const wS = new Date(); wS.setHours(hS, mS, 0, 0);
        if (now >= wS) { showError("Waktu ujian sudah berakhir!"); return; }
        
        pendingUser = siswa; pendingUjian = { ...tokenInfo, ...jadwal }; pendingWaktuSelesai = wS;
        document.getElementById("loginScreen").style.display = "none"; document.getElementById("confirmScreen").style.display = "block";
        document.getElementById("confirmNIS").textContent = siswa.nis || '-';
        document.getElementById("confirmNama").textContent = siswa.nama || '-';
        document.getElementById("confirmKelas").textContent = siswa.kelas || '-';
        document.getElementById("confirmMapel").textContent = `${tokenInfo.mapel} - ${tokenInfo.jenis}`;
        document.getElementById("confirmWaktu").textContent = `${jadwal.mulai} - ${jadwal.selesai}`;
    } catch (e) { console.error(e); showError("Gagal terhubung."); }
}

function cancelConfirm() {
    document.getElementById("confirmScreen").style.display = "none"; document.getElementById("loginScreen").style.display = "block";
    document.getElementById("usernameInput").value = ""; document.getElementById("tokenInput").value = "";
    pendingUser = null; pendingUjian = null; pendingWaktuSelesai = null;
    showToast("Silakan login dengan akun yang benar", "info");
}

async function startExam() {
    if (!pendingUser || !pendingUjian) { showError("Data tidak valid."); cancelConfirm(); return; }
    currentUser = pendingUser; currentUjian = pendingUjian; waktuSelesai = pendingWaktuSelesai; minimalMenit = pendingUjian.min || 0;
    waktuMulaiServer = new Date();
    try {
        const pR = await fetch(CONFIG.PROXY_URL, { method: "POST", body: JSON.stringify({ action: "mulaiUjian", username: currentUser.username, token: document.getElementById("tokenInput").value.trim(), jenjang: currentUser.jenjang, mapel: currentUjian.mapel, jenisUjian: currentUjian.jenis, ipAddress: "0.0.0.0", device: /Mobile/.test(navigator.userAgent) ? "Mobile" : "Desktop" }) });
        const pD = await pR.json(); if (!pD.success) { showError(pD.msg); cancelConfirm(); return; } idSesi = pD.idSesi;
    } catch (e) { showError("Gagal terhubung."); cancelConfirm(); return; }
    document.getElementById("confirmScreen").style.display = "none"; document.getElementById("examScreen").style.display = "block";
    document.getElementById("namaDisplay").innerText = `${currentUser.nama || 'N/A'} | ${currentUser.kelas || 'N/A'}`;
    document.getElementById("infoDisplay").innerText = `${currentUjian.mapel || 'N/A'} - ${currentUjian.jenis || 'N/A'}`;
    await ambilSoal(currentUser.jenjang, currentUjian.mapel, currentUjian.jenis);
    mulaiTimer(); renderNavigator(); showFullscreenPrompt();
    updateTombolSelesai(); setInterval(updateTombolSelesai, 1000);
    showSuccess(`Selamat datang, ${currentUser.nama || 'Siswa'}!`);
}

// ==================== AMBIL SOAL ====================
async function ambilSoal(j, m, js) {
    try {
        const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/BANK_SOAL!A:O?key=${CONFIG.API_KEY}`), d = await r.json(), rows = d.values || [];
        dataSoal = [];
        for (let i = 1; i < rows.length; i++) {
            if (String(rows[i][1]).trim() === String(j).trim() && String(rows[i][2]).trim() === String(m).trim() && String(rows[i][3]).trim() === String(js).trim() && rows[i][13] === "Aktif") {
                dataSoal.push({ id: rows[i][0], tipe: rows[i][4], pertanyaan: rows[i][5], pilihan: [rows[i][6], rows[i][7], rows[i][8], rows[i][9], rows[i][10]].filter(p => p), kunci: rows[i][11], bobot: parseFloat(rows[i][12]) || 1, gambar: rows[i][14] || null });
            }
        }
        if (dataSoal.length === 0) { document.getElementById("soalContainer").innerHTML = "<p>Belum ada soal.</p>"; return; }
        dataSoal = shuffleArray(dataSoal); renderSoal(0);
    } catch (e) { console.error(e); }
}
function shuffleArray(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ==================== RENDER ====================
function renderNavigator() {
    let h = "";
    for (let i = 0; i < dataSoal.length; i++) {
        const s = dataSoal[i], ans = jawabanLokal[s.id] !== undefined, rag = raguLokal[s.id], cur = i === indexSoal;
        let c = "unanswered"; if (ans) c = "answered"; if (rag && !cur) c = "ragu"; if (cur) c = "current";
        h += `<button class="nav-btn-num ${c}" onclick="goToSoal(${i})">${i + 1}</button>`;
    }
    document.getElementById("navGrid").innerHTML = h; updateNavInfo();
}
function goToSoal(i) { if (isFrozen) return; renderSoal(i); renderNavigator(); if (window.innerWidth <= 600) document.getElementById("navPanel").classList.remove("show"); }

function renderSoal(idx) {
    indexSoal = idx; const s = dataSoal[idx];
    document.getElementById("progressFill").style.width = ((idx + 1) / dataSoal.length * 100) + "%";
    let h = `<h3>Soal ${idx + 1}/${dataSoal.length} [${s.tipe}]</h3>`;
    if (s.gambar) { let u = s.gambar; if (u.match(/^[a-zA-Z0-9_-]{20,}$/)) u = `https://drive.google.com/uc?export=view&id=${u}`; h += `<img src="${u}" style="max-width:100%;">`; }
    h += `<p><strong>${s.pertanyaan}</strong></p>`; const jaw = jawabanLokal[s.id];
    
    if (s.tipe === "PG") {
        s.pilihan.forEach((o, i) => { const hu = String.fromCharCode(65 + i); h += `<label class="option-label"><input type="radio" name="jwb" value="${hu}" ${jaw === hu ? "checked" : ""} ${isFrozen ? "disabled" : ""}> ${hu}. ${o}</label>`; });
        h += `<button class="btn-simpan" onclick="simpanPG('${s.id}')" ${isFrozen ? "disabled" : ""}><i class="fas fa-save"></i> Simpan Jawaban</button>`;
    } else if (s.tipe === "PGK") {
        let a = []; try { a = JSON.parse(jaw || "[]"); } catch (e) {}
        s.pilihan.forEach((o, i) => { const hu = String.fromCharCode(65 + i); h += `<label class="option-label"><input type="checkbox" name="jwb" value="${hu}" ${a.includes(hu) ? "checked" : ""} ${isFrozen ? "disabled" : ""}> ${hu}. ${o}</label>`; });
        h += `<button class="btn-simpan" onclick="simpanPGK('${s.id}')" ${isFrozen ? "disabled" : ""}><i class="fas fa-save"></i> Simpan Jawaban</button>`;
    } else if (s.tipe === "B/S") {
        const pernyataan = s.pilihan.filter(p => p && p.trim() !== '');
        if (pernyataan.length === 0) {
            h += `<div style="background:#f8fafc; padding:16px; border-radius:12px; margin-bottom:16px; border:1px solid #e2e8f0;">`;
            h += `<p style="font-weight:500; margin-bottom:16px;">${s.pertanyaan}</p>`;
            h += `<div style="display:flex; gap:24px;">`;
            h += `<label style="display:flex; align-items:center; cursor:pointer;"><input type="radio" name="bs_single" value="B" ${jaw === 'B' ? 'checked' : ''} ${isFrozen ? 'disabled' : ''} style="margin-right:10px; width:20px; height:20px; accent-color:#22c55e;"><span style="font-weight:600; color:#22c55e;">✅ BENAR</span></label>`;
            h += `<label style="display:flex; align-items:center; cursor:pointer;"><input type="radio" name="bs_single" value="S" ${jaw === 'S' ? 'checked' : ''} ${isFrozen ? 'disabled' : ''} style="margin-right:10px; width:20px; height:20px; accent-color:#dc2626;"><span style="font-weight:600; color:#dc2626;">❌ SALAH</span></label>`;
            h += `</div></div>`;
            h += `<button class="btn-simpan" onclick="simpanBSSingle('${s.id}')" ${isFrozen ? 'disabled' : ''}><i class="fas fa-save"></i> Simpan Jawaban</button>`;
        } else {
            let jawabanArr = []; try { if (jaw) jawabanArr = JSON.parse(jaw); } catch (e) { if (jaw === "B" || jaw === "S") jawabanArr = [jaw]; }
            pernyataan.forEach((teks, i) => {
                const jwb = jawabanArr[i] || '';
                h += `<div style="background:#f8fafc; padding:14px; border-radius:12px; margin-bottom:12px; border:1px solid #e2e8f0;"><p style="font-weight:500; margin-bottom:12px;">${i + 1}. ${teks}</p><div style="display:flex; gap:20px;">`;
                h += `<label style="display:flex; align-items:center; cursor:pointer;"><input type="radio" name="bs_${i}" value="B" ${jwb === 'B' ? 'checked' : ''} ${isFrozen ? 'disabled' : ''} style="margin-right:8px; width:18px; height:18px; accent-color:#22c55e;"><span style="font-weight:500;">✅ Benar</span></label>`;
                h += `<label style="display:flex; align-items:center; cursor:pointer;"><input type="radio" name="bs_${i}" value="S" ${jwb === 'S' ? 'checked' : ''} ${isFrozen ? 'disabled' : ''} style="margin-right:8px; width:18px; height:18px; accent-color:#dc2626;"><span style="font-weight:500;">❌ Salah</span></label>`;
                h += `</div></div>`;
            });
            h += `<button class="btn-simpan" onclick="simpanBS('${s.id}', ${pernyataan.length})" ${isFrozen ? 'disabled' : ''}><i class="fas fa-save"></i> Simpan Jawaban</button>`;
        }
    } else if (s.tipe === "Jodoh" || s.tipe === "JODOH") {
        let kunciObj = {}, jawabanObj = {};
        try { kunciObj = JSON.parse(s.kunci); jawabanObj = JSON.parse(jaw || "{}"); } catch(e) {}
        window.currentMatchingSoal = s; window.currentMatchingJawaban = jawabanObj;
        const opsiTeracak = shuffleArray(s.pilihan.filter(p => p && p.trim()));
        h += `<div class="matching-jodoh-container">`;
        h += `<div class="matching-left"><div style="font-weight:600; margin-bottom:8px; color:#1e293b;"><i class="fas fa-arrows-alt"></i> Istilah (Tarik ke kanan)</div>`;
        for (let key in kunciObj) {
            const isPaired = jawabanObj[key] !== undefined;
            h += `<div class="matching-item-left ${isPaired ? 'paired' : ''}" draggable="${!isPaired}" data-key="${key}" id="drag_${key.replace(/[^a-zA-Z0-9]/g,'')}"><span style="font-weight:500;">${key}</span>${isPaired ? `<span style="margin-left:8px; color:#16a34a; font-size:12px;">(✓ ${jawabanObj[key]})</span>` : ''}</div>`;
        }
        h += `</div>`;
        h += `<div class="matching-right"><div style="font-weight:600; margin-bottom:8px; color:#1e293b;"><i class="fas fa-bullseye"></i> Target (Drop di sini)</div>`;
        for (let key in kunciObj) {
            const isFilled = jawabanObj[key] !== undefined, txt = jawabanObj[key] || '';
            h += `<div class="matching-target ${isFilled ? 'filled' : 'empty'}" data-key="${key}" id="target_${key.replace(/[^a-zA-Z0-9]/g,'')}"><div class="matching-target-content">${isFilled ? `<strong>${key}</strong><br><span style="font-size:13px; color:#16a34a;">→ ${txt}</span>` : `<strong>${key}</strong><br><span style="color:#94a3b8; font-size:12px;">⬅️ Tarik istilah ke sini</span>`}</div></div>`;
        }
        h += `</div></div>`;
        h += `<div style="margin-top:20px; padding:16px; background:#f1f5f9; border-radius:16px;"><p style="font-weight:600; margin-bottom:12px; color:#1e293b;"><i class="fas fa-list"></i> Pilihan Jawaban:</p><div style="display:grid; grid-template-columns:repeat(2,1fr); gap:8px;">`;
        opsiTeracak.forEach((opt, i) => { h += `<div style="padding:8px; background:white; border-radius:8px;"><strong style="color:#0b2b5e;">${String.fromCharCode(65 + i)}.</strong> ${opt}</div>`; });
        h += `</div></div>`;
        h += `<div style="display:flex; gap:12px; margin-top:16px;"><button class="btn-reset-matching" onclick="resetMatching()"><i class="fas fa-undo"></i> Reset</button><button class="btn-simpan" onclick="simpanJodohDrag('${s.id}')"><i class="fas fa-save"></i> Simpan Jawaban</button></div>`;
        setTimeout(() => initDragDropJodoh(), 50);
    } else if (s.tipe === "Isian") {
        h += `<input type="text" id="isian" value="${jaw || ''}" placeholder="Ketik jawaban..." style="width:100%;padding:14px;border-radius:16px;border:1px solid #e2e8f0;" ${isFrozen ? "disabled" : ""}>`;
        h += `<button class="btn-simpan" onclick="simpanIsian('${s.id}')" ${isFrozen ? "disabled" : ""}><i class="fas fa-save"></i> Simpan Jawaban</button>`;
    }
    document.getElementById("soalContainer").innerHTML = h;
}

// ==================== SIMPAN JAWABAN ====================
async function simpanKeServer(idSoal, jawaban, skor) { if (!idSesi || !currentUser) return; try { await fetch(CONFIG.PROXY_URL, { method: "POST", body: JSON.stringify({ action: "simpanJawaban", idSesi, username: currentUser.username, jenjang: currentUser.jenjang, mapel: currentUjian.mapel, jenisUjian: currentUjian.jenis, idSoal, jawaban, skor }) }); } catch (e) {} }
function simpanPG(id) { if (isFrozen) return; const s = document.querySelector('input[name="jwb"]:checked'); if (!s) { showError("Pilih jawaban!"); return; } jawabanLokal[id] = s.value; renderNavigator(); const soal = dataSoal.find(q => q.id === id); simpanKeServer(id, s.value, s.value === soal.kunci ? soal.bobot : 0); showSuccess("Jawaban tersimpan!"); }
function simpanPGK(id) { if (isFrozen) return; const a = Array.from(document.querySelectorAll('input[name="jwb"]:checked')).map(c => c.value); if (a.length === 0) { showError("Pilih minimal satu!"); return; } const jwb = JSON.stringify(a); jawabanLokal[id] = jwb; renderNavigator(); const soal = dataSoal.find(q => q.id === id); let s = 0; try { if (JSON.stringify(a.sort()) === JSON.stringify(JSON.parse(soal.kunci).sort())) s = soal.bobot; } catch (e) {} simpanKeServer(id, jwb, s); showSuccess("Jawaban tersimpan!"); }
function simpanBSSingle(id) { if (isFrozen) return; const s = document.querySelector('input[name="bs_single"]:checked'); if (!s) { showError("Pilih Benar atau Salah!"); return; } jawabanLokal[id] = s.value; renderNavigator(); const soal = dataSoal.find(q => q.id === id); simpanKeServer(id, s.value, s.value === soal.kunci ? soal.bobot : 0); showSuccess("Jawaban tersimpan!"); }
function simpanBS(id, n) { if (isFrozen) return; const a = []; for (let i = 0; i < n; i++) { const s = document.querySelector(`input[name="bs_${i}"]:checked`); if (!s) { showError(`Jawab pernyataan ${i + 1}!`); return; } a.push(s.value); } const jwb = JSON.stringify(a); jawabanLokal[id] = jwb; renderNavigator(); const soal = dataSoal.find(q => q.id === id); let s = 0; try { const k = JSON.parse(soal.kunci); let b = 0; for (let i = 0; i < k.length; i++) if (a[i] === k[i]) b++; s = (b / k.length) * soal.bobot; } catch (e) {} simpanKeServer(id, jwb, s); showSuccess(`${n} pernyataan tersimpan!`); }
function simpanJodohDrag(id) { const o = window.currentMatchingJawaban || {}, soal = window.currentMatchingSoal; let k = {}; try { k = JSON.parse(soal.kunci); } catch (e) {} if (Object.keys(o).length !== Object.keys(k).length) { showError("Pasangkan semua!"); return; } const jwb = JSON.stringify(o); jawabanLokal[id] = jwb; renderNavigator(); let s = 0; try { let b = 0; for (let key in k) if (o[key] && o[key].toUpperCase() === k[key].toUpperCase()) b++; s = (b / Object.keys(k).length) * soal.bobot; } catch (e) {} simpanKeServer(id, jwb, s); showSuccess("Jawaban tersimpan!"); }
function simpanIsian(id) { if (isFrozen) return; const i = document.getElementById("isian"); if (!i.value.trim()) { showError("Isi jawaban!"); return; } const jwb = i.value.trim(); jawabanLokal[id] = jwb; renderNavigator(); const soal = dataSoal.find(q => q.id === id); simpanKeServer(id, jwb, jwb.toLowerCase() === soal.kunci.toLowerCase() ? soal.bobot : 0); showSuccess("Jawaban tersimpan!"); }
function prevSoal() { if (isFrozen) return; if (indexSoal > 0) goToSoal(indexSoal - 1); }
function nextSoal() { if (isFrozen) return; if (indexSoal < dataSoal.length - 1) goToSoal(indexSoal + 1); }

// ==================== DRAG & DROP JODOH ====================
function initDragDropJodoh() {
    document.querySelectorAll('.matching-item-left[draggable="true"]').forEach(i => { i.removeEventListener('dragstart', handleDragStartJodoh); i.addEventListener('dragstart', handleDragStartJodoh); i.removeEventListener('dragend', handleDragEndJodoh); i.addEventListener('dragend', handleDragEndJodoh); });
    document.querySelectorAll('.matching-target').forEach(t => { t.removeEventListener('dragover', handleDragOverJodoh); t.addEventListener('dragover', handleDragOverJodoh); t.removeEventListener('dragenter', handleDragEnterJodoh); t.addEventListener('dragenter', handleDragEnterJodoh); t.removeEventListener('dragleave', handleDragLeaveJodoh); t.addEventListener('dragleave', handleDragLeaveJodoh); t.removeEventListener('drop', handleDropJodoh); t.addEventListener('drop', handleDropJodoh); });
}
function handleDragStartJodoh(e) { const i = e.target.closest('.matching-item-left'); if (!i) return; i.classList.add('dragging'); e.dataTransfer.setData('text/plain', i.dataset.key); e.dataTransfer.effectAllowed = 'move'; }
function handleDragEndJodoh(e) { const i = e.target.closest('.matching-item-left'); if (i) i.classList.remove('dragging'); document.querySelectorAll('.matching-target').forEach(t => t.classList.remove('drag-over')); }
function handleDragOverJodoh(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
function handleDragEnterJodoh(e) { e.preventDefault(); this.classList.add('drag-over'); }
function handleDragLeaveJodoh(e) { this.classList.remove('drag-over'); }
function handleDropJodoh(e) { e.preventDefault(); this.classList.remove('drag-over'); const tk = this.dataset.key, dk = e.dataTransfer.getData('text/plain'); if (!tk || !dk) return; if (window.currentMatchingJawaban[tk]) { showError('Target sudah terisi!'); return; } if (window.currentMatchingJawaban[dk]) { showError('Istilah sudah dipasangkan!'); return; } const jwb = prompt(`Masukkan huruf jawaban (A/B/C/D/E) untuk:\n\n"${dk}"`); if (!jwb) return; const h = jwb.trim().toUpperCase(); if (!/^[A-E]$/.test(h)) { showError('Masukkan A, B, C, D, atau E!'); return; } window.currentMatchingJawaban[dk] = h; window.currentMatchingJawaban[tk] = h; updateMatchingUIJodoh(); showSuccess(`"${dk}" dipasangkan dengan ${h}!`); }
function updateMatchingUIJodoh() { const s = window.currentMatchingSoal, o = window.currentMatchingJawaban; let k = {}; try { k = JSON.parse(s.kunci); } catch (e) {} for (let key in k) { const t = document.getElementById(`target_${key.replace(/[^a-zA-Z0-9]/g,'')}`), d = document.getElementById(`drag_${key.replace(/[^a-zA-Z0-9]/g,'')}`); if (t) { const f = o[key] !== undefined, txt = o[key] || ''; t.className = `matching-target ${f ? 'filled' : 'empty'}`; t.innerHTML = `<div class="matching-target-content">${f ? `<strong>${key}</strong><br><span style="font-size:13px; color:#16a34a;">→ ${txt}</span>` : `<strong>${key}</strong><br><span style="color:#94a3b8; font-size:12px;">⬅️ Tarik istilah ke sini</span>`}</div>`; } if (d) { const p = o[key] !== undefined; d.classList.toggle('paired', p); d.setAttribute('draggable', !p); d.innerHTML = `<span style="font-weight:500;">${key}</span>${p ? `<span style="margin-left:8px; color:#16a34a; font-size:12px;">(✓ ${o[key]})</span>` : ''}`; } } initDragDropJodoh(); }
function resetMatching() { window.currentMatchingJawaban = {}; renderSoal(indexSoal); showToast('Pasangan direset', 'info'); }

// ==================== TIMER ====================
function mulaiTimer() { if (!waktuSelesai) return; timerInterval = setInterval(() => { const s = Math.max(waktuSelesai - new Date(), 0), d = Math.floor(s / 1000), m = Math.floor(d / 60), sec = d % 60; document.getElementById("timerDisplay").innerText = `${m}:${sec < 10 ? "0" : ""}${sec}`; if (d === 0 && !ujianSelesai) { ujianSelesai = true; clearInterval(timerInterval); showModal({ iconType: "warning", title: "Waktu Habis", message: "Ujian akan otomatis berakhir.", buttons: [{ text: "OK", type: "primary", onClick: () => selesaiUjian() }] }); } }, 1000); }
function konfirmasiSelesai() { if (isFrozen) return; if (!tombolSelesaiAktif) { const s = Math.max(minimalMenit - Math.floor((new Date() - waktuMulaiServer) / 60000), 0); showError(`Tunggu ${s} menit lagi!`); return; } const b = dataSoal.filter(s => !jawabanLokal[s.id]).length; showModal({ iconType: "warning", title: "Akhiri Ujian?", message: `📝 ${dataSoal.length - b} soal dijawab\n⚠️ ${b} soal belum${totalPenalti > 0 ? `\n⏱️ Penalti: ${totalPenalti} kali` : ""}`, showCheckbox: true, checkboxLabel: "Saya yakin ingin mengakhiri ujian", buttons: [{ text: "Lanjutkan", type: "secondary" }, { text: "Ya, Selesai", type: "warning", onClick: c => { if (!c) { showError("Centang konfirmasi!"); return false; } selesaiUjian(); } }] }); }

async function selesaiUjian() {
    clearInterval(timerInterval); if (freezeInterval) clearInterval(freezeInterval); ujianSelesai = true;
    let t = 0, b = 0, tot = 0;
    dataSoal.forEach(s => { const j = jawabanLokal[s.id]; const bo = s.bobot || 1; tot += bo; if (!j) return;
        if (s.tipe === "PG") { if (j === s.kunci) { t += bo; b++; } }
        else if (s.tipe === "PGK") { try { if (JSON.stringify(JSON.parse(j).sort()) === JSON.stringify(JSON.parse(s.kunci).sort())) { t += bo; b++; } } catch (e) {} }
        else if (s.tipe === "B/S") { try { const ja = JSON.parse(j), ka = JSON.parse(s.kunci); let x = 0; for (let i = 0; i < ka.length; i++) if (ja[i] === ka[i]) x++; t += (x / ka.length) * bo; if (x === ka.length) b++; } catch (e) {} }
        else if (s.tipe === "Jodoh") { try { const jo = JSON.parse(j), ko = JSON.parse(s.kunci); let x = 0, tt = Object.keys(ko).length; for (let k in ko) if (jo[k] && jo[k].toUpperCase() === ko[k].toUpperCase()) x++; t += (x / tt) * bo; if (x === tt) b++; } catch (e) {} }
        else if (s.tipe === "Isian") { if (j.toLowerCase() === s.kunci.toLowerCase()) { t += bo; b++; } }
    });
    const p = tot > 0 ? (t / tot) * 100 : 0;
    if (document.exitFullscreen) document.exitFullscreen(); document.getElementById("freezeOverlay").style.display = "none";
    await fetch(CONFIG.PROXY_URL, { method: "POST", body: JSON.stringify({ action: "selesaiUjian", idSesi, username: currentUser.username, nis: currentUser.nis, nama: currentUser.nama, jenjang: currentUser.jenjang, kelas: currentUser.kelas, mapel: currentUjian.mapel, jenisUjian: currentUjian.jenis, totalSkor: t, jumlahBenar: b, jumlahSoal: dataSoal.length, ipAddress: "0.0.0.0" }) });
    showModal({ iconType: "success", title: "🎉 Ujian Selesai!", message: "", buttons: [{ text: "Tutup", type: "success", onClick: () => location.reload() }] });
    setTimeout(() => { document.querySelector(".modal-message").innerHTML = `<div class="score-summary"><div class="score-number">${t.toFixed(2)}</div><div class="score-label">Total Skor</div><div class="score-details"><div class="score-detail-item"><div class="score-detail-value">${b}/${dataSoal.length}</div><div class="score-detail-label">Soal Benar</div></div><div class="score-detail-item"><div class="score-detail-value">${p.toFixed(1)}%</div><div class="score-detail-label">Persentase</div></div></div>${totalPenalti > 0 ? `<p style="margin-top:16px; color:#fca5a5;">⚠️ Total pelanggaran: ${totalPenalti} kali</p>` : ""}</div><p>Jawaban Anda telah tersimpan.</p>`; }, 10);
}

// ==================== TAHUN FOOTER ====================
document.addEventListener('DOMContentLoaded', function() { const y = document.getElementById('currentYear'); if (y) y.textContent = new Date().getFullYear(); });
