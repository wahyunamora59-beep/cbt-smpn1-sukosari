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

// ==================== FULLSCREEN ====================
function enterFullscreen() { const e = document.documentElement; if (e.requestFullscreen) e.requestFullscreen(); else if (e.webkitRequestFullscreen) e.webkitRequestFullscreen(); isFullscreen = true; }
function showFullscreenPrompt() { showModal({ iconType: "info", title: "Mode Fullscreen Wajib", message: "Klik tombol di bawah untuk masuk fullscreen.", buttons: [{ text: "Masuk Fullscreen", type: "primary", onClick: () => enterFullscreen() }], onClose: () => { if (!isFullscreen) showFullscreenPrompt(); } }); }
document.addEventListener("fullscreenchange", handleFullscreenChange);
document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
function handleFullscreenChange() { if (!document.fullscreenElement && !document.webkitFullscreenElement) { if (currentUser && !ujianSelesai) { isFullscreen = false; catatPelanggaran("FULLSCREEN_EXIT", "Keluar fullscreen"); freezeScreen(60); showFullscreenPrompt(); } } else isFullscreen = true; }

// ==================== ANTI-CURANG ====================
document.addEventListener("visibilitychange", () => { if (document.hidden && currentUser && !ujianSelesai && !isFrozen) { catatPelanggaran("TAB_SWITCH", "Pindah tab"); freezeScreen(60); document.getElementById("alertOverlay").style.display = "block"; document.getElementById("alertSound").play(); setTimeout(() => document.getElementById("alertOverlay").style.display = "none", 3000); } });
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
        for (let i = 1; i < sRows.length; i++) if (sRows[i][2] === u) { siswa = { nis: sRows[i][0], nama: sRows[i][1], username: sRows[i][2], kelas: sRows[i][4], jenjang: sRows[i][5] }; break; }
        if (!siswa) { showError("Username tidak terdaftar!"); return; }
        
        const jR = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/JADWAL_UJIAN!A:J?key=${CONFIG.API_KEY}`), jD = await jR.json(), jRows = jD.values || [];
        let jadwal = null;
        for (let i = 1; i < jRows.length; i++) if (jRows[i][1] === tokenInfo.jenjang && jRows[i][2] === tokenInfo.mapel && jRows[i][3] === tokenInfo.jenis && jRows[i][9] === "Aktif") { jadwal = { mulai: jRows[i][5], selesai: jRows[i][6], min: parseInt(jRows[i][7]) || 0 }; break; }
        if (!jadwal) { showError("Jadwal tidak ditemukan!"); return; }
        if (!jadwal.mulai || !jadwal.selesai || !jadwal.mulai.includes(":")) { showError("Format waktu salah!"); return; }
        
        const now = new Date();
        const [hM, mM] = jadwal.mulai.split(":").map(n => parseInt(n));
        const [hS, mS] = jadwal.selesai.split(":").map(n => parseInt(n));
        const wS = new Date(); wS.setHours(hS, mS, 0, 0);
        if (now >= wS) { showError("Waktu ujian sudah berakhir!"); return; }
        
        pendingUser = siswa; pendingUjian = { ...tokenInfo, ...jadwal }; pendingWaktuSelesai = wS;
        document.getElementById("loginScreen").style.display = "none"; document.getElementById("confirmScreen").style.display = "block";
        document.getElementById("confirmNIS").textContent = siswa.nis; document.getElementById("confirmNama").textContent = siswa.nama;
        document.getElementById("confirmKelas").textContent = siswa.kelas; document.getElementById("confirmMapel").textContent = `${tokenInfo.mapel} - ${tokenInfo.jenis}`;
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
    currentUser = pendingUser; currentUjian = pendingUjian; waktuSelesai = pendingWaktuSelesai; minimalMenit = pendingUjian.min;
    waktuMulaiServer = new Date();
    try {
        const pR = await fetch(CONFIG.PROXY_URL, { method: "POST", body: JSON.stringify({ action: "mulaiUjian", username: currentUser.username, token: document.getElementById("tokenInput").value.trim(), jenjang: currentUser.jenjang, mapel: currentUjian.mapel, jenisUjian: currentUjian.jenis, ipAddress: "0.0.0.0", device: /Mobile/.test(navigator.userAgent) ? "Mobile" : "Desktop" }) });
        const pD = await pR.json(); if (!pD.success) { showError(pD.msg); cancelConfirm(); return; } idSesi = pD.idSesi;
    } catch (e) {}
    document.getElementById("confirmScreen").style.display = "none"; document.getElementById("examScreen").style.display = "block";
    document.getElementById("namaDisplay").innerText = `${currentUser.nama} | ${currentUser.kelas}`;
    document.getElementById("infoDisplay").innerText = `${currentUjian.mapel} - ${currentUjian.jenis}`;
    await ambilSoal(currentUser.jenjang, currentUjian.mapel, currentUjian.jenis);
    mulaiTimer(); renderNavigator(); showFullscreenPrompt();
    updateTombolSelesai(); setInterval(updateTombolSelesai, 1000);
    showSuccess(`Selamat datang, ${currentUser.nama}!`);
}

// ==================== AMBIL SOAL ====================
async function ambilSoal(j, m, js) {
    try {
        const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/BANK_SOAL!A:O?key=${CONFIG.API_KEY}`), d = await r.json(), rows = d.values || [];
        dataSoal = [];
        for (let i = 1; i < rows.length; i++) {
            if (rows[i][1] === j && rows[i][2] === m && rows[i][3] === js && rows[i][13] === "Aktif") {
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
    document.getElementById("navGrid").innerHTML = h;
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
        h += `<button class="btn-simpan" onclick="simpanPG('${s.id}')" ${isFrozen ? "disabled" : ""}>Simpan</button>`;
    } else if (s.tipe === "PGK") {
        let a = []; try { a = JSON.parse(jaw || "[]"); } catch (e) { }
        s.pilihan.forEach((o, i) => { const hu = String.fromCharCode(65 + i); h += `<label class="option-label"><input type="checkbox" name="jwb" value="${hu}" ${a.includes(hu) ? "checked" : ""} ${isFrozen ? "disabled" : ""}> ${hu}. ${o}</label>`; });
        h += `<button class="btn-simpan" onclick="simpanPGK('${s.id}')" ${isFrozen ? "disabled" : ""}>Simpan</button>`;
    } else if (s.tipe === "B/S") {
        const p = s.pilihan, a = jaw ? JSON.parse(jaw) : [];
        p.forEach((t, i) => { h += `<div style="background:#f8fafc;padding:12px;border-radius:12px;margin-bottom:12px;"><p>${i + 1}. ${t}</p><label style="margin-right:20px;"><input type="radio" name="bs_${i}" value="B" ${a[i] === "B" ? "checked" : ""} ${isFrozen ? "disabled" : ""}> Benar</label><label><input type="radio" name="bs_${i}" value="S" ${a[i] === "S" ? "checked" : ""} ${isFrozen ? "disabled" : ""}> Salah</label></div>`; });
        h += `<button class="btn-simpan" onclick="simpanBS('${s.id}',${p.length})" ${isFrozen ? "disabled" : ""}>Simpan</button>`;
    } else if (s.tipe === "Jodoh") {
        let k = {}; try { k = JSON.parse(s.kunci); } catch (e) { }
        let o = {}; try { o = JSON.parse(jaw || "{}"); } catch (e) { }
        h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">`;
        for (let key in k) { h += `<div>${key}</div><div><input type="text" id="jodoh_${key.replace(/\s/g, '')}" value="${o[key] || ''}" placeholder="A/B/C/D" class="jodoh-input" ${isFrozen ? "disabled" : ""}></div>`; }
        h += `</div><button class="btn-simpan" onclick="simpanJodoh('${s.id}','${s.kunci.replace(/"/g, "&quot;")}')" ${isFrozen ? "disabled" : ""}>Simpan</button>`;
    } else if (s.tipe === "Isian") {
        h += `<input type="text" id="isian" value="${jaw || ''}" placeholder="Ketik jawaban..." style="width:100%;padding:14px;border-radius:16px;border:1px solid #e2e8f0;" ${isFrozen ? "disabled" : ""}>`;
        h += `<button class="btn-simpan" onclick="simpanIsian('${s.id}')" ${isFrozen ? "disabled" : ""}>Simpan</button>`;
    }
    document.getElementById("soalContainer").innerHTML = h;
}

function simpanPG(id) { if (isFrozen) return; const s = document.querySelector('input[name="jwb"]:checked'); if (!s) { showError("Pilih jawaban!"); return; } jawabanLokal[id] = s.value; renderNavigator(); showSuccess("Jawaban tersimpan!"); }
function simpanPGK(id) { if (isFrozen) return; const a = Array.from(document.querySelectorAll('input[name="jwb"]:checked')).map(c => c.value); if (a.length === 0) { showError("Pilih minimal satu!"); return; } jawabanLokal[id] = JSON.stringify(a); renderNavigator(); showSuccess("Jawaban tersimpan!"); }
function simpanBS(id, n) { if (isFrozen) return; const a = []; for (let i = 0; i < n; i++) { const s = document.querySelector(`input[name="bs_${i}"]:checked`); if (!s) { showError("Jawab semua!"); return; } a.push(s.value); } jawabanLokal[id] = JSON.stringify(a); renderNavigator(); showSuccess("Jawaban tersimpan!"); }
function simpanJodoh(id, kunciStr) { if (isFrozen) return; const k = JSON.parse(kunciStr.replace(/&quot;/g, '"')), o = {}; for (let key in k) { const i = document.getElementById(`jodoh_${key.replace(/\s/g, '')}`); if (i) o[key] = i.value; } jawabanLokal[id] = JSON.stringify(o); renderNavigator(); showSuccess("Jawaban tersimpan!"); }
function simpanIsian(id) { if (isFrozen) return; const i = document.getElementById("isian"); if (!i.value.trim()) { showError("Isi jawaban!"); return; } jawabanLokal[id] = i.value.trim(); renderNavigator(); showSuccess("Jawaban tersimpan!"); }
function prevSoal() { if (isFrozen) return; if (indexSoal > 0) goToSoal(indexSoal - 1); }
function nextSoal() { if (isFrozen) return; if (indexSoal < dataSoal.length - 1) goToSoal(indexSoal + 1); }

// ==================== TIMER ====================
function mulaiTimer() {
    if (!waktuSelesai) return;
    timerInterval = setInterval(() => {
        const s = Math.max(waktuSelesai - new Date(), 0), d = Math.floor(s / 1000), m = Math.floor(d / 60), sec = d % 60;
        document.getElementById("timerDisplay").innerText = `${m}:${sec < 10 ? "0" : ""}${sec}`;
        if (d === 0 && !ujianSelesai) { ujianSelesai = true; clearInterval(timerInterval); showModal({ iconType: "warning", title: "Waktu Habis", message: "Ujian akan otomatis berakhir.", buttons: [{ text: "OK", type: "primary", onClick: () => selesaiUjian() }] }); }
    }, 1000);
}

function konfirmasiSelesai() {
    if (isFrozen) return;
    if (!tombolSelesaiAktif) { const sisa = Math.max(minimalMenit - Math.floor((new Date() - waktuMulaiServer) / 60000), 0); showError(`Tunggu ${sisa} menit lagi!`); return; }
    const belum = dataSoal.filter(s => !jawabanLokal[s.id]).length;
    showModal({ iconType: "warning", title: "Akhiri Ujian?", message: `📝 ${dataSoal.length - belum} soal dijawab\n⚠️ ${belum} soal belum${totalPenalti > 0 ? `\n⏱️ Penalti: ${totalPenalti} kali` : ""}`, showCheckbox: true, checkboxLabel: "Saya yakin ingin mengakhiri ujian", buttons: [{ text: "Lanjutkan", type: "secondary" }, { text: "Ya, Selesai", type: "warning", onClick: c => { if (!c) { showError("Centang konfirmasi!"); return false; } selesaiUjian(); } }] });
}

async function selesaiUjian() {
    clearInterval(timerInterval); if (freezeInterval) clearInterval(freezeInterval); ujianSelesai = true;
    let t = 0, b = 0;
    dataSoal.forEach(s => { const j = jawabanLokal[s.id]; if (!j) return;
        if (s.tipe === "PG") { if (j === s.kunci) { t += s.bobot; b++; } }
        else if (s.tipe === "PGK") { try { if (JSON.stringify(JSON.parse(j).sort()) === JSON.stringify(JSON.parse(s.kunci).sort())) { t += s.bobot; b++; } } catch (e) { } }
        else if (s.tipe === "B/S") { try { const ja = JSON.parse(j), ka = JSON.parse(s.kunci); let x = 0; for (let i = 0; i < ka.length; i++) if (ja[i] === ka[i]) x++; t += (x / ka.length) * s.bobot; if (x === ka.length) b++; } catch (e) { } }
        else if (s.tipe === "Jodoh") { try { const jo = JSON.parse(j), ko = JSON.parse(s.kunci); let x = 0, tot = Object.keys(ko).length; for (let k in ko) if (jo[k] && jo[k].toUpperCase() === ko[k].toUpperCase()) x++; t += (x / tot) * s.bobot; if (x === tot) b++; } catch (e) { } }
        else if (s.tipe === "Isian") { if (j.toLowerCase() === s.kunci.toLowerCase()) { t += s.bobot; b++; } }
    });
    if (document.exitFullscreen) document.exitFullscreen(); document.getElementById("freezeOverlay").style.display = "none";
    await fetch(CONFIG.PROXY_URL, { method: "POST", body: JSON.stringify({ action: "selesaiUjian", idSesi, username: currentUser.username, nis: currentUser.nis, nama: currentUser.nama, jenjang: currentUser.jenjang, kelas: currentUser.kelas, mapel: currentUjian.mapel, jenisUjian: currentUjian.jenis, totalSkor: t, jumlahBenar: b, jumlahSoal: dataSoal.length, ipAddress: "0.0.0.0" }) });
    const p = ((t / dataSoal.length) * 100).toFixed(1);
    showModal({ iconType: "success", title: "🎉 Ujian Selesai!", message: "", buttons: [{ text: "Tutup", type: "success", onClick: () => location.reload() }] });
    setTimeout(() => { document.querySelector(".modal-message").innerHTML = `<div class="score-summary"><div class="score-number">${t.toFixed(2)}</div><div class="score-label">Total Skor</div><div class="score-details"><div class="score-detail-item"><div class="score-detail-value">${b}/${dataSoal.length}</div><div class="score-detail-label">Soal Benar</div></div><div class="score-detail-item"><div class="score-detail-value">${p}%</div><div class="score-detail-label">Persentase</div></div></div>${totalPenalti > 0 ? `<p style="margin-top:16px;color:#fca5a5;">⚠️ Total pelanggaran: ${totalPenalti} kali</p>` : ""}</div><p>Jawaban Anda telah tersimpan.</p>`; }, 10);
}

// ==================== SET TAHUN FOOTER ====================
document.addEventListener('DOMContentLoaded', function() {
    const yearSpan = document.getElementById('currentYear');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
});
