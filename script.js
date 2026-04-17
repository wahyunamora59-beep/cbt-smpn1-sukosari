// ==================== KONFIGURASI ====================
const CONFIG = {
    SPREADSHEET_ID: 'PASTE_SPREADSHEET_ID_ANDA',
    API_KEY: 'PASTE_API_KEY_ANDA',
    PROXY_URL: 'PASTE_PROXY_URL_ANDA'
};

let currentUser = null, currentUjian = null, dataSoal = [], indexSoal = 0;
let jawabanLokal = {}, raguLokal = {}, timerInterval = null, waktuSelesai = null;
let minimalMenit = 45, ujianSelesai = false, idSesi = null, pelanggaranCount = 0;

function togglePassword() { const i = document.getElementById('tokenInput'); i.type = i.type === 'password' ? 'text' : 'password'; }
function toggleNav() { document.getElementById('navPanel').classList.toggle('show'); }
function toggleRagu() { if (!dataSoal[indexSoal]) return; raguLokal[dataSoal[indexSoal].id] = !raguLokal[dataSoal[indexSoal].id]; renderNavigator(); }
function showError(msg) { alert('❌ ' + msg); }
function showSuccess(msg) { alert('✅ ' + msg); }

// ==================== LOGIN ====================
async function handleLogin() {
    const username = document.getElementById('usernameInput').value.trim();
    const token = document.getElementById('tokenInput').value.trim();
    if (!username || !token) { showError('Isi username dan token!'); return; }
    
    try {
        // Cek Token
        const tRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/TOKEN_UJIAN!A:H?key=${CONFIG.API_KEY}`);
        const tData = await tRes.json(); const tRows = tData.values || [];
        let tokenInfo = null;
        for (let i=1; i<tRows.length; i++) if (tRows[i][0] === token && tRows[i][5] === 'Aktif') { tokenInfo = { jenjang: tRows[i][1], mapel: tRows[i][2], jenis: tRows[i][3] }; break; }
        if (!tokenInfo) { showError('Token tidak valid!'); return; }
        
        // Cek Siswa
        const sRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/DATA_SISWA!A:H?key=${CONFIG.API_KEY}`);
        const sData = await sRes.json(); const sRows = sData.values || [];
        let siswa = null;
        for (let i=1; i<sRows.length; i++) if (sRows[i][2] === username) { siswa = { nis: sRows[i][0], nama: sRows[i][1], username: sRows[i][2], kelas: sRows[i][4], jenjang: sRows[i][5] }; break; }
        if (!siswa) { showError('Username tidak terdaftar!'); return; }
        if (siswa.jenjang !== tokenInfo.jenjang) { showError(`Token untuk jenjang ${tokenInfo.jenjang}!`); return; }
        
        // Cek Jadwal
        const jRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/JADWAL_UJIAN!A:J?key=${CONFIG.API_KEY}`);
        const jData = await jRes.json(); const jRows = jData.values || [];
        let jadwal = null;
        for (let i=1; i<jRows.length; i++) if (jRows[i][1] === tokenInfo.jenjang && jRows[i][2] === tokenInfo.mapel && jRows[i][3] === tokenInfo.jenis && jRows[i][9] === 'Aktif') { jadwal = { mulai: jRows[i][5], selesai: jRows[i][6], min: parseInt(jRows[i][7])||45 }; break; }
        if (!jadwal) { showError('Jadwal tidak ditemukan!'); return; }
        
        const now = new Date();
        const [hM, mM] = jadwal.mulai.split(':').map(n=>parseInt(n));
        const [hS, mS] = jadwal.selesai.split(':').map(n=>parseInt(n));
        const wM = new Date(); wM.setHours(hM, mM, 0, 0);
        const wS = new Date(); wS.setHours(hS, mS, 0, 0);
        if (now < wM) { showError(`Ujian belum dimulai. Mulai ${jadwal.mulai}`); return; }
        if (now >= wS) { showError('Waktu ujian sudah berakhir!'); return; }
        
        currentUser = siswa; currentUjian = { ...tokenInfo, ...jadwal };
        waktuSelesai = wS; minimalMenit = jadwal.min;
        
        const pRes = await fetch(CONFIG.PROXY_URL, { method: 'POST', body: JSON.stringify({ action: 'mulaiUjian', username, jenjang: siswa.jenjang, mapel: tokenInfo.mapel, jenisUjian: tokenInfo.jenis, ipAddress: '0.0.0.0' }) });
        const pData = await pRes.json(); idSesi = pData.idSesi;
        
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('examScreen').style.display = 'block';
        document.getElementById('namaDisplay').innerText = `${siswa.nama} | ${siswa.kelas}`;
        document.getElementById('infoDisplay').innerText = `${tokenInfo.mapel} - ${tokenInfo.jenis}`;
        
        await ambilSoal(siswa.jenjang, tokenInfo.mapel, tokenInfo.jenis);
        mulaiTimer();
        renderNavigator();
        document.documentElement.requestFullscreen();
    } catch(e) { console.error(e); showError('Gagal terhubung.'); }
}

// ==================== AMBIL SOAL ====================
async function ambilSoal(jenjang, mapel, jenis) {
    try {
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/BANK_SOAL!A:O?key=${CONFIG.API_KEY}`);
        const data = await res.json(); const rows = data.values || [];
        dataSoal = [];
        for (let i=1; i<rows.length; i++) {
            if (rows[i][1] === jenjang && rows[i][2] === mapel && rows[i][3] === jenis && rows[i][13] === 'Aktif') {
                dataSoal.push({
                    id: rows[i][0], tipe: rows[i][4], pertanyaan: rows[i][5],
                    pilihan: [rows[i][6], rows[i][7], rows[i][8], rows[i][9], rows[i][10]].filter(p=>p),
                    kunci: rows[i][11], bobot: parseFloat(rows[i][12])||1, gambar: rows[i][14]||null
                });
            }
        }
        if (dataSoal.length === 0) { document.getElementById('soalContainer').innerHTML = '<p>Belum ada soal.</p>'; return; }
        dataSoal = shuffleArray(dataSoal);
        renderSoal(0);
    } catch(e) { console.error(e); }
}

function shuffleArray(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

// ==================== RENDER ====================
function renderNavigator() {
    let h = '';
    for (let i=0; i<dataSoal.length; i++) {
        const s = dataSoal[i], ans = jawabanLokal[s.id] !== undefined, rag = raguLokal[s.id], cur = i === indexSoal;
        let c = 'unanswered'; if (ans) c = 'answered'; if (rag && !cur) c = 'ragu'; if (cur) c = 'current';
        h += `<button class="nav-btn-num ${c}" onclick="goToSoal(${i})">${i+1}</button>`;
    }
    document.getElementById('navGrid').innerHTML = h;
}
function goToSoal(i) { renderSoal(i); renderNavigator(); if (window.innerWidth <= 500) document.getElementById('navPanel').classList.remove('show'); }

function renderSoal(idx) {
    indexSoal = idx; const s = dataSoal[idx];
    document.getElementById('progressFill').style.width = ((idx+1)/dataSoal.length*100)+'%';
    let h = `<h3>Soal ${idx+1}/${dataSoal.length} [${s.tipe}]</h3>`;
    if (s.gambar) { let u = s.gambar; if (u.match(/^[a-zA-Z0-9_-]{20,}$/)) u = `https://drive.google.com/uc?export=view&id=${u}`; h += `<img src="${u}" style="max-width:100%;">`; }
    h += `<p><strong>${s.pertanyaan}</strong></p>`;
    const jaw = jawabanLokal[s.id];
    
    if (s.tipe === 'PG') {
        s.pilihan.forEach((o,i) => { const hu = String.fromCharCode(65+i); h += `<label class="option-label"><input type="radio" name="jwb" value="${hu}" ${jaw===hu?'checked':''}> ${hu}. ${o}</label>`; });
        h += `<button class="btn-simpan" onclick="simpanPG('${s.id}')">Simpan</button>`;
    } else if (s.tipe === 'PGK') {
        let arr = []; try { arr = JSON.parse(jaw||'[]'); } catch(e){}
        s.pilihan.forEach((o,i) => { const hu = String.fromCharCode(65+i); h += `<label class="option-label"><input type="checkbox" name="jwb" value="${hu}" ${arr.includes(hu)?'checked':''}> ${hu}. ${o}</label>`; });
        h += `<button class="btn-simpan" onclick="simpanPGK('${s.id}')">Simpan</button>`;
    } else if (s.tipe === 'B/S') {
        const pernyataan = s.pilihan; const jawArr = jaw ? JSON.parse(jaw) : [];
        pernyataan.forEach((teks, i) => { h += `<div style="background:#f8fafc; padding:12px; border-radius:12px; margin-bottom:12px;"><p>${i+1}. ${teks}</p><label style="margin-right:20px;"><input type="radio" name="bs_${i}" value="B" ${jawArr[i]==='B'?'checked':''}> Benar</label><label><input type="radio" name="bs_${i}" value="S" ${jawArr[i]==='S'?'checked':''}> Salah</label></div>`; });
        h += `<button class="btn-simpan" onclick="simpanBS('${s.id}',${pernyataan.length})">Simpan</button>`;
    } else if (s.tipe === 'Jodoh') {
        let kunci = {}; try { kunci = JSON.parse(s.kunci); } catch(e){}
        let jawObj = {}; try { jawObj = JSON.parse(jaw||'{}'); } catch(e){}
        h += `<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">`;
        for (let k in kunci) { h += `<div>${k}</div><div><input type="text" id="jodoh_${k.replace(/\s/g,'')}" value="${jawObj[k]||''}" placeholder="A/B/C/D"></div>`; }
        h += `</div><button class="btn-simpan" onclick="simpanJodoh('${s.id}','${s.kunci.replace(/"/g,'&quot;')}')">Simpan</button>`;
    } else if (s.tipe === 'Isian') {
        h += `<input type="text" id="isian" value="${jaw||''}" placeholder="Jawaban..." style="width:100%;padding:14px;border-radius:16px;border:1px solid #e2e8f0;">`;
        h += `<button class="btn-simpan" onclick="simpanIsian('${s.id}')">Simpan</button>`;
    }
    document.getElementById('soalContainer').innerHTML = h;
}

function simpanPG(id) { const s = document.querySelector('input[name="jwb"]:checked'); if(!s){showError('Pilih jawaban!');return;} jawabanLokal[id]=s.value; renderNavigator(); showSuccess('Tersimpan!'); }
function simpanPGK(id) { const arr = Array.from(document.querySelectorAll('input[name="jwb"]:checked')).map(c=>c.value); jawabanLokal[id]=JSON.stringify(arr); renderNavigator(); showSuccess('Tersimpan!'); }
function simpanBS(id, n) { const arr = []; for(let i=0;i<n;i++){ const s=document.querySelector(`input[name="bs_${i}"]:checked`); if(!s){showError('Jawab semua!');return;} arr.push(s.value); } jawabanLokal[id]=JSON.stringify(arr); renderNavigator(); showSuccess('Tersimpan!'); }
function simpanJodoh(id, kunciStr) { const k = JSON.parse(kunciStr.replace(/&quot;/g,'"')); const obj = {}; for(let key in k){ const inp=document.getElementById(`jodoh_${key.replace(/\s/g,'')}`); if(inp) obj[key]=inp.value; } jawabanLokal[id]=JSON.stringify(obj); renderNavigator(); showSuccess('Tersimpan!'); }
function simpanIsian(id) { const inp=document.getElementById('isian'); if(!inp.value.trim()){showError('Isi jawaban!');return;} jawabanLokal[id]=inp.value.trim(); renderNavigator(); showSuccess('Tersimpan!'); }

function prevSoal() { if(indexSoal>0) goToSoal(indexSoal-1); }
function nextSoal() { if(indexSoal<dataSoal.length-1) goToSoal(indexSoal+1); }

function mulaiTimer() { timerInterval = setInterval(() => { const sisa = Math.max(waktuSelesai - new Date(), 0); const d = Math.floor(sisa/1000); const m = Math.floor(d/60); const s = d%60; document.getElementById('timerDisplay').innerText = `${m}:${s<10?'0':''}${s}`; if(d===0 && !ujianSelesai) { ujianSelesai=true; clearInterval(timerInterval); showError('Waktu habis!'); selesaiUjian(); } }, 1000); }

function konfirmasiSelesai() { if(confirm('Yakin selesai?')) selesaiUjian(); }

async function selesaiUjian() {
    clearInterval(timerInterval); let total=0, benar=0;
    dataSoal.forEach(s=>{ const j=jawabanLokal[s.id]; if(!j) return;
        if(s.tipe==='PG'){ if(j===s.kunci){ total+=s.bobot; benar++; } }
        else if(s.tipe==='PGK'){ try{ if(JSON.stringify(JSON.parse(j).sort())===JSON.stringify(JSON.parse(s.kunci).sort())){ total+=s.bobot; benar++; } }catch(e){} }
        else if(s.tipe==='B/S'){ try{ const ja=JSON.parse(j), ka=JSON.parse(s.kunci); let b=0; for(let i=0;i<ka.length;i++) if(ja[i]===ka[i]) b++; total+=(b/ka.length)*s.bobot; if(b===ka.length) benar++; }catch(e){} }
        else if(s.tipe==='Jodoh'){ try{ const jo=JSON.parse(j), ko=JSON.parse(s.kunci); let b=0, tot=Object.keys(ko).length; for(let k in ko) if(jo[k] && jo[k].toUpperCase()===ko[k].toUpperCase()) b++; total+=(b/tot)*s.bobot; if(b===tot) benar++; }catch(e){} }
        else if(s.tipe==='Isian'){ if(j.toLowerCase()===s.kunci.toLowerCase()){ total+=s.bobot; benar++; } }
    });
    await fetch(CONFIG.PROXY_URL, { method:'POST', body:JSON.stringify({ action:'selesaiUjian', idSesi, username:currentUser.username, nis:currentUser.nis, nama:currentUser.nama, jenjang:currentUser.jenjang, kelas:currentUser.kelas, mapel:currentUjian.mapel, jenisUjian:currentUjian.jenis, totalSkor:total, jumlahBenar:benar, jumlahSoal:dataSoal.length, ipAddress:'0.0.0.0' }) });
    alert(`✅ SELESAI!\nSkor: ${total}\nBenar: ${benar}/${dataSoal.length}`); location.reload();
}

// Anti Curang
document.addEventListener('visibilitychange', () => { if(document.hidden && currentUser && !ujianSelesai) { document.getElementById('alertOverlay').style.display='block'; document.getElementById('alertSound').play(); setTimeout(()=>document.getElementById('alertOverlay').style.display='none',3000); } });