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
let isLocked = false, debounceTimer = null;

// Jodoh
window.currentMatchingSoal = null;
window.currentMatchingJawaban = {};
window.hurufMapping = {};

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
function handleFullscreenChange() { if (!document.fullscreenElement) { if (currentUser && !ujianSelesai) { isFullscreen = false; catatPelanggaran("FULLSCREEN_EXIT", "Keluar fullscreen"); freezeScreen(60); showFullscreenPrompt(); } } else isFullscreen = true; }

// ==================== ANTI-CURANG ====================
window.addEventListener('pagehide', () => { isLocked = true; });
window.addEventListener('pageshow', () => { if (isLocked) { isLocked = false; } });
document.addEventListener("visibilitychange", () => {
    if (document.hidden && currentUser && !ujianSelesai && !isFrozen) {
        if (!isLocked) {
            catatPelanggaran("TAB_SWITCH", "Pindah tab/aplikasi");
            freezeScreen(60);
            document.getElementById("alertOverlay").style.display = "block";
            document.getElementById("alertSound").play();
            setTimeout(() => document.getElementById("alertOverlay").style.display = "none", 3000);
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
    const btn = document.querySelector(".btn-selesai-modern");
    if (!btn || !waktuMulaiServer) return;
    const sekarang = new Date();
    const menitBerlalu = Math.floor((sekarang - waktuMulaiServer) / 60000);
    const sisaMenit = Math.max(minimalMenit - menitBerlalu, 0);
    if (sisaMenit > 0 && !ujianSelesai) {
        tombolSelesaiAktif = false;
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-lock"></i> (${sisaMenit}m)`;
    } else {
        tombolSelesaiAktif = true;
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-check-circle"></i>`;
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

// ==================== LOAD JAWABAN ====================
async function loadJawabanDariServer() {
    if (!idSesi || !currentUser) return;
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/JAWABAN_SISWA!A:I?key=${CONFIG.API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        const rows = data.values || [];
        let loaded = 0;
        for (let i = 1; i < rows.length; i++) {
            if (rows[i][0] === idSesi) {
                jawabanLokal[rows[i][5]] = rows[i][6];
                loaded++;
            }
        }
        if (loaded > 0) { renderNavigator(); showToast(`${loaded} jawaban dimuat`, 'info', 2000); }
    } catch (e) { console.error('Gagal load:', e); }
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
    await loadJawabanDariServer();
    mulaiTimer(); renderNavigator(); showFullscreenPrompt();
    updateTombolSelesai(); setInterval(updateTombolSelesai, 1000);
    showSuccess(`Selamat datang, ${currentUser.nama || 'Siswa'}!`);
}

// ==================== ACAK URUTAN SOAL SAJA ====================
function shuffleArray(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function acakUrutanSoalSaja(soalList) {
    const soalTeracak = shuffleArray([...soalList]);
    return soalTeracak.map(soal => {
        return {
            ...soal,
            pilihan: soal.pilihan,
            kunci: soal.kunci,
            kunciAsli: soal.kunci
        };
    });
}

async function ambilSoal(j, m, js) {
    try {
        const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/BANK_SOAL!A:O?key=${CONFIG.API_KEY}`), d = await r.json(), rows = d.values || [];
        let soalMentah = [];
        for (let i = 1; i < rows.length; i++) {
            if (String(rows[i][1]).trim() === String(j).trim() && String(rows[i][2]).trim() === String(m).trim() && String(rows[i][3]).trim() === String(js).trim() && rows[i][13] === "Aktif") {
                soalMentah.push({ id: rows[i][0], tipe: rows[i][4], pertanyaan: rows[i][5], pilihan: [rows[i][6], rows[i][7], rows[i][8], rows[i][9], rows[i][10]].filter(p => p), kunci: rows[i][11], bobot: parseFloat(rows[i][12]) || 1, gambar: rows[i][14] || null });
            }
        }
        if (soalMentah.length === 0) { document.getElementById("soalContainer").innerHTML = "<p>Belum ada soal.</p>"; return; }
        dataSoal = acakUrutanSoalSaja(soalMentah);
        renderSoal(0);
    } catch (e) { console.error(e); }
}

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
function goToSoal(i) { if (isFrozen) return; renderSoal(i); renderNavigator(); if (window.innerWidth <= 500) document.getElementById("navPanel").classList.remove("show"); }

function renderSoal(idx) {
    indexSoal = idx; const s = dataSoal[idx];
    document.getElementById("progressFill").style.width = ((idx + 1) / dataSoal.length * 100) + "%";
    let h = `<h3>Soal ${idx + 1}/${dataSoal.length} [${s.tipe}]</h3>`;
    if (s.gambar) { let u = s.gambar; if (u.match(/^[a-zA-Z0-9_-]{20,}$/)) u = `https://drive.google.com/uc?export=view&id=${u}`; h += `<img src="${u}" style="max-width:100%;">`; }
    h += `<p><strong>${s.pertanyaan}</strong></p>`; const jaw = jawabanLokal[s.id];
    
    if (s.tipe === "PG") {
        s.pilihan.forEach((o, i) => { const hu = String.fromCharCode(65 + i); h += `<label class="option-label"><input type="radio" name="jwb" value="${hu}" ${jaw === hu ? "checked" : ""} ${isFrozen ? "disabled" : ""} onchange="autoSavePG('${s.id}')"> ${hu}. ${o}</label>`; });
        h += `<button class="btn-simpan" onclick="simpanPG('${s.id}')" ${isFrozen ? "disabled" : ""}><i class="fas fa-save"></i> Simpan</button>`;
    } else if (s.tipe === "PGK") {
        let a = []; try { a = JSON.parse(jaw || "[]"); } catch (e) {}
        s.pilihan.forEach((o, i) => { const hu = String.fromCharCode(65 + i); h += `<label class="option-label"><input type="checkbox" name="jwb" value="${hu}" ${a.includes(hu) ? "checked" : ""} ${isFrozen ? "disabled" : ""} onchange="autoSavePGK('${s.id}')"> ${hu}. ${o}</label>`; });
        h += `<button class="btn-simpan" onclick="simpanPGK('${s.id}')" ${isFrozen ? "disabled" : ""}><i class="fas fa-save"></i> Simpan</button>`;
    } else if (s.tipe === "B/S") {
        const pernyataan = s.pilihan.filter(p => p && p.trim() !== '');
        if (pernyataan.length === 0) {
            h += `<div style="background:#f8fafc; padding:16px; border-radius:12px; margin-bottom:16px;"><p>${s.pertanyaan}</p><div style="display:flex; gap:24px;"><label><input type="radio" name="bs_single" value="B" ${jaw === 'B' ? 'checked' : ''} onchange="autoSaveBSSingle('${s.id}')"> ✅ BENAR</label><label><input type="radio" name="bs_single" value="S" ${jaw === 'S' ? 'checked' : ''} onchange="autoSaveBSSingle('${s.id}')"> ❌ SALAH</label></div></div>`;
            h += `<button class="btn-simpan" onclick="simpanBSSingle('${s.id}')"><i class="fas fa-save"></i> Simpan</button>`;
        } else {
            let jawabanArr = []; try { if (jaw) jawabanArr = JSON.parse(jaw); } catch (e) { if (jaw === "B" || jaw === "S") jawabanArr = [jaw]; }
            pernyataan.forEach((teks, i) => {
                const jwb = jawabanArr[i] || '';
                h += `<div style="background:#f8fafc; padding:14px; border-radius:12px; margin-bottom:12px;"><p>${i + 1}. ${teks}</p><div style="display:flex; gap:20px;"><label><input type="radio" name="bs_${i}" value="B" ${jwb === 'B' ? 'checked' : ''} onchange="autoSaveBS('${s.id}', ${pernyataan.length})"> ✅ Benar</label><label><input type="radio" name="bs_${i}" value="S" ${jwb === 'S' ? 'checked' : ''} onchange="autoSaveBS('${s.id}', ${pernyataan.length})"> ❌ Salah</label></div></div>`;
            });
            h += `<button class="btn-simpan" onclick="simpanBS('${s.id}', ${pernyataan.length})"><i class="fas fa-save"></i> Simpan</button>`;
        }
    } else if (s.tipe === "Jodoh" || s.tipe === "JODOH") {
        let kunciObj = {}, jawabanObj = {};
        try { kunciObj = JSON.parse(s.kunci); jawabanObj = JSON.parse(jaw || "{}"); } catch(e) {}
        window.currentMatchingSoal = s; window.currentMatchingJawaban = jawabanObj;
        
        const opsiJawaban = s.pilihan.filter(p => p && p.trim());
        const hurufMapping = {}; opsiJawaban.forEach((opt, i) => { hurufMapping[String.fromCharCode(65 + i)] = opt; }); window.hurufMapping = hurufMapping;
        
        h += `<div style="margin-bottom:12px; padding:10px; background:#e8f0fe; border-radius:12px;"><p style="font-weight:600; color:#1E3A8A;"><i class="fas fa-info-circle"></i> Tarik jawaban dari KANAN ke istilah di KIRI.</p></div>`;
        h += `<div class="matching-jodoh-container" style="display:flex; gap:16px;">`;
        h += `<div style="flex:1; background:#FEF3C7; padding:12px; border-radius:16px;"><div style="font-weight:600; margin-bottom:12px; text-align:center;">🎯 ISTILAH</div>`;
        for (let key in kunciObj) {
            const isFilled = jawabanObj[key] !== undefined, huruf = jawabanObj[key] || '', teks = hurufMapping[huruf] || '';
            h += `<div class="matching-target ${isFilled ? 'filled' : 'empty'}" data-key="${key}" id="target_${key.replace(/[^a-zA-Z0-9]/g,'')}" style="background:white; padding:12px; border-radius:12px; margin-bottom:8px; border:2px dashed #D97706;"><div style="text-align:center;">${isFilled ? `<strong>${key}</strong><br><span style="color:#16a34a;">✅ ${huruf}. ${teks}</span>` : `<strong>${key}</strong><br><span style="color:#94a3b8;">⬅️ Tarik jawaban</span>`}</div></div>`;
        }
        h += `</div>`;
        h += `<div style="flex:1; background:#DBEAFE; padding:12px; border-radius:16px;"><div style="font-weight:600; margin-bottom:12px; text-align:center;">📦 JAWABAN (Tarik ke kiri)</div>`;
        opsiJawaban.forEach((opt, i) => {
            const huruf = String.fromCharCode(65 + i), isUsed = Object.values(jawabanObj).includes(huruf);
            if (!isUsed) h += `<div class="matching-item-right" draggable="true" data-huruf="${huruf}" id="drag_${huruf}" style="background:white; padding:12px; border-radius:12px; margin-bottom:8px; border:2px solid #1E3A8A; cursor:grab;"><strong style="color:#1E3A8A;">${huruf}.</strong> ${opt}</div>`;
            else h += `<div class="matching-item-right paired" draggable="false" id="drag_${huruf}" style="background:#DCFCE7; padding:12px; border-radius:12px; margin-bottom:8px; border:2px solid #22C55E;"><strong style="color:#1E3A8A;">${huruf}.</strong> ${opt} <span style="color:#16a34a;">✓</span></div>`;
        });
        h += `</div></div>`;
        h += `<div style="display:flex; gap:12px; margin-top:16px;"><button class="btn-reset-matching" onclick="resetMatching()" style="flex:1;"><i class="fas fa-undo"></i> Reset</button><button class="btn-simpan" onclick="simpanJodohDrag('${s.id}')" style="flex:1;"><i class="fas fa-save"></i> Simpan</button></div>`;
        setTimeout(() => initDragDropJodoh(), 50);
    } else if (s.tipe === "Isian") {
        h += `<input type="text" id="isian" value="${jaw || ''}" placeholder="Ketik jawaban..." style="width:100%;padding:14px;border-radius:16px;border:1px solid #E2E8F0;" ${isFrozen ? "disabled" : ""} oninput="debounceAutoSaveIsian('${s.id}')">`;
        h += `<button class="btn-simpan" onclick="simpanIsian('${s.id}')"><i class="fas fa-save"></i> Simpan</button>`;
    }
    document.getElementById("soalContainer").innerHTML = h;
}

// ==================== SIMPAN & AUTO-SAVE ====================
async function simpanKeServer(idSoal, jawaban, skor) { if (!idSesi || !currentUser) return; try { await fetch(CONFIG.PROXY_URL, { method: "POST", body: JSON.stringify({ action: "simpanJawaban", idSesi, username: currentUser.username, jenjang: currentUser.jenjang, mapel: currentUjian.mapel, jenisUjian: currentUjian.jenis, idSoal, jawaban, skor }) }); } catch (e) {} }
function autoSavePG(id) { const s = document.querySelector('input[name="jwb"]:checked'); if (!s) return; jawabanLokal[id] = s.value; renderNavigator(); const soal = dataSoal.find(q => q.id === id); simpanKeServer(id, s.value, s.value === soal.kunci ? soal.bobot : 0); showToast('Tersimpan', 'success', 800); }
function autoSavePGK(id) { const a = Array.from(document.querySelectorAll('input[name="jwb"]:checked')).map(c => c.value); if (a.length === 0) return; const jwb = JSON.stringify(a); jawabanLokal[id] = jwb; renderNavigator(); const soal = dataSoal.find(q => q.id === id); let s = 0; try { if (JSON.stringify(a.sort()) === JSON.stringify(JSON.parse(soal.kunci).sort())) s = soal.bobot; } catch (e) {} simpanKeServer(id, jwb, s); showToast('Tersimpan', 'success', 800); }
function autoSaveBSSingle(id) { const s = document.querySelector('input[name="bs_single"]:checked'); if (!s) return; jawabanLokal[id] = s.value; renderNavigator(); const soal = dataSoal.find(q => q.id === id); simpanKeServer(id, s.value, s.value === soal.kunci ? soal.bobot : 0); showToast('Tersimpan', 'success', 800); }
function autoSaveBS(id, n) { let semua = true; for (let i=0; i<n; i++) if (!document.querySelector(`input[name="bs_${i}"]:checked`)) { semua = false; break; } if (!semua) return; const a = []; for (let i=0; i<n; i++) a.push(document.querySelector(`input[name="bs_${i}"]:checked`).value); const jwb = JSON.stringify(a); jawabanLokal[id] = jwb; renderNavigator(); const soal = dataSoal.find(q => q.id === id); let s = 0; try { const k = JSON.parse(soal.kunci); let b = 0; for (let i=0; i<k.length; i++) if (a[i] === k[i]) b++; s = (b/k.length)*soal.bobot; } catch(e) {} simpanKeServer(id, jwb, s); showToast('Tersimpan', 'success', 800); }
function debounceAutoSaveIsian(id) { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => { const i = document.getElementById('isian'); if (!i || !i.value.trim()) return; const jwb = i.value.trim(); jawabanLokal[id] = jwb; renderNavigator(); const soal = dataSoal.find(q => q.id === id); simpanKeServer(id, jwb, jwb.toLowerCase() === soal.kunci.toLowerCase() ? soal.bobot : 0); showToast('Tersimpan', 'success', 800); }, 1000); }
function simpanPG(id) { autoSavePG(id); }
function simpanPGK(id) { autoSavePGK(id); }
function simpanBSSingle(id) { autoSaveBSSingle(id); }
function simpanBS(id, n) { autoSaveBS(id, n); }
function simpanJodohDrag(id) { const o = window.currentMatchingJawaban || {}, soal = window.currentMatchingSoal; let k = {}; try { k = JSON.parse(soal.kunci); } catch (e) {} if (Object.keys(o).length !== Object.keys(k).length) { showError("Pasangkan semua!"); return; } const jwb = JSON.stringify(o); jawabanLokal[id] = jwb; renderNavigator(); let s = 0; try { let b = 0; for (let key in k) if (o[key] === k[key]) b++; s = (b / Object.keys(k).length) * soal.bobot; } catch (e) {} simpanKeServer(id, jwb, s); showSuccess("Jawaban tersimpan!"); }
function simpanIsian(id) { debounceAutoSaveIsian(id); }
function prevSoal() { if (isFrozen) return; if (indexSoal > 0) goToSoal(indexSoal - 1); }
function nextSoal() { if (isFrozen) return; if (indexSoal < dataSoal.length - 1) goToSoal(indexSoal + 1); }

// ==================== DRAG & DROP JODOH ====================
function initDragDropJodoh() {
    document.querySelectorAll('.matching-item-right[draggable="true"]').forEach(i => { i.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', e.target.dataset.huruf); }); });
    document.querySelectorAll('.matching-target').forEach(t => { t.addEventListener('dragover', e => e.preventDefault()); t.addEventListener('drop', e => { e.preventDefault(); const tk = t.dataset.key, dk = e.dataTransfer.getData('text/plain'); if (!tk || !dk) return; if (window.currentMatchingJawaban[tk]) { showError('Sudah terisi!'); return; } if (Object.values(window.currentMatchingJawaban).includes(dk)) { showError('Jawaban sudah dipakai!'); return; } window.currentMatchingJawaban[tk] = dk; updateMatchingUIJodoh(); showSuccess('Dipasangkan!'); }); });
}
function updateMatchingUIJodoh() {
    const soal = window.currentMatchingSoal, jawabanObj = window.currentMatchingJawaban, hurufMapping = window.hurufMapping || {};
    let kunciObj = {}; try { kunciObj = JSON.parse(soal.kunci); } catch(e) {}
    for (let key in kunciObj) {
        const target = document.getElementById(`target_${key.replace(/[^a-zA-Z0-9]/g,'')}`);
        if (target) { const isFilled = jawabanObj[key] !== undefined, huruf = jawabanObj[key] || '', teks = hurufMapping[huruf] || ''; target.className = `matching-target ${isFilled ? 'filled' : 'empty'}`; target.style.background = isFilled ? '#DCFCE7' : 'white'; target.style.border = isFilled ? '2px solid #22C55E' : '2px dashed #D97706'; target.innerHTML = `<div style="text-align:center;">${isFilled ? `<strong>${key}</strong><br><span style="color:#16a34a;">✅ ${huruf}. ${teks}</span>` : `<strong>${key}</strong><br><span style="color:#94a3b8;">⬅️ Tarik jawaban</span>`}</div>`; }
    }
    const usedHuruf = Object.values(jawabanObj), opsiJawaban = soal.pilihan.filter(p => p && p.trim());
    opsiJawaban.forEach((opt, i) => {
        const huruf = String.fromCharCode(65 + i), dragItem = document.getElementById(`drag_${huruf}`);
        if (dragItem) { const isUsed = usedHuruf.includes(huruf); dragItem.className = `matching-item-right${isUsed ? ' paired' : ''}`; dragItem.setAttribute('draggable', !isUsed); dragItem.style.background = isUsed ? '#DCFCE7' : 'white'; dragItem.style.border = isUsed ? '2px solid #22C55E' : '2px solid #1E3A8A'; dragItem.innerHTML = `<strong style="color:#1E3A8A;">${huruf}.</strong> ${opt}${isUsed ? '<span style="color:#16a34a; margin-left:8px;">✓</span>' : ''}`; }
    });
    initDragDropJodoh();
}
function resetMatching() { window.currentMatchingJawaban = {}; renderSoal(indexSoal); showToast('Pasangan direset', 'info'); }

// ==================== TIMER & SELESAI ====================
function mulaiTimer() { if (!waktuSelesai) return; timerInterval = setInterval(() => { const s = Math.max(waktuSelesai - new Date(), 0), d = Math.floor(s / 1000), m = Math.floor(d / 60), sec = d % 60; document.getElementById("timerDisplay").innerText = `${m}:${sec < 10 ? "0" : ""}${sec}`; if (d === 0 && !ujianSelesai) { ujianSelesai = true; clearInterval(timerInterval); showModal({ iconType: "warning", title: "Waktu Habis", message: "Ujian akan otomatis berakhir.", buttons: [{ text: "OK", type: "primary", onClick: () => selesaiUjian() }] }); } }, 1000); }
function konfirmasiSelesai() { if (isFrozen) return; if (!tombolSelesaiAktif) { const s = Math.max(minimalMenit - Math.floor((new Date() - waktuMulaiServer) / 60000), 0); showError(`Tunggu ${s} menit lagi!`); return; } const b = dataSoal.filter(s => !jawabanLokal[s.id]).length; showModal({ iconType: "warning", title: "Akhiri Ujian?", message: `📝 ${dataSoal.length - b} soal dijawab\n⚠️ ${b} soal belum`, showCheckbox: true, checkboxLabel: "Saya yakin ingin mengakhiri ujian", buttons: [{ text: "Lanjutkan", type: "secondary" }, { text: "Ya, Selesai", type: "warning", onClick: c => { if (!c) { showError("Centang konfirmasi!"); return false; } selesaiUjian(); } }] }); }

async function selesaiUjian() {
    clearInterval(timerInterval); if (freezeInterval) clearInterval(freezeInterval); ujianSelesai = true;
    let t = 0, b = 0, tot = 0;
    dataSoal.forEach(s => { const j = jawabanLokal[s.id]; const bo = s.bobot || 1; tot += bo; if (!j) return;
        if (s.tipe === "PG") { if (j === s.kunci) { t += bo; b++; } }
        else if (s.tipe === "PGK") { try { if (JSON.stringify(JSON.parse(j).sort()) === JSON.stringify(JSON.parse(s.kunci).sort())) { t += bo; b++; } } catch (e) {} }
        else if (s.tipe === "B/S") { try { const ja = JSON.parse(j), ka = JSON.parse(s.kunci); let x = 0; for (let i = 0; i < ka.length; i++) if (ja[i] === ka[i]) x++; t += (x / ka.length) * bo; if (x === ka.length) b++; } catch (e) { if (j === s.kunci) { t += bo; b++; } } }
        else if (s.tipe === "Jodoh") { try { const jo = JSON.parse(j), ko = JSON.parse(s.kunci); let x = 0, tt = Object.keys(ko).length; for (let k in ko) if (jo[k] === ko[k]) x++; t += (x / tt) * bo; if (x === tt) b++; } catch (e) {} }
        else if (s.tipe === "Isian") { if (j.toLowerCase() === s.kunci.toLowerCase()) { t += bo; b++; } }
    });
    const p = tot > 0 ? (t / tot) * 100 : 0;
    if (document.exitFullscreen) document.exitFullscreen(); document.getElementById("freezeOverlay").style.display = "none";
    await fetch(CONFIG.PROXY_URL, { method: "POST", body: JSON.stringify({ action: "selesaiUjian", idSesi, username: currentUser.username, nis: currentUser.nis, nama: currentUser.nama, jenjang: currentUser.jenjang, kelas: currentUser.kelas, mapel: currentUjian.mapel, jenisUjian: currentUjian.jenis, totalSkor: t, jumlahBenar: b, jumlahSoal: dataSoal.length, ipAddress: "0.0.0.0" }) });
    showModal({ iconType: "success", title: "🎉 Ujian Selesai!", message: "", buttons: [{ text: "Tutup", type: "success", onClick: () => location.reload() }] });
    setTimeout(() => { document.querySelector(".modal-message").innerHTML = `<div style="text-align:center;"><div style="font-size:48px; font-weight:800; color:#1E3A8A;">${t.toFixed(2)}</div><div>Total Skor</div><div style="display:flex; justify-content:center; gap:20px; margin-top:16px;"><div>${b}/${dataSoal.length} Benar</div><div>${p.toFixed(1)}%</div></div></div>`; }, 10);
}

// ==================== TAHUN FOOTER ====================
document.addEventListener('DOMContentLoaded', function() { const y = document.getElementById('currentYear'); if (y) y.textContent = new Date().getFullYear(); });
