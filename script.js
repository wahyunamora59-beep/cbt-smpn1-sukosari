// ==================== KONFIGURASI ====================
const CONFIG = {
  SPREADSHEET_ID: "1zc5lh-8XWEhGYJajqooWGK3Vo89kqob1iAaIdaIiXc0",
  API_KEY: "AIzaSyAG16CaL_CwY6Hktj6nNrxCoPjYXcJZHcE",
};

// ==================== SERVER TIME SYNC ====================
let serverTimeOffset = 0;
let lastTimeSyncAt = 0;
let syncInFlight = false;

async function syncServerTime(force = false) {
  if (syncInFlight) return false;
  if (!force && Date.now() - lastTimeSyncAt < 30_000) return true;
  if (!window.db || !window.Firebase) return false;

  syncInFlight = true;
  try {
    const t0 = Date.now();
    const ref = await window.Firebase.addDoc(
      window.Firebase.collection(window.db, "server_time_ping"),
      { ts: window.Firebase.serverTimestamp(), clientTs: t0 },
    );
    for (let i = 0; i < 10; i++) {
      const snap = await window.Firebase.getDoc(ref);
      const data = snap.data();
      if (data.ts && typeof data.ts.toDate === "function") {
        const serverMs = data.ts.toDate().getTime();
        const t1 = Date.now();
        const rtt = t1 - t0;
        serverTimeOffset = serverMs - (t0 + Math.floor(rtt / 2));
        lastTimeSyncAt = t1;
        console.log(`✅ Server time synced. Offset: ${serverTimeOffset}ms, RTT: ${rtt}ms`);
        window.Firebase.deleteDoc(ref).catch(() => {});
        return true;
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    return false;
  } catch (e) {
    console.warn("⚠️ syncServerTime gagal:", e);
    return false;
  } finally {
    syncInFlight = false;
  }
}

function serverNow() {
  return Date.now() + serverTimeOffset;
}

setInterval(() => {
  if (currentUser && !ujianSelesai) syncServerTime();
}, 60_000);

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
  minimalMenit = 0,
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
  countdownInterval = null,
  isDragging = false,
  screenshotBlocked = false,
  lastVisibilityChangeTime = 0;

let loginGraceUntil = 0;

window.currentMatchingSoal = null;
window.currentMatchingJawaban = {};
window.hurufMapping = {};
window.skorPerSoal = {};
window.pelanggaranPerJenis = {};

// ==================== ANTI HISTORY INPUT ====================
function nonaktifkanAutocomplete() {
  const inputs = document.querySelectorAll(
    'input[type="text"], input[type="password"], input[type="email"], textarea',
  );
  inputs.forEach((el, i) => {
    el.setAttribute("autocomplete", "off");
    el.setAttribute("autocorrect", "off");
    el.setAttribute("autocapitalize", "off");
    el.setAttribute("spellcheck", "false");
    el.setAttribute("data-lpignore", "true");
    el.setAttribute("data-form-type", "other");
    if (!el.name || el.name === "isian") {
      el.setAttribute("name", `input_${Date.now()}_${i}`);
    }
  });
}

const inputObserver = new MutationObserver(() => nonaktifkanAutocomplete());
document.addEventListener("DOMContentLoaded", () => {
  nonaktifkanAutocomplete();
  inputObserver.observe(document.body, { childList: true, subtree: true });
});

// ==================== PENGATURAN PELANGGARAN ====================
let pengaturanPelanggaran = {};
let globalFreeze = 30;
let globalMaxPelanggaran = 5;

async function loadPengaturanPelanggaran() {
  try {
    const snap = await window.Firebase.getDocs(
      window.Firebase.collection(window.db, "pengaturan"),
    );
    snap.forEach((d) => {
      if (d.id === "pelanggaran") {
        const data = d.data();
        globalFreeze = data.globalFreeze || 30;
        globalMaxPelanggaran = data.globalMax || 5;
        pengaturanPelanggaran = data.items || {};
        freezeDuration = globalFreeze;
        maxPelanggaran = globalMaxPelanggaran;
      }
    });
  } catch (e) {
    console.warn("⚠️ Gagal load pengaturan:", e);
  }
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
function showToast(m, t = "info", d = 2000) {
  const c = document.getElementById("toastContainer");
  if (!c) return alert(m);
  const e = document.createElement("div");
  e.className = `toast ${t}`;
  e.innerHTML = `<i class="fas fa-${t === "success" ? "check-circle" : t === "error" ? "times-circle" : t === "warning" ? "exclamation-triangle" : "info-circle"}"></i> ${m}`;
  c.appendChild(e);
  setTimeout(() => {
    e.classList.add("hide");
    setTimeout(() => e.remove(), 300);
  }, d);
}
function showModal(o) {
  const v = document.getElementById("modalOverlay");
  if (!v) return alert(o.message);
  const {
    icon: i,
    iconType: t = "info",
    title: d,
    message: m,
    showCheckbox: s = false,
    checkboxLabel: c = "",
    buttons: b = [],
    onClose: l,
  } = o;
  document.getElementById("modalIcon").textContent =
    i || (t === "success" ? "✅" : t === "error" ? "❌" : t === "warning" ? "⚠️" : "ℹ️");
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
  b.forEach((n) => {
    const x = document.createElement("button");
    x.className = `modal-btn ${n.type || "secondary"}`;
    x.textContent = n.text;
    x.onclick = () => {
      if (n.onClick)
        n.onClick(s ? document.getElementById("modalCheckbox").checked : false);
      closeModal();
    };
    u.appendChild(x);
  });
  v.style.display = "flex";
  v.onclick = (e) => {
    if (e.target === v) {
      closeModal();
      if (l) l();
    }
  };
}
function closeModal() {
  document.getElementById("modalOverlay").style.display = "none";
}
function showSuccess(m) {
  showToast(m, "success");
}
function showError(m) {
  showToast(m, "error");
}

// ==================== FREEZE ====================
function freezeScreen(d = null) {
  if (isFrozen) return;
  if (d === 0) return;
  if (Date.now() < loginGraceUntil) return;
  isFrozen = true;
  const dur = d !== null ? d : freezeDuration;
  const o = document.getElementById("freezeOverlay"),
    t = document.getElementById("freezeTimer");
  o.style.display = "flex";
  let r = dur;
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
  const i = document.getElementById("passwordInput");
  if (i) {
    i.type = i.type === "password" ? "text" : "password";
    const icon = document.querySelector(".toggle-password-modern");
    if (icon)
      icon.className =
        i.type === "password"
          ? "fas fa-eye toggle-password-modern"
          : "fas fa-eye-slash toggle-password-modern";
  }
}
function toggleNav() {
  if (isFrozen) return;
  document.getElementById("navPanel").classList.toggle("show");
}
function toggleRagu() {
  if (isFrozen || !dataSoal[indexSoal]) return;
  raguLokal[dataSoal[indexSoal].id] = !raguLokal[dataSoal[indexSoal].id];
  renderNavigator();
  showToast(
    raguLokal[dataSoal[indexSoal].id] ? "Ditandai ragu" : "Tanda ragu dihapus",
    "info",
    1500,
  );
}
function updateNavInfo() {
  const t = dataSoal.length,
    j = Object.keys(jawabanLokal).length,
    e = document.getElementById("navInfo");
  if (e) e.textContent = `✅ ${j}/${t} terjawab`;
}

function parseTanggal(s) {
  if (!s) return null;
  s = String(s).trim();
  const p = s.split("-");
  if (p.length === 3)
    return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
  const p2 = s.split("/");
  if (p2.length === 3)
    return new Date(parseInt(p2[2]), parseInt(p2[1]) - 1, parseInt(p2[0]));
  return null;
}
function formatTanggal(d) {
  if (!d) return "";
  const t = new Date(d);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}
function parseWaktu(w, ref) {
  if (!w || !w.trim()) return null;
  const p = String(w).trim().split(":");
  if (p.length >= 2) {
    const t = ref ? new Date(ref) : new Date();
    t.setHours(parseInt(p[0]), parseInt(p[1]), 0, 0);
    return t;
  }
  return null;
}

// ==================== HELPER GAMBAR ====================
function konversiUrlGambar(input) {
  if (!input) return null;
  let u = String(input).trim();
  if (!u) return null;
  if (/^[a-zA-Z0-9_-]{20,}$/.test(u)) {
    return `https://drive.google.com/thumbnail?id=${u}&sz=w1000`;
  }
  const m = u.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m && m[1]) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000`;
  return u;
}
function openLightbox(src) {
  if (isFrozen) return;
  const lb = document.getElementById("gambarLightbox");
  const img = document.getElementById("gambarLightboxImg");
  if (!lb || !img) return;
  img.src = src;
  lb.classList.add("show");
}
function closeLightbox() {
  const lb = document.getElementById("gambarLightbox");
  if (lb) lb.classList.remove("show");
}
function handleGambarError(imgEl, url) {
  imgEl.outerHTML = `<div class="gambar-error"><i class="fas fa-image"></i> Gambar gagal dimuat.<br><a href="${url}" target="_blank" rel="noopener">Buka di tab baru</a></div>`;
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeLightbox();
});

// ==================== FULLSCREEN ====================
function enterFullscreen() {
  const e = document.documentElement;
  if (e.requestFullscreen) {
    e.requestFullscreen().catch(() => { isFullscreen = true; });
  } else if (e.webkitRequestFullscreen) {
    e.webkitRequestFullscreen();
    isFullscreen = true;
  } else {
    isFullscreen = true;
    showToast("📱 Mode ujian aktif!", "info", 2000);
  }
}
function showFullscreenPrompt() {
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    isFullscreen = true;
    return;
  }
  if (Date.now() < loginGraceUntil) {
    setTimeout(showFullscreenPrompt, 5000);
    return;
  }
  showModal({
    iconType: "info",
    title: "Mode Fullscreen Wajib",
    message: "Klik tombol di bawah untuk masuk fullscreen.",
    buttons: [{ text: "Masuk Fullscreen", type: "primary", onClick: () => enterFullscreen() }],
    onClose: () => { if (!isFullscreen) showFullscreenPrompt(); },
  });
}
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) {
    if (currentUser && !ujianSelesai) {
      isFullscreen = false;
      if (Date.now() < loginGraceUntil) return;
      catatPelanggaran("FULLSCREEN_EXIT", "Keluar fullscreen");
      if (isPelanggaranAktif("FULLSCREEN_EXIT")) {
        const dur = getFreezeDuration("FULLSCREEN_EXIT");
        if (dur > 0) freezeScreen(dur);
      }
      showFullscreenPrompt();
    }
  } else isFullscreen = true;
});

// ==================== ANTI-CURANG ====================
window.addEventListener("pagehide", () => { isLocked = true; });
window.addEventListener("pageshow", () => { if (isLocked) isLocked = false; });

document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (currentUser && !ujianSelesai && !isFrozen && isPelanggaranAktif("RIGHT_CLICK")) {
    catatPelanggaran("RIGHT_CLICK", "Klik kanan");
    const dur = getFreezeDuration("RIGHT_CLICK");
    if (dur > 0) freezeScreen(dur);
  }
});
document.addEventListener("selectstart", (e) => {
  if (currentUser && !ujianSelesai) e.preventDefault();
});
document.addEventListener("keydown", (e) => {
  if (!currentUser || ujianSelesai || isFrozen) return;
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
  if (e.key === "F11" || e.key === "Escape" || e.key === "PrintScreen") {
    e.preventDefault();
    if (e.key === "PrintScreen" && isPelanggaranAktif("PRINT_SCREEN")) {
      catatPelanggaran("PRINT_SCREEN", "Screenshot");
      const dur = getFreezeDuration("PRINT_SCREEN");
      if (dur > 0) freezeScreen(dur);
      showToast("🚫 Screenshot tidak diizinkan!", "error");
    }
    return false;
  }
  if (e.ctrlKey && ["w", "t", "n", "p", "c", "v", "a", "x"].includes(e.key.toLowerCase())) {
    e.preventDefault();
    if (isPelanggaranAktif("KEYBOARD")) {
      catatPelanggaran("KEYBOARD", `Ctrl+${e.key.toUpperCase()}`);
      showToast(`🚫 Ctrl+${e.key.toUpperCase()} dilarang!`, "warning");
      const dur = getFreezeDuration("KEYBOARD");
      if (dur > 0) freezeScreen(dur);
    }
    return false;
  }
});
window.addEventListener("beforeunload", (e) => {
  if (currentUser && !ujianSelesai) {
    e.preventDefault();
    e.returnValue = "";
  }
});

function catatPelanggaran(j, d) {
  if (!currentUser || ujianSelesai) return;
  if (Date.now() < loginGraceUntil) return;
  if (!isPelanggaranAktif(j)) return;
  pelanggaranCount++;
  totalPenalti++;
  if (!window.pelanggaranPerJenis) window.pelanggaranPerJenis = {};
  window.pelanggaranPerJenis[j] = (window.pelanggaranPerJenis[j] || 0) + 1;
  const maxJenis = getMaxPelanggaran(j);
  if (window.pelanggaranPerJenis[j] >= maxJenis && maxJenis > 0) {
    showModal({
      iconType: "error",
      title: "⛔ UJIAN DIBATALKAN",
      message: `${d} terdeteksi ${window.pelanggaranPerJenis[j]}x (maks: ${maxJenis}). Ujian diakhiri.`,
      buttons: [{ text: "OK", type: "primary", onClick: () => selesaiUjian() }],
    });
  }
}

// ==================== ANTI-FLOATING APPS ====================
let blurCount = 0,
  lastBlurTime = 0,
  lastWindowSize = { width: innerWidth, height: innerHeight },
  resizeTimer = null,
  touchStart = 0,
  touchCount = 0,
  devtoolsOpen = false,
  lastVisChange = 0;
const BLUR_COOLDOWN = 5000,
  DEV_THRESHOLD = 160,
  VIS_COOLDOWN = 3000;

window.addEventListener("blur", () => {
  if (!currentUser || ujianSelesai || isFrozen || isDragging) return;
  if (Date.now() < loginGraceUntil) return;
  if (!isPelanggaranAktif("WINDOW_BLUR")) return;
  const n = Date.now();
  if (n - lastBlurTime < BLUR_COOLDOWN) return;
  lastBlurTime = n;
  blurCount++;
  catatPelanggaran("WINDOW_BLUR", `Keluar (${blurCount})`);
  const dur = getFreezeDuration("WINDOW_BLUR");
  if (dur > 0) freezeScreen(dur);
  document.getElementById("alertOverlay").style.display = "block";
  document.getElementById("alertSound").play();
  showToast(`⚠️ Jangan buka aplikasi lain!`, "error", 5000);
  setTimeout(() => (document.getElementById("alertOverlay").style.display = "none"), 3000);
});
window.addEventListener("resize", () => {
  if (!currentUser || ujianSelesai || isFrozen) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const nW = innerWidth, nH = innerHeight;
    if (
      (Math.abs(nW - lastWindowSize.width) / lastWindowSize.width > 0.4 ||
        Math.abs(nH - lastWindowSize.height) / lastWindowSize.height > 0.4) &&
      isFullscreen && isPelanggaranAktif("RESIZE_DRASTIC")
    ) {
      catatPelanggaran("RESIZE_DRASTIC", "Ukuran drastis");
      showToast("⚠️ Perubahan mencurigakan!", "warning", 4000);
    }
    lastWindowSize = { width: nW, height: nH };
  }, 500);
});
document.addEventListener("mouseleave", (e) => {
  if (!currentUser || ujianSelesai || isFrozen || isDragging) return;
  if (!isPelanggaranAktif("MOUSE_LEAVE")) return;
  if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= innerWidth || e.clientY >= innerHeight) {
    const n = Date.now();
    if (n - lastBlurTime < BLUR_COOLDOWN) return;
    lastBlurTime = n;
    catatPelanggaran("MOUSE_LEAVE", "Kursor keluar");
    showToast("👆 Kursor keluar area!", "warning", 3000);
  }
});
document.addEventListener("touchstart", (e) => {
  if (!currentUser || ujianSelesai || isFrozen || isDragging) return;
  if (e.touches.length > 3 && isPelanggaranAktif("MULTI_TOUCH")) {
    catatPelanggaran("MULTI_TOUCH", `${e.touches.length} jari`);
    showToast(`⚠️ Multi-touch ${e.touches.length} jari!`, "warning", 3000);
  }
  const n = Date.now();
  if (n - touchStart < 100) {
    touchCount++;
    if (touchCount > 5 && isPelanggaranAktif("RAPID_TOUCH")) {
      catatPelanggaran("RAPID_TOUCH", "Sentuhan cepat");
      showToast("⚠️ Terlalu cepat!", "warning", 3000);
      touchCount = 0;
    }
  } else touchCount = 0;
  touchStart = n;
});
document.addEventListener("touchstart", function (e) {
  if (e.touches.length >= 3 && currentUser && !ujianSelesai && isPelanggaranAktif("SCREENSHOT_DETECT")) {
    e.preventDefault();
    showToast("🚫 Screenshot tidak diizinkan!", "error", 2000);
  }
}, { passive: false });

function detectDevTools() {
  if (!currentUser || ujianSelesai) return;
  if (!isPelanggaranAktif("DEVTOOLS_OPEN")) return;
  if ((outerWidth - innerWidth > DEV_THRESHOLD || outerHeight - innerHeight > DEV_THRESHOLD) && !devtoolsOpen) {
    devtoolsOpen = true;
    catatPelanggaran("DEVTOOLS_OPEN", "DevTools");
    const dur = getFreezeDuration("DEVTOOLS_OPEN");
    if (dur > 0) freezeScreen(dur);
    showToast("🚫 Developer tools!", "error", 5000);
  } else devtoolsOpen = false;
}
setInterval(detectDevTools, 1000);

document.addEventListener("visibilitychange", () => {
  if (document.hidden && currentUser && !ujianSelesai && !isFrozen) {
    if (Date.now() < loginGraceUntil) return;
    const n = Date.now();
    if (n - lastVisChange < VIS_COOLDOWN) return;
    lastVisChange = n;
    if (n - lastVisibilityChangeTime < 500 && isPelanggaranAktif("SCREENSHOT_DETECT")) {
      catatPelanggaran("SCREENSHOT_DETECT", "Kemungkinan screenshot");
      showToast("🚫 Screenshot terdeteksi!", "error", 3000);
    }
    lastVisibilityChangeTime = n;
    if (!isLocked && isPelanggaranAktif("TAB_SWITCH")) {
      catatPelanggaran("TAB_SWITCH", "Pindah tab");
      const dur = getFreezeDuration("TAB_SWITCH");
      if (dur > 0) freezeScreen(dur);
      document.getElementById("alertOverlay").style.display = "block";
      document.getElementById("alertSound").play();
      showToast("🚫 Jangan pindah tab!", "error", 4000);
      setTimeout(() => (document.getElementById("alertOverlay").style.display = "none"), 3000);
    }
  }
});

// ==================== UPDATE TOMBOL SELESAI ====================
function updateTombolSelesai() {
  const b = document.querySelector(".btn-selesai-modern");
  if (!b || !waktuMulaiServer) return;
  if (minimalMenit <= 0) {
    tombolSelesaiAktif = true;
    b.disabled = false;
    b.innerHTML = `<i class="fas fa-check-circle"></i> SELESAI`;
    return;
  }
  const m = Math.floor((serverNow() - waktuMulaiServer.getTime()) / 60000);
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
function parseIstilahDariPertanyaan(teks) {
  const map = {};
  let t = teks;
  ["BAGIAN B", "Bagian B", "Pilihan:", "Pilihan Jawaban:", "\nA.", "\nA)", "\nA ", "A. if", "A. "].forEach((m) => {
    const i = teks.indexOf(m);
    if (i !== -1) t = teks.substring(0, i);
  });
  const lines = t.split("\n");
  let cur = null;
  lines.forEach((l) => {
    l = l.trim();
    if (!l) return;
    const m = l.match(/^(\d+)\.\s+(.+)$/);
    if (m) {
      cur = m[1];
      map[cur] = m[2];
    } else if (cur) map[cur] += " " + l;
  });
  if (!Object.keys(map).length) {
    const r = /(\d+)\.\s*([^\n]+)/g;
    let m;
    while ((m = r.exec(t)) !== null) map[m[1]] = m[2].trim();
  }
  return map;
}

// ==================== LOGIN ====================
async function handleLogin() {
  const u = document.getElementById("usernameInput").value.trim(),
    p = document.getElementById("passwordInput").value.trim();
  if (!u) return showError("Isi username!");
  if (!p) return showError("Isi password!");
  try {
    await loadPengaturanPelanggaran();
    await syncServerTime(true);

    const coll = window.Firebase.collection(window.db, "cache_siswa");
    const q = window.Firebase.query(coll, window.Firebase.where("username", "==", u));
    const snap = await window.Firebase.getDocs(q);
    if (snap.empty) return showError("Username tidak terdaftar!");
    const data = snap.docs[0].data();
    if (data.password !== p) return showError("Password salah!");
    const siswa = {
      nis: data.nis, nama: data.nama, username: data.username,
      kelas: data.kelas, jenjang: data.jenjang,
    };
    document.getElementById("passwordInput").value = "";
    loginGraceUntil = Date.now() + 15000;
    console.log("🛡️ Grace period aktif 15 detik");
    pendingSiswa = siswa;
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("dashboardScreen").style.display = "block";
    document.getElementById("dashboardNama").textContent = siswa.nama;
    document.getElementById("dashboardNIS").textContent = siswa.nis;
    document.getElementById("dashboardKelas").textContent = siswa.kelas;
    await loadUjianAktif(siswa);
  } catch (e) {
    console.error(e);
    showError("Gagal terhubung.");
  }
}

// ==================== CEK RESET ====================
async function cekResetUjian(u, m, j) {
  try {
    const snap = await window.Firebase.getDocs(
      window.Firebase.collection(window.db, "cache_reset"),
    );
    for (const d of snap.docs) {
      const row = d.data();
      if (
        row.username === u &&
        (row.mapel === m || row.mapel === "*" || row.mapel === "SEMUA") &&
        (row.jenis === j || row.jenis === "*" || row.jenis === "SEMUA") &&
        row.reset === "YA"
      ) return true;
    }
  } catch (e) {}
  return false;
}

// ==================== LOAD UJIAN AKTIF ====================
async function loadUjianAktif(siswa) {
  const container = document.getElementById("ujianAktifList");
  try {
    const jadwalColl = window.Firebase.collection(window.db, "cache_jadwal");
    const jadwalQ = window.Firebase.query(
      jadwalColl,
      window.Firebase.where("jenjang", "==", siswa.jenjang),
      window.Firebase.where("status", "==", "Aktif"),
    );
    const jadwalSnap = await window.Firebase.getDocs(jadwalQ);
    const tokenColl = window.Firebase.collection(window.db, "cache_token");
    const tokenSnap = await window.Firebase.getDocs(tokenColl);
    const tokenMap = {};
    tokenSnap.forEach((d) => { tokenMap[d.data().token] = d.data(); });

    const now = new Date(serverNow()),
      hariIni = formatTanggal(now);
    daftarUjianAktif = [];

    for (const docSnap of jadwalSnap.docs) {
      const row = docSnap.data();
      const tgl = parseTanggal(row.tanggal);
      if (!tgl || formatTanggal(tgl) !== hariIni) continue;
      const tokenInfo = tokenMap[row.token];
      const mapelCek = tokenInfo?.mapel || row.mapel;
      const jenisCek = tokenInfo?.jenis || row.jenis;

      let statusWaktu = "tersedia", mulaiObj = null, selesaiObj = null;
      if (row.waktuMulai && row.waktuSelesai) {
        mulaiObj = parseWaktu(row.waktuMulai, tgl);
        selesaiObj = parseWaktu(row.waktuSelesai, tgl);
        if (mulaiObj && selesaiObj)
          statusWaktu = now < mulaiObj ? "belum_mulai" : now > selesaiObj ? "selesai" : "berlangsung";
      }
      let sudahSelesai = false, nilaiData = null;
      if (!(await cekResetUjian(siswa.username, mapelCek, jenisCek)) && window.db) {
        try {
          const q = window.Firebase.query(
            window.Firebase.collection(window.db, "nilai_akhir"),
            window.Firebase.where("username", "==", siswa.username),
            window.Firebase.where("mapel", "==", mapelCek),
            window.Firebase.where("jenisUjian", "==", jenisCek),
          );
          const snap = await window.Firebase.getDocs(q);
          if (!snap.empty) {
            sudahSelesai = true;
            nilaiData = snap.docs[0].data();
          }
        } catch (e) {}
      }
      daftarUjianAktif.push({
        token: row.token, mapel: mapelCek, jenis: jenisCek, tanggal: hariIni,
        waktuMulai: row.waktuMulai, waktuSelesai: row.waktuSelesai,
        waktuMulaiObj: mulaiObj, waktuSelesaiObj: selesaiObj,
        minimalMenit: row.minimalMenit || 0, statusWaktu, sudahSelesai, nilaiData,
        password: row.password || "",
      });
    }
    daftarUjianAktif.sort((a, b) => (a.statusWaktu === "berlangsung" ? -1 : 1));
    renderUjianList(daftarUjianAktif);
    startCountdown();
  } catch (e) {
    console.error(e);
    container.innerHTML = `<div class="ujian-empty"><i class="fas fa-exclamation-triangle"></i><h4>Gagal Memuat</h4></div>`;
  }
}

// ==================== RENDER UJIAN LIST ====================
function renderUjianList(list) {
  const container = document.getElementById("ujianAktifList");
  if (!list.length) {
    container.innerHTML = `<div class="ujian-empty"><i class="fas fa-calendar-times"></i><h4>Tidak Ada Ujian</h4></div>`;
    return;
  }
  let html = "";
  const now = new Date(serverNow());
  list.forEach((u, i) => {
    let status = "", cls = "", can = false, waktu = "";
    if (u.sudahSelesai) {
      status = `✅ Selesai | ${u.nilaiData?.totalSkor?.toFixed(0) || "0"}/${u.nilaiData?.totalBobot || "?"}`;
      cls = "status-selesai";
      waktu = `<span><i class="fas fa-check-circle"></i> Sudah dikerjakan</span>`;
    } else if (!u.waktuMulaiObj) {
      status = "📋 Tersedia"; cls = "status-berlangsung"; can = true;
      waktu = `<span><i class="fas fa-clock"></i> ${u.waktuMulai || "-"} - ${u.waktuSelesai || "-"}</span>`;
    } else if (now < u.waktuMulaiObj) {
      const d = Math.floor((u.waktuMulaiObj - now) / 1000);
      status = `⏰ Mulai <span class="countdown" data-i="${i}" data-type="mulai">${String(Math.floor(d / 3600)).padStart(2, "0")}:${String(Math.floor((d % 3600) / 60)).padStart(2, "0")}:${String(d % 60).padStart(2, "0")}</span>`;
      cls = "status-belum";
      waktu = `<span><i class="fas fa-clock"></i> ${u.waktuMulai} - ${u.waktuSelesai}</span>`;
    } else if (now > u.waktuSelesaiObj) {
      status = "❌ Berakhir"; cls = "status-selesai";
      waktu = `<span><i class="fas fa-clock"></i> ${u.waktuMulai} - ${u.waktuSelesai}</span>`;
    } else {
      const d = Math.floor((u.waktuSelesaiObj - now) / 1000);
      status = `🟢 Sisa <span class="countdown" data-i="${i}" data-type="selesai">${String(Math.floor(d / 3600)).padStart(2, "0")}:${String(Math.floor((d % 3600) / 60)).padStart(2, "0")}:${String(d % 60).padStart(2, "0")}</span>`;
      cls = "status-berlangsung"; can = true;
      waktu = `<span><i class="fas fa-hourglass-half"></i> ${u.waktuMulai} - ${u.waktuSelesai}</span>`;
    }
    html += `<div class="ujian-card" data-index="${i}" onclick="pilihUjian('${u.token}')"><div class="ujian-card-header"><div class="ujian-icon"><i class="fas fa-book-open"></i></div><div class="ujian-info"><h4>${u.mapel}</h4><div class="ujian-meta"><span><i class="fas fa-tag"></i> ${u.jenis}</span>${waktu}</div></div></div><div class="ujian-card-footer"><span class="ujian-status ${cls}">${status}</span><button class="btn-mulai" ${can ? "" : "disabled"} onclick="event.stopPropagation();pilihUjian('${u.token}')"><i class="fas fa-play"></i> Mulai</button></div></div>`;
  });
  container.innerHTML = html;
}

// ==================== COUNTDOWN ====================
function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);
  function update() {
    const now = new Date(serverNow());
    let render = false;
    daftarUjianAktif.forEach((u, i) => {
      if (u.sudahSelesai || !u.waktuMulaiObj) return;
      const card = document.querySelector(`.ujian-card[data-index="${i}"]`);
      if (!card) return;
      const span = card.querySelector(".ujian-status"), btn = card.querySelector(".btn-mulai");
      if (now < u.waktuMulaiObj) {
        const d = Math.floor((u.waktuMulaiObj - now) / 1000);
        const c = span?.querySelector(".countdown");
        if (c) c.textContent = `${String(Math.floor(d / 3600)).padStart(2, "0")}:${String(Math.floor((d % 3600) / 60)).padStart(2, "0")}:${String(d % 60).padStart(2, "0")}`;
      } else if (now > u.waktuSelesaiObj) {
        span.className = "ujian-status status-selesai";
        span.textContent = "❌ Berakhir";
        if (btn) btn.disabled = true;
        u.statusWaktu = "selesai";
      } else {
        const d = Math.floor((u.waktuSelesaiObj - now) / 1000);
        if (u.statusWaktu !== "berlangsung") {
          u.statusWaktu = "berlangsung";
          render = true;
        } else {
          const c = span?.querySelector(".countdown");
          if (c) c.textContent = `${String(Math.floor(d / 3600)).padStart(2, "0")}:${String(Math.floor((d % 3600) / 60)).padStart(2, "0")}:${String(d % 60).padStart(2, "0")}`;
        }
      }
    });
    if (render) renderUjianList(daftarUjianAktif);
  }
  countdownInterval = setInterval(update, 1000);
  update();
}

// ==================== PILIH UJIAN ====================
async function pilihUjian(token) {
  const u = daftarUjianAktif.find((x) => x.token === token);
  if (!u) return showError("Ujian tidak ditemukan!");
  if (u.sudahSelesai) return showError("Sudah selesai!");
  const now = new Date(serverNow());
  if (u.waktuMulaiObj && now < u.waktuMulaiObj) {
    return showError(`Belum mulai! Sisa ${Math.floor((u.waktuMulaiObj - now) / 60000)} menit.`);
  }
  if (u.waktuSelesaiObj && now > u.waktuSelesaiObj) return showError("Sudah berakhir!");
  if (u.password && u.password.trim() !== "") {
    const pw = prompt("🔐 Ujian ini terkunci. Masukkan password:");
    if (pw !== u.password) return showError("❌ Password salah!");
    showToast("✅ Password benar!", "success", 1000);
  }
  document.getElementById("tokenInput").value = token;
  await prosesUjianDipilih(u);
}

// ==================== PROSES UJIAN DIPILIH ====================
async function prosesUjianDipilih(u) {
  const siswa = pendingSiswa;
  try {
    const tokenColl = window.Firebase.collection(window.db, "cache_token");
    const tokenQ = window.Firebase.query(
      tokenColl,
      window.Firebase.where("token", "==", u.token),
      window.Firebase.where("status", "==", "Aktif"),
    );
    const tokenSnap = await window.Firebase.getDocs(tokenQ);
    if (tokenSnap.empty) return showError("Token tidak valid!");
    const info = tokenSnap.docs[0].data();
    if (info.jenjang !== siswa.jenjang) return showError(`Untuk kelas ${info.jenjang}!`);

    const jadwalColl = window.Firebase.collection(window.db, "cache_jadwal");
    const jadwalQ = window.Firebase.query(
      jadwalColl,
      window.Firebase.where("jenjang", "==", info.jenjang),
      window.Firebase.where("mapel", "==", info.mapel),
      window.Firebase.where("jenis", "==", info.jenis),
      window.Firebase.where("status", "==", "Aktif"),
    );
    const jadwalSnap = await window.Firebase.getDocs(jadwalQ);
    if (jadwalSnap.empty) return showError("Jadwal tidak ditemukan!");
    const jadwal = jadwalSnap.docs[0].data();

    const now = new Date(serverNow()), tgl = parseTanggal(jadwal.tanggal);
    if (formatTanggal(tgl) !== formatTanggal(now)) return showError(`Jadwal tanggal ${formatTanggal(tgl)}`);
    if (jadwal.waktuMulai) {
      const m = parseWaktu(jadwal.waktuMulai, tgl);
      if (m && now < m) return showError(`Belum mulai!`);
    }
    if (jadwal.waktuSelesai) {
      const s = parseWaktu(jadwal.waktuSelesai, tgl);
      if (s && now > s) return showError(`Sudah berakhir!`);
    }

    const wS = parseWaktu(jadwal.waktuSelesai, tgl) || new Date(serverNow());
    const jadwalLengkap = { ...info, ...jadwal, min: jadwal.minimalMenit || 0 };

    if (!(await cekResetUjian(siswa.username, info.mapel, info.jenis)) && window.db) {
      const sesiSnap = await window.Firebase.getDocs(
        window.Firebase.query(
          window.Firebase.collection(window.db, "sesi_ujian"),
          window.Firebase.where("username", "==", siswa.username),
          window.Firebase.where("status", "==", "Aktif"),
          window.Firebase.where("mapel", "==", info.mapel),
        ),
      );
      if (!sesiSnap.empty) {
        const sesi = sesiSnap.docs[0].data();
        sesi.idSesi = sesiSnap.docs[0].id;
        pendingUser = siswa;
        pendingUjian = jadwalLengkap;
        pendingWaktuSelesai = wS;
        pendingSesiAktif = sesi;
        clearInterval(countdownInterval);
        document.getElementById("dashboardScreen").style.display = "none";
        document.getElementById("resumeScreen").style.display = "block";
        document.getElementById("resumeMapel").textContent = info.mapel;
        document.getElementById("resumeJenis").textContent = info.jenis;
        const sisa = Math.max(Math.floor((wS - now) / 1000), 0);
        document.getElementById("resumeSisaWaktu").textContent = `${Math.floor(sisa / 3600)}j ${Math.floor((sisa % 3600) / 60)}m`;
        return;
      }
      const nilaiSnap = await window.Firebase.getDocs(
        window.Firebase.query(
          window.Firebase.collection(window.db, "nilai_akhir"),
          window.Firebase.where("username", "==", siswa.username),
          window.Firebase.where("mapel", "==", info.mapel),
          window.Firebase.where("jenisUjian", "==", info.jenis),
        ),
      );
      if (!nilaiSnap.empty) {
        const n = nilaiSnap.docs[0].data();
        showModal({
          iconType: "warning",
          title: "⏰ Sudah Selesai",
          message: `Nilai: ${n.totalSkor}/${n.totalBobot}`,
          buttons: [{ text: "OK", type: "primary" }],
        });
        return;
      }
    }

    clearInterval(countdownInterval);
    document.getElementById("dashboardScreen").style.display = "none";
    document.getElementById("confirmScreen").style.display = "block";
    pendingUser = siswa;
    pendingUjian = jadwalLengkap;
    pendingWaktuSelesai = wS;
    document.getElementById("confirmNIS").textContent = siswa.nis;
    document.getElementById("confirmNama").textContent = siswa.nama;
    document.getElementById("confirmKelas").textContent = siswa.kelas;
    document.getElementById("confirmMapel").textContent = `${info.mapel} - ${info.jenis}`;
    document.getElementById("confirmWaktu").textContent = `${jadwal.waktuMulai || "-"} - ${jadwal.waktuSelesai || "-"}`;
  } catch (e) {
    console.error(e);
    showError("Gagal memproses.");
  }
}

// ==================== LOGOUT & CANCEL ====================
function logoutToLogin() {
  clearInterval(countdownInterval);
  pendingSiswa = null;
  document.getElementById("dashboardScreen").style.display = "none";
  document.getElementById("loginScreen").style.display = "block";
  document.getElementById("usernameInput").value = document.getElementById("passwordInput").value = "";
}
function cancelConfirm() {
  document.getElementById("confirmScreen").style.display = "none";
  document.getElementById("dashboardScreen").style.display = "block";
  startCountdown();
}
function cancelResume() {
  if (!confirm("Hapus sesi?")) return;
  if (pendingSesiAktif && window.db)
    window.Firebase.addDoc(
      window.Firebase.collection(window.db, "sesi_ujian"),
      { ...pendingSesiAktif, status: "Dibatalkan" },
    );
  document.getElementById("resumeScreen").style.display = "none";
  document.getElementById("confirmScreen").style.display = "block";
  document.getElementById("confirmNIS").textContent = pendingUser.nis;
  document.getElementById("confirmNama").textContent = pendingUser.nama;
  document.getElementById("confirmKelas").textContent = pendingUser.kelas;
  document.getElementById("confirmMapel").textContent = `${pendingUjian.mapel} - ${pendingUjian.jenis}`;
  document.getElementById("confirmWaktu").textContent = `${pendingUjian.waktuMulai || pendingUjian.mulai || "-"} - ${pendingUjian.waktuSelesai || pendingUjian.selesai || "-"}`;
}

// ==================== CONTINUE EXAM (RESUME) ====================
async function continueExam() {
  if (!pendingUser || !pendingUjian || !pendingSesiAktif) return cancelResume();
  currentUser = pendingUser;
  currentUjian = pendingUjian;
  waktuSelesai = pendingWaktuSelesai;
  minimalMenit = pendingUjian.min || 0;
  idSesi = pendingSesiAktif.idSesi;

  const ts = pendingSesiAktif.waktuMulai;
  if (ts && typeof ts.toDate === "function") {
    waktuMulaiServer = ts.toDate();
  } else {
    waktuMulaiServer = new Date(ts);
  }

  try {
    const s = localStorage.getItem(`skor_${idSesi}`);
    window.skorPerSoal = s ? JSON.parse(s) : {};
  } catch (e) {
    window.skorPerSoal = {};
  }

  loginGraceUntil = Date.now() + 10000;
  document.getElementById("resumeScreen").style.display = "none";
  document.getElementById("examScreen").style.display = "block";
  document.getElementById("namaDisplay").innerText = `${currentUser.nama} | ${currentUser.kelas}`;
  document.getElementById("infoDisplay").innerText = `${currentUjian.mapel} - ${currentUjian.jenis}`;

  await ambilSoal(currentUser.jenjang, currentUjian.mapel, currentUjian.jenis);

  try {
    const saved = localStorage.getItem(`urutan_${idSesi}`);
    if (saved) {
      const order = JSON.parse(saved);
      const map = {};
      dataSoal.forEach((s) => { map[s.id] = s; });
      const restored = order.map((id) => map[id]).filter(Boolean);
      const idsInOrder = new Set(order);
      const sisa = dataSoal.filter((s) => !idsInOrder.has(s.id));
      dataSoal = [...restored, ...sisa];
    }
  } catch (e) { console.warn("Gagal restore urutan:", e); }

  await loadJawabanDariFirebase();

  try {
    const pos = parseInt(localStorage.getItem(`posisi_${idSesi}`) || "0");
    if (pos > 0 && pos < dataSoal.length) indexSoal = pos;
  } catch (e) {}

  await syncServerTime(true);
  mulaiTimer();
  renderSoal(indexSoal);
  renderNavigator();
  showFullscreenPrompt();
  updateTombolSelesai();
  setInterval(updateTombolSelesai, 1000);
}

// ==================== START EXAM (BARU) ====================
async function startExam() {
  if (!pendingUser || !pendingUjian) return cancelConfirm();
  currentUser = pendingUser;
  currentUjian = pendingUjian;
  waktuSelesai = pendingWaktuSelesai;
  minimalMenit = pendingUjian.min || 0;
  idSesi = "SES-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
  window.skorPerSoal = {};
  localStorage.removeItem(`skor_${idSesi}`);

  loginGraceUntil = Date.now() + 10000;

  if (window.db) {
    try {
      const sesiRef = await window.Firebase.addDoc(
        window.Firebase.collection(window.db, "sesi_ujian"),
        {
          idSesi,
          username: currentUser.username,
          nis: currentUser.nis,
          nama: currentUser.nama,
          jenjang: currentUser.jenjang,
          kelas: currentUser.kelas,
          mapel: currentUjian.mapel,
          jenisUjian: currentUjian.jenis,
          waktuMulai: window.Firebase.serverTimestamp(),
          status: "Aktif",
          token: document.getElementById("tokenInput").value,
          totalSkorSementara: 0,
        },
      );
      const snap = await window.Firebase.getDoc(sesiRef);
      const ts = snap.data().waktuMulai;
      waktuMulaiServer = ts && ts.toDate ? ts.toDate() : new Date(serverNow());
      console.log("✅ waktuMulaiServer (server):", waktuMulaiServer);
    } catch (e) {
      console.warn("Gagal simpan sesi:", e);
      waktuMulaiServer = new Date(serverNow());
    }
  } else {
    waktuMulaiServer = new Date(serverNow());
  }

  document.getElementById("confirmScreen").style.display = "none";
  document.getElementById("examScreen").style.display = "block";
  document.getElementById("namaDisplay").innerText = `${currentUser.nama} | ${currentUser.kelas}`;
  document.getElementById("infoDisplay").innerText = `${currentUjian.mapel} - ${currentUjian.jenis}`;
  await ambilSoal(currentUser.jenjang, currentUjian.mapel, currentUjian.jenis);

  try {
    localStorage.setItem(`urutan_${idSesi}`, JSON.stringify(dataSoal.map((s) => s.id)));
    localStorage.setItem(`posisi_${idSesi}`, "0");
  } catch (e) {}

  await syncServerTime(true);
  mulaiTimer();
  renderNavigator();
  showFullscreenPrompt();
  updateTombolSelesai();
  setInterval(updateTombolSelesai, 1000);
}

// ==================== MULAI TIMER (SERVER TIME) ====================
function mulaiTimer() {
  if (timerInterval) clearInterval(timerInterval);
  const timerEl = document.querySelector(".timer-modern");
  if (!timerEl || !waktuSelesai) return;
  const selesaiMs = new Date(waktuSelesai).getTime();
  const tick = () => {
    if (ujianSelesai) return;
    const sisa = selesaiMs - serverNow();
    if (sisa <= 0) {
      timerEl.textContent = "⏰ 00:00:00";
      timerEl.style.background = "#fee2e2";
      timerEl.style.color = "#dc2626";
      clearInterval(timerInterval);
      showToast("⏰ Waktu habis!", "error", 5000);
      if (typeof selesaiUjian === "function") selesaiUjian(true);
      return;
    }
    const h = Math.floor(sisa / 3600000);
    const m = Math.floor((sisa % 3600000) / 60000);
    const s = Math.floor((sisa % 60000) / 1000);
    timerEl.textContent = `⏰ ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    if (sisa < 60_000) {
      timerEl.style.background = "#fee2e2";
      timerEl.style.color = "#dc2626";
    } else if (sisa < 5 * 60_000) {
      timerEl.style.background = "#fef3c7";
      timerEl.style.color = "#d97706";
    }
  };
  tick();
  timerInterval = setInterval(tick, 1000);
}

// ==================== LOAD JAWABAN ====================
async function loadJawabanDariFirebase() {
  if (!window.db || !idSesi) return;
  try {
    const snap = await window.Firebase.getDocs(
      window.Firebase.query(
        window.Firebase.collection(window.db, "jawaban_siswa"),
        window.Firebase.where("idSesi", "==", idSesi),
      ),
    );
    jawabanLokal = {};
    snap.forEach((d) => {
      const data = d.data();
      if (data.idSoal && data.jawaban !== undefined) jawabanLokal[data.idSoal] = data.jawaban;
    });
    if (snap.size) renderNavigator();
  } catch (e) {
    console.warn("Gagal load jawaban:", e);
  }
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
  l.forEach((s) => {
    if (s.grupSoal) {
      const n = s.grupSoal.trim();
      if (!g[n]) g[n] = [];
      g[n].push(s);
    } else t.push(s);
  });
  const b = Object.values(g), semua = [...b, ...t.map((s) => [s])], acak = shuffleArray(semua), hasil = [];
  acak.forEach((block) => block.forEach((s) => hasil.push(s)));
  return hasil;
}
async function ambilSoal(j, m, js) {
  try {
    const coll = window.Firebase.collection(window.db, "cache_soal");
    const q = window.Firebase.query(
      coll,
      window.Firebase.where("jenjang", "==", String(j)),
      window.Firebase.where("mapel", "==", String(m)),
      window.Firebase.where("jenis", "==", String(js)),
      window.Firebase.where("status", "==", "Aktif"),
    );
    const snap = await window.Firebase.getDocs(q);
    let mentah = [];
    snap.forEach((d) => {
      const row = d.data();
      mentah.push({
        id: row.id, tipe: row.tipe, pertanyaan: row.pertanyaan,
        pilihan: [row.pilihanA, row.pilihanB, row.pilihanC, row.pilihanD, row.pilihanE].filter((p) => p),
        kunci: row.kunci, bobot: row.bobot, gambar: row.gambar, grupSoal: row.grupSoal,
      });
    });
    if (!mentah.length) {
      document.getElementById("soalContainer").innerHTML = "<p>Belum ada soal.</p>";
      return;
    }
    dataSoal = acakSoalDenganGrup(mentah);
    renderSoal(0);
  } catch (e) {
    console.error(e);
  }
}

// ==================== RENDER NAVIGASI ====================
function renderNavigator() {
  let h = "";
  for (let i = 0; i < dataSoal.length; i++) {
    const s = dataSoal[i], a = jawabanLokal[s.id] !== undefined, r = raguLokal[s.id], c = i === indexSoal;
    let cls = a ? "answered" : "unanswered";
    if (r && !c) cls = "ragu";
    if (c) cls = "current";
    h += `<button class="nav-btn-num ${cls}" onclick="goToSoal(${i})">${i + 1}</button>`;
  }
  document.getElementById("navGrid").innerHTML = h;
  updateNavInfo();
}
function goToSoal(i) {
  if (isFrozen) return;
  indexSoal = i;
  renderSoal(i);
  renderNavigator();
  if (idSesi) {
    try { localStorage.setItem(`posisi_${idSesi}`, String(i)); } catch (e) {}
  }
  if (window.innerWidth <= 500) document.getElementById("navPanel").classList.remove("show");
}

// ==================== RENDER SOAL ====================
function renderSoal(idx) {
  indexSoal = idx;
  const s = dataSoal[idx];
  if (!s) return;
  document.getElementById("progressFill").style.width = ((idx + 1) / dataSoal.length) * 100 + "%";
  let h = `<h3>Soal ${idx + 1}/${dataSoal.length} [${s.tipe}]</h3>`;
  h += `<p><strong>${s.pertanyaan}</strong></p>`;

  if (s.gambar) {
    const urlGambar = konversiUrlGambar(s.gambar);
    if (urlGambar) {
      h += `<div class="gambar-soal-wrapper"><img src="${urlGambar}" class="gambar-soal" alt="Gambar soal ${idx + 1}" loading="lazy" onclick="openLightbox(this.src)" onload="this.classList.add('loaded')" onerror="handleGambarError(this, '${urlGambar}')"><span class="gambar-caption">Klik gambar untuk memperbesar</span></div>`;
    }
  }

  const jaw = jawabanLokal[s.id];

  if (s.tipe === "PG") {
    s.pilihan.forEach((o, i) => {
      const hu = String.fromCharCode(65 + i);
      h += `<label class="option-label"><input type="radio" name="jwb" value="${hu}" ${jaw === hu ? "checked" : ""} ${isFrozen ? "disabled" : ""} onchange="autoSavePG('${s.id}')"> ${hu}. ${o}</label>`;
    });
    h += `<button class="btn-simpan" onclick="simpanPG('${s.id}')" ${isFrozen ? "disabled" : ""}><i class="fas fa-save"></i> Simpan</button>`;
  } else if (s.tipe === "PGK") {
    let a = [];
    try { a = JSON.parse(jaw || "[]"); } catch (e) {}
    s.pilihan.forEach((o, i) => {
      const hu = String.fromCharCode(65 + i);
      h += `<label class="option-label"><input type="checkbox" name="jwb" value="${hu}" ${a.includes(hu) ? "checked" : ""} ${isFrozen ? "disabled" : ""} onchange="autoSavePGK('${s.id}')"> ${hu}. ${o}</label>`;
    });
    h += `<button class="btn-simpan" onclick="simpanPGK('${s.id}')" ${isFrozen ? "disabled" : ""}><i class="fas fa-save"></i> Simpan</button>`;
  } else if (s.tipe === "B/S") {
    const p = s.pilihan.filter((x) => x);
    if (!p.length) {
      h += `<div style="background:#f8fafc;padding:16px;border-radius:12px;"><p>${s.pertanyaan}</p><div style="display:flex;gap:24px;"><label><input type="radio" name="bs_single" value="B" ${jaw === "B" ? "checked" : ""} onchange="autoSaveBSSingle('${s.id}')"> ✅ BENAR</label><label><input type="radio" name="bs_single" value="S" ${jaw === "S" ? "checked" : ""} onchange="autoSaveBSSingle('${s.id}')"> ❌ SALAH</label></div></div>`;
      h += `<button class="btn-simpan" onclick="simpanBSSingle('${s.id}')"><i class="fas fa-save"></i> Simpan</button>`;
    } else {
      let a = [];
      try { a = jaw ? JSON.parse(jaw) : []; } catch (e) { a = jaw === "B" || jaw === "S" ? [jaw] : []; }
      p.forEach((t, i) => {
        const jwb = a[i] || "";
        h += `<div style="background:#f8fafc;padding:14px;border-radius:12px;margin-bottom:10px;"><p>${i + 1}. ${t}</p><div style="display:flex;gap:20px;"><label><input type="radio" name="bs_${i}" value="B" ${jwb === "B" ? "checked" : ""} onchange="autoSaveBS('${s.id}',${p.length})"> ✅ Benar</label><label><input type="radio" name="bs_${i}" value="S" ${jwb === "S" ? "checked" : ""} onchange="autoSaveBS('${s.id}',${p.length})"> ❌ Salah</label></div></div>`;
      });
      h += `<button class="btn-simpan" onclick="simpanBS('${s.id}',${p.length})"><i class="fas fa-save"></i> Simpan</button>`;
    }
  } else if (s.tipe === "Jodoh") {
    let k = {}, o = {};
    try { k = JSON.parse(s.kunci); o = jaw ? JSON.parse(jaw) : {}; } catch (e) { o = {}; }
    const istilahMap = parseIstilahDariPertanyaan(s.pertanyaan);
    const istilahList = Object.keys(istilahMap).length > 0 ? Object.keys(istilahMap) : Object.keys(k);
    const opsi = s.pilihan.filter((p) => p && p.trim());
    h += `<div style="background:#E8F0FE;padding:12px;border-radius:12px;margin-bottom:16px;"><p style="font-weight:600;color:#1E3A8A;margin:0;"><i class="fas fa-info-circle"></i> Pilih jawaban yang tepat untuk setiap istilah di bawah ini!</p></div>`;
    h += `<div style="display:flex;gap:12px;flex-wrap:wrap;">`;
    h += `<div style="flex:1;min-width:240px;background:#FFF9E6;padding:14px;border-radius:14px;border:2px solid #FDE68A;"><div style="font-weight:700;margin-bottom:10px;color:#92400E;">📋 DAFTAR ISTILAH</div>`;
    istilahList.forEach((key, idx) => {
      const namaIstilah = istilahMap[key] || key;
      const selected = o[key] || "";
      h += `<div style="background:white;padding:12px;border-radius:10px;margin-bottom:8px;border:2px solid #FDE68A;"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span style="font-weight:700;color:#1E3A8A;">${idx + 1}.</span><span style="font-weight:600;color:#1E293B;font-size:13px;flex:1;">${namaIstilah}</span><select id="jodoh_${s.id}_${key}" onchange="autoSaveJodohDropdown('${s.id}')" style="padding:8px;border-radius:8px;border:2px solid #E2E8F0;font-size:13px;" ${isFrozen ? "disabled" : ""}><option value="">-- Pilih --</option>`;
      opsi.forEach((opt, i) => {
        const hu = String.fromCharCode(65 + i);
        const usedByOther = Object.entries(o).some(([k2, v]) => k2 !== key && v === hu);
        h += `<option value="${hu}" ${selected === hu ? "selected" : ""} ${usedByOther ? "disabled" : ""}>${hu}. ${opt.replace(/^[A-E]\.\s*/, "")}${usedByOther ? " (dipakai)" : ""}</option>`;
      });
      h += `</select></div></div>`;
    });
    h += `</div><div style="flex:1;min-width:240px;background:#E8F4FD;padding:14px;border-radius:14px;border:2px solid #BFDBFE;"><div style="font-weight:700;margin-bottom:10px;color:#1E40AF;">📦 DAFTAR JAWABAN</div>`;
    opsi.forEach((opt, i) => {
      const hu = String.fromCharCode(65 + i);
      const isUsed = Object.values(o).includes(hu);
      h += `<div style="background:${isUsed ? "#DCFCE7" : "white"};padding:10px 12px;border-radius:8px;margin-bottom:6px;border:1px solid ${isUsed ? "#BBF7D0" : "#E2E8F0"};font-size:13px;"><strong style="color:#1E3A8A;">${hu}.</strong> ${opt.replace(/^[A-E]\.\s*/, "")}${isUsed ? " ✅" : ""}</div>`;
    });
    h += `</div></div>`;
    h += `<button class="btn-simpan" onclick="simpanJodohDropdown('${s.id}')" ${isFrozen ? "disabled" : ""} style="margin-top:12px;"><i class="fas fa-save"></i> Simpan Jawaban</button>`;
  } else if (s.tipe === "Isian") {
    const uniqueName = `isian_${s.id}_${Date.now()}`;
    h += `<input type="text" id="isian" name="${uniqueName}" value="${jaw || ""}" placeholder="Ketik jawaban..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-form-type="other" style="width:100%;padding:14px;border-radius:16px;border:1px solid #E2E8F0;" ${isFrozen ? "disabled" : ""} oninput="debounceAutoSaveIsian('${s.id}')">`;
    h += `<button class="btn-simpan" onclick="simpanIsian('${s.id}')"><i class="fas fa-save"></i> Simpan</button>`;
  }
  document.getElementById("soalContainer").innerHTML = h;
  setTimeout(nonaktifkanAutocomplete, 50);
}

// ==================== SIMPAN JAWABAN ====================
async function simpanJawabanKeFirebase(idSoal, jawaban, skor) {
  if (!window.db || !idSesi) return;
  try {
    const coll = window.Firebase.collection(window.db, "jawaban_siswa");
    const q = window.Firebase.query(
      coll,
      window.Firebase.where("idSesi", "==", idSesi),
      window.Firebase.where("idSoal", "==", idSoal),
    );
    const snap = await window.Firebase.getDocs(q);
    if (!snap.empty)
      await window.Firebase.updateDoc(snap.docs[0].ref, {
        jawaban, skor, timestamp: new Date().toISOString(),
      });
    else
      await window.Firebase.addDoc(coll, {
        idSesi, username: currentUser.username, nis: currentUser.nis,
        nama: currentUser.nama, jenjang: currentUser.jenjang, kelas: currentUser.kelas,
        mapel: currentUjian.mapel, jenisUjian: currentUjian.jenis,
        idSoal, jawaban, skor, timestamp: new Date().toISOString(),
      });
    const skorPerSoal = JSON.parse(localStorage.getItem(`skor_${idSesi}`) || "{}");
    const skorLama = skorPerSoal[idSoal] || 0;
    skorPerSoal[idSoal] = skor;
    localStorage.setItem(`skor_${idSesi}`, JSON.stringify(skorPerSoal));
    const sesiQ = window.Firebase.query(
      window.Firebase.collection(window.db, "sesi_ujian"),
      window.Firebase.where("idSesi", "==", idSesi),
    );
    const sesiSnap = await window.Firebase.getDocs(sesiQ);
    if (!sesiSnap.empty) {
      const old = sesiSnap.docs[0].data().totalSkorSementara || 0;
      await window.Firebase.updateDoc(sesiSnap.docs[0].ref, {
        totalSkorSementara: old - skorLama + skor,
      });
    }
  } catch (e) { console.warn("simpanJawabanKeFirebase:", e); }
}

function simpanKeLocalStorage() {
  if (idSesi) localStorage.setItem(`jawaban_${idSesi}`, JSON.stringify(jawabanLokal));
}
function autoSavePG(id) {
  const s = document.querySelector('input[name="jwb"]:checked');
  if (!s) return;
  jawabanLokal[id] = s.value;
  renderNavigator();
  simpanKeLocalStorage();
  const soal = dataSoal.find((q) => q.id === id);
  simpanJawabanKeFirebase(id, s.value, s.value === soal.kunci ? soal.bobot : 0);
  showToast("Tersimpan", "success", 800);
}
function autoSavePGK(id) {
  const a = Array.from(document.querySelectorAll('input[name="jwb"]:checked')).map((c) => c.value);
  if (!a.length) return;
  jawabanLokal[id] = JSON.stringify(a);
  renderNavigator();
  simpanKeLocalStorage();
  const soal = dataSoal.find((q) => q.id === id);
  let s = 0;
  try {
    const ja = [...a].sort();
    const ka = JSON.parse(soal.kunci).sort();
    if (ja.length === ka.length && ja.every((v, i) => v === ka[i])) s = soal.bobot;
  } catch (e) {}
  simpanJawabanKeFirebase(id, JSON.stringify(a), s);
  showToast("Tersimpan", "success", 800);
}
function autoSaveBSSingle(id) {
  const s = document.querySelector('input[name="bs_single"]:checked');
  if (!s) return;
  jawabanLokal[id] = s.value;
  renderNavigator();
  simpanKeLocalStorage();
  const soal = dataSoal.find((q) => q.id === id);
  simpanJawabanKeFirebase(id, s.value, s.value === soal.kunci ? soal.bobot : 0);
  showToast("Tersimpan", "success", 800);
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
  const soal = dataSoal.find((q) => q.id === id);
  let s = 0;
  try {
    const k = JSON.parse(soal.kunci);
    let b = 0;
    for (let i = 0; i < k.length; i++) if (a[i] === k[i]) b++;
    s = (b / k.length) * soal.bobot;
  } catch (e) {}
  simpanJawabanKeFirebase(id, JSON.stringify(a), s);
  showToast("Tersimpan", "success", 800);
}
function debounceAutoSaveIsian(id) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const i = document.getElementById("isian");
    if (!i?.value.trim()) return;
    jawabanLokal[id] = i.value.trim();
    renderNavigator();
    simpanKeLocalStorage();
    const soal = dataSoal.find((q) => q.id === id);
    let s = 0;
    if (soal.kunci.toLowerCase().replace(/\s+/g, " ").trim() === i.value.trim().toLowerCase().replace(/\s+/g, " ").trim())
      s = soal.bobot;
    simpanJawabanKeFirebase(id, i.value.trim(), s);
    showToast("Tersimpan", "success", 800);
  }, 1000);
}
function simpanPG(id) { autoSavePG(id); }
function simpanPGK(id) { autoSavePGK(id); }
function simpanBSSingle(id) { autoSaveBSSingle(id); }
function simpanBS(id, n) { autoSaveBS(id, n); }

function autoSaveJodohDropdown(id) {
  const soal = dataSoal.find((q) => q.id === id);
  if (!soal) return;
  let k = {};
  try { k = JSON.parse(soal.kunci); } catch (e) { return; }
  const o = {};
  let allFilled = true;
  const totalKey = Object.keys(k).length;
  Object.keys(k).forEach((key) => {
    const select = document.getElementById(`jodoh_${id}_${key}`);
    if (select && select.value) o[key] = select.value;
    else allFilled = false;
  });
  if (allFilled) {
    jawabanLokal[id] = JSON.stringify(o);
    renderNavigator();
    simpanKeLocalStorage();
    let benar = 0;
    for (let key in k) if (o[key] === k[key]) benar++;
    simpanJawabanKeFirebase(id, JSON.stringify(o), (benar / totalKey) * soal.bobot);
    showToast(`✅ Tersimpan otomatis! (${benar}/${totalKey} benar)`, "success", 1500);
  } else {
    showToast(`📝 ${Object.keys(o).length}/${totalKey} terjawab`, "info", 1000);
  }
}
function simpanJodohDropdown(id) {
  const soal = dataSoal.find((q) => q.id === id);
  if (!soal) return;
  let k = {};
  try { k = JSON.parse(soal.kunci); } catch (e) { return showError("Format kunci salah!"); }
  const o = {};
  const totalKey = Object.keys(k).length;
  Object.keys(k).forEach((key) => {
    const select = document.getElementById(`jodoh_${id}_${key}`);
    if (select && select.value) o[key] = select.value;
  });
  const filledKey = Object.keys(o).length;
  if (filledKey < totalKey) return showError(`Baru ${filledKey} dari ${totalKey} yang dijawab!`);
  jawabanLokal[id] = JSON.stringify(o);
  renderNavigator();
  simpanKeLocalStorage();
  let benar = 0;
  for (let key in k) if (o[key] === k[key]) benar++;
  simpanJawabanKeFirebase(id, JSON.stringify(o), (benar / totalKey) * soal.bobot);
  showSuccess(`✅ Jawaban tersimpan! (${benar}/${totalKey} benar)`);
}
function simpanIsian(id) {
  const i = document.getElementById("isian");
  if (!i?.value.trim()) return showError("Isi jawaban!");
  jawabanLokal[id] = i.value.trim();
  renderNavigator();
  simpanKeLocalStorage();
  const soal = dataSoal.find((q) => q.id === id);
  let s = 0;
  if (soal.kunci.toLowerCase().replace(/\s+/g, " ").trim() === i.value.trim().toLowerCase().replace(/\s+/g, " ").trim())
    s = soal.bobot;
  simpanJawabanKeFirebase(id, i.value.trim(), s);
  showSuccess("Tersimpan!");
}

// ==================== NAVIGASI SOAL ====================
function prevSoal() {
  if (isFrozen) return;
  if (indexSoal > 0) goToSoal(indexSoal - 1);
}
function nextSoal() {
  if (isFrozen) return;
  if (indexSoal < dataSoal.length - 1) goToSoal(indexSoal + 1);
}

// ==================== KONFIRMASI & SELESAI UJIAN ====================
function konfirmasiSelesai() {
  if (isFrozen) return;
  const belumDijawab = dataSoal.length - Object.keys(jawabanLokal).length;
  const belumRagu = Object.values(raguLokal).filter(Boolean).length;
  const pesan =
    belumDijawab > 0
      ? `Masih ada ${belumDijawab} soal belum dijawab${belumRagu ? ` dan ${belumRagu} soal ditandai ragu` : ""}. Yakin selesai?`
      : "Semua soal sudah dijawab. Yakin ingin menyelesaikan ujian?";
  showModal({
    iconType: belumDijawab > 0 ? "warning" : "success",
    title: belumDijawab > 0 ? "⚠️ Konfirmasi Selesai" : "✅ Konfirmasi Selesai",
    message: pesan,
    buttons: [
      { text: "Batal", type: "secondary" },
      {
        text: "Ya, Selesai",
        type: "primary",
        onClick: () => {
          if (!tombolSelesaiAktif) {
            showError(`Minimal mengerjakan ${minimalMenit} menit!`);
            return;
          }
          selesaiUjian(false);
        },
      },
    ],
  });
}

async function selesaiUjian(otomatis = false) {
  if (ujianSelesai) return;
  if (!otomatis && !tombolSelesaiAktif) {
    showError(`Minimal mengerjakan ${minimalMenit} menit!`);
    return;
  }
  ujianSelesai = true;
  if (timerInterval) clearInterval(timerInterval);

  try {
    let totalSkor = 0, totalBobot = 0;
    dataSoal.forEach((s) => {
      totalBobot += s.bobot || 0;
      const jw = jawabanLokal[s.id];
      if (jw === undefined || jw === "") return;
      let benar = false;
      if (s.tipe === "PG" || s.tipe === "B/S") benar = jw === s.kunci;
      else if (s.tipe === "PGK") {
        try {
          const ja = JSON.parse(jw).sort();
          const ka = JSON.parse(s.kunci).sort();
          benar = ja.length === ka.length && ja.every((v, i) => v === ka[i]);
        } catch (e) {}
      } else if (s.tipe === "Jodoh") {
        try {
          const jo = JSON.parse(jw);
          const ko = JSON.parse(s.kunci);
          const keys = Object.keys(ko);
          benar = keys.every((k) => jo[k] === ko[k]);
        } catch (e) {}
      } else if (s.tipe === "Isian") {
        benar =
          String(s.kunci).toLowerCase().replace(/\s+/g, " ").trim() ===
          String(jw).toLowerCase().replace(/\s+/g, " ").trim();
      }
      if (benar) totalSkor += s.bobot || 0;
    });

    if (window.db && idSesi) {
      try {
        const nilaiRef = await window.Firebase.addDoc(
          window.Firebase.collection(window.db, "nilai_akhir"),
          {
            username: currentUser.username,
            nis: currentUser.nis,
            nama: currentUser.nama,
            jenjang: currentUser.jenjang,
            kelas: currentUser.kelas,
            mapel: currentUjian.mapel,
            jenisUjian: currentUjian.jenis,
            idSesi,
            totalSkor,
            totalBobot,
            timestamp: window.Firebase.serverTimestamp(),
            otomatis,
          },
        );
        await window.Firebase.updateDoc(
          (await window.Firebase.getDocs(
            window.Firebase.query(
              window.Firebase.collection(window.db, "sesi_ujian"),
              window.Firebase.where("idSesi", "==", idSesi),
            ),
          )).docs[0].ref,
          {
            status: "Selesai",
            waktuSelesai: window.Firebase.serverTimestamp(),
            totalSkorSementara: totalSkor,
          },
        );
      } catch (e) {
        console.warn("Gagal simpan nilai:", e);
      }
    }

    try {
      localStorage.removeItem(`jawaban_${idSesi}`);
      localStorage.removeItem(`posisi_${idSesi}`);
      localStorage.removeItem(`urutan_${idSesi}`);
      localStorage.removeItem(`skor_${idSesi}`);
    } catch (e) {}

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    showModal({
      iconType: "success",
      title: otomatis ? "⏰ Waktu Habis" : "✅ Ujian Selesai",
      message: `Skor Anda: ${totalSkor.toFixed(0)} / ${totalBobot.toFixed(0)}`,
      buttons: [
        {
          text: "OK",
          type: "primary",
          onClick: () => {
            document.getElementById("examScreen").style.display = "none";
            document.getElementById("dashboardScreen").style.display = "block";
            setTimeout(() => location.reload(), 500);
          },
        },
      ],
    });
  } catch (e) {
    console.error(e);
    showError("Gagal menyelesaikan ujian.");
  }
}

// ==================== FITUR: REKAP JAWABAN + AUDIT (Admin) ====================
let _cacheRekapAdmin = [];

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnAdminRekap");
  if (!btn) return;

  let _adminKeys = "";
  document.addEventListener("keydown", (e) => {
    _adminKeys += e.key.toLowerCase();
    if (_adminKeys.length > 15) _adminKeys = _adminKeys.slice(-15);
    if (_adminKeys.includes("adminadmin")) {
      btn.style.display = "inline-block";
      _adminKeys = "";
    }
  });

  btn.addEventListener("click", bukaRekapAdmin);
  document.getElementById("btnTutupRekap")?.addEventListener("click", () => {
    document.getElementById("modalRekap").style.display = "none";
  });
  document.getElementById("btnTutupDetail")?.addEventListener("click", () => {
    document.getElementById("modalDetail").style.display = "none";
  });
  document.getElementById("btnMuatRekap")?.addEventListener("click", muatRekapAdmin);
  document.getElementById("btnExportCsv")?.addEventListener("click", exportCsvAdmin);
});

async function bukaRekapAdmin() {
  if (!window.db) return showError("Database belum siap.");
  document.getElementById("modalRekap").style.display = "flex";
  await muatOpsiFilterAdmin();
  await muatRekapAdmin();
}

async function muatOpsiFilterAdmin() {
  try {
    const selU = document.getElementById("filterUjian");
    const selK = document.getElementById("filterKelas");
    if (selU.options.length <= 1) {
      const snap = await window.Firebase.getDocs(window.Firebase.collection(window.db, "cache_jadwal"));
      const seen = new Set();
      snap.forEach((d) => {
        const r = d.data();
        const key = `${r.mapel || ""} - ${r.jenis || ""}`.trim();
        if (r.mapel && r.jenis && !seen.has(key)) {
          seen.add(key);
          const o = document.createElement("option");
          o.value = key; o.textContent = key;
          selU.appendChild(o);
        }
      });
    }
    if (selK.options.length <= 1) {
      const snap = await window.Firebase.getDocs(window.Firebase.collection(window.db, "cache_siswa"));
      const seenK = new Set();
      snap.forEach((d) => {
        const r = d.data();
        if (r.kelas && !seenK.has(r.kelas)) {
          seenK.add(r.kelas);
          const o = document.createElement("option");
          o.value = r.kelas; o.textContent = r.kelas;
          selK.appendChild(o);
        }
      });
    }
  } catch (e) { console.warn("Filter error:", e); }
}

async function muatRekapAdmin() {
  const fUjian = document.getElementById("filterUjian").value;
  const fKelas = document.getElementById("filterKelas").value;
  const body = document.getElementById("bodyRekap");
  body.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:20px;">Memuat…</td></tr>';

  try {
    const sesiSnap = await window.Firebase.getDocs(window.Firebase.collection(window.db, "sesi_ujian"));
    const nilaiSnap = await window.Firebase.getDocs(window.Firebase.collection(window.db, "nilai_akhir"));
    const nilaiMap = {};
    nilaiSnap.forEach((d) => {
      const r = d.data();
      nilaiMap[`${r.username}_${r.mapel}_${r.jenisUjian}`] = r;
    });
    const jawabSnap = await window.Firebase.getDocs(window.Firebase.collection(window.db, "jawaban_siswa"));
    const jawabPerSesi = {};
    jawabSnap.forEach((d) => {
      const r = d.data();
      if (!r.idSesi) return;
      if (!jawabPerSesi[r.idSesi]) jawabPerSesi[r.idSesi] = { count: 0, skor: 0 };
      jawabPerSesi[r.idSesi].count++;
      jawabPerSesi[r.idSesi].skor += r.skor || 0;
    });

    const grouped = {};
    sesiSnap.forEach((d) => {
      const r = d.data();
      if (!r.username || !r.mapel || !r.jenisUjian) return;
      const key = `${r.username}_${r.mapel}_${r.jenisUjian}`;
      const waktu = r.waktuMulai?.toDate ? r.waktuMulai.toDate().getTime() : new Date(r.waktuMulai).getTime();
      if (!grouped[key] || waktu > grouped[key]._waktuMs) grouped[key] = { ...r, _waktuMs: waktu, _docId: d.id };
    });

    let list = Object.values(grouped);
    if (fUjian) list = list.filter((r) => `${r.mapel} - ${r.jenisUjian}` === fUjian);
    if (fKelas) list = list.filter((r) => r.kelas === fKelas);

    _cacheRekapAdmin = list.map((r) => {
      const nilai = nilaiMap[`${r.username}_${r.mapel}_${r.jenisUjian}`];
      const jw = jawabPerSesi[r.idSesi] || { count: 0, skor: 0 };
      const mulai = r.waktuMulai?.toDate ? r.waktuMulai.toDate() : new Date(r.waktuMulai);
      const submit = nilai?.timestamp
        ? nilai.timestamp?.toDate ? nilai.timestamp.toDate() : new Date(nilai.timestamp)
        : null;
      const durasiMs = submit ? submit.getTime() - mulai.getTime() : null;
      return {
        siswa_id: r.username, nama: r.nama || r.username, kelas: r.kelas || "-",
        ujian: `${r.mapel} - ${r.jenisUjian}`,
        waktu_mulai: mulai, waktu_submit: submit, durasi_ms: durasiMs,
        jml_soal: nilai?.totalBobot ? Math.round(nilai.totalBobot) : null,
        jml_dijawab: jw.count,
        skor: nilai?.totalSkor ?? jw.skor,
        status_sesi: r.status || "-",
      };
    });

    renderRekapAdmin(_cacheRekapAdmin);
    renderRingkasanAuditAdmin(_cacheRekapAdmin);
  } catch (e) {
    console.error(e);
    body.innerHTML = `<tr><td colspan="12" style="color:red;text-align:center;padding:20px;">Gagal memuat: ${e.message}</td></tr>`;
  }
}

function fmtWaktuAdmin(d) {
  if (!d) return "-";
  try { return d.toLocaleString("id-ID", { hour12: false }); } catch { return String(d); }
}
function fmtDurasiAdmin(ms) {
  if (ms == null || isNaN(ms) || ms < 0) return "-";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 3600)}j ${Math.floor((s % 3600) / 60)}m ${s % 60}d`;
}

function renderRekapAdmin(list) {
  const body = document.getElementById("bodyRekap");
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:20px;">Tidak ada data.</td></tr>';
    return;
  }
  body.innerHTML = list.map((r, i) => {
    const anomali =
      !r.waktu_mulai || !r.waktu_submit ||
      (r.durasi_ms != null && r.durasi_ms < 0) ||
      (r.jml_soal && r.jml_dijawab < r.jml_soal * 0.5);
    return `
      <tr class="${anomali ? "row-anomali" : ""}">
        <td style="border:1px solid #e2e8f0;padding:6px;">${i + 1}</td>
        <td style="border:1px solid #e2e8f0;padding:6px;">${r.nama}</td>
        <td style="border:1px solid #e2e8f0;padding:6px;">${r.kelas}</td>
        <td style="border:1px solid #e2e8f0;padding:6px;">${r.ujian}</td>
        <td style="border:1px solid #e2e8f0;padding:6px;">${fmtWaktuAdmin(r.waktu_mulai)}</td>
        <td style="border:1px solid #e2e8f0;padding:6px;">${fmtWaktuAdmin(r.waktu_submit)}</td>
        <td style="border:1px solid #e2e8f0;padding:6px;">${fmtDurasiAdmin(r.durasi_ms)}</td>
        <td style="border:1px solid #e2e8f0;padding:6px;">${r.jml_soal ?? "-"}</td>
        <td style="border:1px solid #e2e8f0;padding:6px;">${r.jml_dijawab}</td>
        <td style="border:1px solid #e2e8f0;padding:6px;">${r.skor ?? "-"}</td>
        <td style="border:1px solid #e2e8f0;padding:6px;">${anomali ? '<span class="badge-warn">Perlu cek</span>' : '<span class="badge-ok">OK</span>'}</td>
        <td style="border:1px solid #e2e8f0;padding:6px;">
          <button onclick="lihatDetailAdmin('${r.siswa_id}','${r.ujian}')" style="padding:4px 10px;background:#0d6efd;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:11px;">🔍 Detail</button>
        </td>
      </tr>`;
  }).join("");
}

function renderRingkasanAuditAdmin(list) {
  let anomali = 0, tidakSubmit = 0, durasiLewat = 0;
  list.forEach((r) => {
    if (!r.waktu_submit) tidakSubmit++;
    if (!r.waktu_mulai || !r.waktu_submit || (r.durasi_ms != null && r.durasi_ms < 0)) anomali++;
    if (r.durasi_ms != null && r.durasi_ms > 24 * 3600 * 1000) durasiLewat++;
  });
  document.getElementById("ringkasanAudit").innerHTML = `
    <b>Ringkasan Audit</b><br>
    Total siswa: <b>${list.length}</b> &nbsp;|&nbsp;
    Tidak submit: <b>${tidakSubmit}</b> &nbsp;|&nbsp;
    Anomali waktu: <b>${anomali}</b> &nbsp;|&nbsp;
    Durasi > 24 jam: <b>${durasiLewat}</b>
    ${anomali || tidakSubmit ? '<br><span style="color:#b45309">⚠ Ada data yang perlu diperiksa.</span>' : '<br><span style="color:#198754">✅ Semua data tampak normal.</span>'}`;
}

window.lihatDetailAdmin = async function (username, ujianStr) {
  const [mapel, jenis] = ujianStr.split(" - ");
  const modal = document.getElementById("modalDetail");
  const judul = document.getElementById("detailJudul");
  const body = document.getElementById("detailBody");
  modal.style.display = "flex";
  judul.textContent = `Detail — ${username} (${ujianStr})`;
  body.innerHTML = "Memuat…";
  try {
    const sesiSnap = await window.Firebase.getDocs(
      window.Firebase.query(
        window.Firebase.collection(window.db, "sesi_ujian"),
        window.Firebase.where("username", "==", username),
        window.Firebase.where("mapel", "==", mapel),
        window.Firebase.where("jenisUjian", "==", jenis),
      ),
    );
    if (sesiSnap.empty) { body.innerHTML = "Tidak ada sesi tercatat."; return; }
    const sesi = sesiSnap.docs.map((d) => d.data()).sort((a, b) => {
      const wa = a.waktuMulai?.toDate ? a.waktuMulai.toDate() : new Date(a.waktuMulai);
      const wb = b.waktuMulai?.toDate ? b.waktuMulai.toDate() : new Date(b.waktuMulai);
      return wb - wa;
    })[0];

    const jawabSnap = await window.Firebase.getDocs(
      window.Firebase.query(
        window.Firebase.collection(window.db, "jawaban_siswa"),
        window.Firebase.where("idSesi", "==", sesi.idSesi),
      ),
    );
    if (jawabSnap.empty) { body.innerHTML = "Tidak ada jawaban tercatat."; return; }

    const rows = jawabSnap.docs.map((d) => d.data());
    const jmlDijawab = rows.filter((r) => r.jawaban != null && r.jawaban !== "").length;

    body.innerHTML = `
      <p style="color:${jmlDijawab === 0 ? "#b45309" : "#198754"};margin-bottom:10px;">
        ${jmlDijawab === rows.length ? "✅" : "⚠"} ${jmlDijawab} dari ${rows.length} soal dijawab.
      </p>
      <table class="detail-table">
        <thead><tr><th>No</th><th>ID Soal</th><th>Jawaban</th><th>Skor</th><th>Timestamp</th></tr></thead>
        <tbody>
          ${rows.map((r, i) => {
            const ts = r.timestamp?.toDate ? r.timestamp.toDate() : r.timestamp ? new Date(r.timestamp) : null;
            return `<tr><td>${i + 1}</td><td>${r.idSoal || "-"}</td><td>${r.jawaban || '<i style="color:#94a3b8">(kosong)</i>'}</td><td>${r.skor ?? 0}</td><td>${ts ? ts.toLocaleString("id-ID", { hour12: false }) : "-"}</td></tr>`;
          }).join("")}
        </tbody>
      </table>`;
  } catch (e) {
    console.error(e);
    body.innerHTML = `<span style="color:red">Gagal: ${e.message}</span>`;
  }
};

function exportCsvAdmin() {
  if (!_cacheRekapAdmin.length) return showError("Belum ada data.");
  const header = ["Nama","Kelas","Ujian","Mulai","Submit","Durasi(ms)","Jml Soal","Dijawab","Skor","Status"];
  const lines = _cacheRekapAdmin.map((r) => {
    const anomali = !r.waktu_mulai || !r.waktu_submit || (r.durasi_ms != null && r.durasi_ms < 0);
    return [
      r.nama, r.kelas, r.ujian,
      r.waktu_mulai ? r.waktu_mulai.toISOString() : "",
      r.waktu_submit ? r.waktu_submit.toISOString() : "",
      r.durasi_ms ?? "", r.jml_soal ?? "", r.jml_dijawab ?? "", r.skor ?? "",
      anomali ? "PERLU CEK" : "OK",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
  });
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `rekap-cbt-${Date.now()}.csv`;
  a.click();
}
