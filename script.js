// ==================== KONFIGURASI ====================
const CONFIG = {
    SPREADSHEET_ID: '1zc5lh-8XWEhGYJajqooWGK3Vo89kqob1iAaIdaIiXc0',
    API_KEY: 'AIzaSyAG16CaL_CwY6Hktj6nNrxCoPjYXcJZHcE',
    PROXY_URL: 'https://script.google.com/macros/s/AKfycbzCGEEaroaDG5juhDVl_8hSEMan_dN0CSGzTJEJ154peJjaZh3eUv5_BFiBNzmXJilu/exec'
};

// ==================== FUNGSI SEDERHANA ====================
function showToast(m, t = "info") {
    alert(m);
}

function showError(m) {
    alert("❌ " + m);
}

function showSuccess(m) {
    alert("✅ " + m);
}

function togglePassword() {
    const i = document.getElementById("tokenInput");
    i.type = i.type === "password" ? "text" : "password";
}

// ==================== LOGIN (VERSI DEBUG) ====================
async function handleLogin() {
    const username = document.getElementById("usernameInput").value.trim();
    const token = document.getElementById("tokenInput").value.trim();
    
    console.clear();
    console.log("=".repeat(50));
    console.log("🔍 MEMULAI LOGIN DEBUG");
    console.log("=".repeat(50));
    console.log("Username:", username);
    console.log("Token:", token);
    
    if (!username || !token) {
        console.log("❌ Username atau token kosong");
        showError("Isi username dan token!");
        return;
    }
    
    try {
        // ===== STEP 1: CEK TOKEN =====
        console.log("\n📡 STEP 1: Mengecek TOKEN_UJIAN...");
        const tokenUrl = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/TOKEN_UJIAN!A:H?key=${CONFIG.API_KEY}`;
        console.log("URL:", tokenUrl);
        
        const tokenRes = await fetch(tokenUrl);
        const tokenData = await tokenRes.json();
        
        if (tokenData.error) {
            console.log("❌ ERROR API:", tokenData.error);
            showError("Gagal baca sheet TOKEN_UJIAN: " + tokenData.error.message);
            return;
        }
        
        const tokenRows = tokenData.values || [];
        console.log("Jumlah baris token:", tokenRows.length);
        console.log("Header token:", tokenRows[0]);
        
        let tokenInfo = null;
        for (let i = 1; i < tokenRows.length; i++) {
            console.log(`Baris ${i}:`, tokenRows[i]);
            if (tokenRows[i][0] === token && tokenRows[i][5] === "Aktif") {
                tokenInfo = {
                    jenjang: tokenRows[i][1],
                    mapel: tokenRows[i][2],
                    jenis: tokenRows[i][3]
                };
                console.log("✅ TOKEN DITEMUKAN:", tokenInfo);
                break;
            }
        }
        
        if (!tokenInfo) {
            console.log("❌ Token tidak valid atau tidak aktif");
            showError("Token tidak valid!");
            return;
        }
        
        // ===== STEP 2: CEK SISWA =====
        console.log("\n📡 STEP 2: Mengecek DATA_SISWA...");
        const siswaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/DATA_SISWA!A:H?key=${CONFIG.API_KEY}`;
        console.log("URL:", siswaUrl);
        
        const siswaRes = await fetch(siswaUrl);
        const siswaData = await siswaRes.json();
        
        if (siswaData.error) {
            console.log("❌ ERROR API:", siswaData.error);
            showError("Gagal baca sheet DATA_SISWA: " + siswaData.error.message);
            return;
        }
        
        const siswaRows = siswaData.values || [];
        console.log("Jumlah baris siswa:", siswaRows.length);
        console.log("Header siswa:", siswaRows[0]);
        
        let siswa = null;
        for (let i = 1; i < siswaRows.length; i++) {
            console.log(`Baris ${i}:`, siswaRows[i]);
            if (siswaRows[i][2] === username) {
                siswa = {
                    nis: siswaRows[i][0],
                    nama: siswaRows[i][1],
                    username: siswaRows[i][2],
                    kelas: siswaRows[i][4],
                    jenjang: siswaRows[i][5]
                };
                console.log("✅ SISWA DITEMUKAN:", siswa);
                break;
            }
        }
        
        if (!siswa) {
            console.log("❌ Username tidak ditemukan");
            showError("Username tidak terdaftar!");
            return;
        }
        
        // ===== STEP 3: VALIDASI JENJANG =====
        console.log("\n📡 STEP 3: Validasi Jenjang...");
        console.log("Jenjang Siswa:", siswa.jenjang, "(Tipe:", typeof siswa.jenjang + ")");
        console.log("Jenjang Token:", tokenInfo.jenjang, "(Tipe:", typeof tokenInfo.jenjang + ")");
        
        if (String(siswa.jenjang).trim() !== String(tokenInfo.jenjang).trim()) {
            console.log("❌ Jenjang tidak cocok!");
            showError(`Token ini untuk jenjang ${tokenInfo.jenjang}, bukan ${siswa.jenjang}`);
            return;
        }
        console.log("✅ Jenjang cocok!");
        
        // ===== STEP 4: CEK JADWAL =====
        console.log("\n📡 STEP 4: Mengecek JADWAL_UJIAN...");
        const jadwalUrl = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/JADWAL_UJIAN!A:J?key=${CONFIG.API_KEY}`;
        console.log("URL:", jadwalUrl);
        
        const jadwalRes = await fetch(jadwalUrl);
        const jadwalData = await jadwalRes.json();
        
        if (jadwalData.error) {
            console.log("❌ ERROR API:", jadwalData.error);
            showError("Gagal baca sheet JADWAL_UJIAN: " + jadwalData.error.message);
            return;
        }
        
        const jadwalRows = jadwalData.values || [];
        console.log("Jumlah baris jadwal:", jadwalRows.length);
        console.log("Header jadwal:", jadwalRows[0]);
        
        let jadwal = null;
        for (let i = 1; i < jadwalRows.length; i++) {
            console.log(`Baris ${i}:`, jadwalRows[i]);
            if (String(jadwalRows[i][1]).trim() === String(tokenInfo.jenjang).trim() &&
                String(jadwalRows[i][2]).trim() === String(tokenInfo.mapel).trim() &&
                String(jadwalRows[i][3]).trim() === String(tokenInfo.jenis).trim() &&
                jadwalRows[i][9] === "Aktif") {
                jadwal = {
                    mulai: jadwalRows[i][5],
                    selesai: jadwalRows[i][6]
                };
                console.log("✅ JADWAL DITEMUKAN:", jadwal);
                break;
            }
        }
        
        if (!jadwal) {
            console.log("❌ Jadwal tidak ditemukan");
            showError("Jadwal tidak ditemukan!");
            return;
        }
        
        // ===== STEP 5: SUKSES =====
        console.log("\n✅✅✅ LOGIN BERHASIL! ✅✅✅");
        console.log("=".repeat(50));
        console.log("Data Siswa:", siswa);
        console.log("Data Token:", tokenInfo);
        console.log("Data Jadwal:", jadwal);
        console.log("=".repeat(50));
        
        // Tampilkan hasil di halaman
        document.getElementById("loginScreen").style.display = "none";
        
        // Buat tampilan sukses sederhana
        const successDiv = document.createElement("div");
        successDiv.style.padding = "20px";
        successDiv.style.textAlign = "center";
        successDiv.innerHTML = `
            <h2 style="color: green;">✅ LOGIN BERHASIL!</h2>
            <p><strong>Nama:</strong> ${siswa.nama}</p>
            <p><strong>Kelas:</strong> ${siswa.kelas}</p>
            <p><strong>Mapel:</strong> ${tokenInfo.mapel} - ${tokenInfo.jenis}</p>
            <p><strong>Waktu:</strong> ${jadwal.mulai} - ${jadwal.selesai}</p>
            <p style="margin-top: 20px; color: gray;">Cek Console (F12) untuk detail lengkap</p>
        `;
        document.querySelector(".app-container").appendChild(successDiv);
        
    } catch (e) {
        console.error("❌ ERROR:", e);
        showError("Gagal terhubung: " + e.message);
    }
}

// Fungsi dummy untuk yang lain (biar tidak error)
function cancelConfirm() { location.reload(); }
function startExam() { alert("Ini hanya versi debug. Fitur ujian belum diaktifkan."); }
function toggleNav() {}
function toggleRagu() {}
function prevSoal() {}
function nextSoal() {}
function konfirmasiSelesai() {}
function renderNavigator() {}
function goToSoal() {}
function simpanPG() {}
function simpanPGK() {}
function simpanBS() {}
function simpanJodoh() {}
function simpanIsian() {}
function showFullscreenPrompt() {}
