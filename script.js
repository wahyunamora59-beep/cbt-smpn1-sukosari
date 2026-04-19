// ==================== KONFIGURASI SPREADSHEET ====================
const CONFIG = {
    SPREADSHEET_ID: '1zc5lh-8XWEhGYJajqooWGK3Vo89kqob1iAaIdaIiXc0',
    API_KEY: 'AIzaSyAG16CaL_CwY6Hktj6nNrxCoPjYXcJZHcE'
    // PROXY_URL tidak diperlukan lagi!
};

// ==================== KONFIGURASI GOOGLE FORM JAWABAN ====================
const FORM_JAWABAN_CONFIG = {
    FORM_ID: '16KE31UPEFVGq1GN0yTs6zDtzDTwomQm4e-uFS3-i4QY',
    FORM_URL: 'https://docs.google.com/forms/d/16KE31UPEFVGq1GN0yTs6zDtzDTwomQm4e-uFS3-i4QY/edit',
    ENTRY_IDS: {
        idSesi: 'entry.573372308',
        username: 'entry.1668234915',
        idSoal: 'entry.2021217112',
        jawaban: 'entry.1938948166',
        skor: 'entry.1230085090'
    }
};

// ==================== KONFIGURASI GOOGLE FORM NILAI AKHIR ====================
const FORM_NILAI_CONFIG = {
    FORM_ID: '1FAIpQLSc0y02L0-T1ac6Xr5ZaQUa-A0YBPx1W2-4xVJwXQSNhcDVPoQ',
    FORM_URL: 'https://docs.google.com/forms/d/e/1FAIpQLSc0y02L0-T1ac6Xr5ZaQUa-A0YBPx1W2-4xVJwXQSNhcDVPoQ/formResponse',
    ENTRY_IDS: {
        idSesi: 'entry.1016023962',
        username: 'entry.1400099277',
        nis: 'entry.2028389282',
        nama: 'entry.735000562',
        jenjang: 'entry.1656736665',
        kelas: 'entry.1159460942',
        mapel: 'entry.1122205447',
        jenisUjian: 'entry.205630993',
        totalSkor: 'entry.1434879950',
        jumlahBenar: 'entry.603131586',
        jumlahSoal: 'entry.954020031',
        persentase: 'entry.1248333394'
    }
};

// ==================== VARIABEL GLOBAL ====================
let currentUser=null,currentUjian=null,dataSoal=[],indexSoal=0,jawabanLokal={},raguLokal={},timerInterval=null,waktuSelesai=null,waktuMulaiServer=null,minimalMenit=45,ujianSelesai=!1,idSesi=null,pelanggaranCount=0,totalPenalti=0,tombolSelesaiAktif=!1,isFullscreen=!1,isFrozen=!1,freezeInterval=null,pendingUser=null,pendingUjian=null,pendingWaktuSelesai=null,pendingSesiAktif=null,isLocked=!1,debounceTimer=null,freezeDuration=60,maxPelanggaran=5;
window.currentMatchingSoal=null;window.currentMatchingJawaban={};window.hurufMapping={};

// ==================== TOAST & MODAL ====================
function showToast(m,t="info",d=2000){const c=document.getElementById("toastContainer");if(!c){alert(m);return}const e=document.createElement("div");e.className=`toast ${t}`;e.innerHTML=`<i class="fas fa-${t==="success"?"check-circle":t==="error"?"times-circle":t==="warning"?"exclamation-triangle":"info-circle"}"></i> ${m}`;c.appendChild(e);setTimeout(()=>{e.classList.add("hide");setTimeout(()=>e.remove(),300)},d)}
function showModal(o){const v=document.getElementById("modalOverlay");if(!v){alert(o.message);return}const{icon:i,iconType:t="info",title:d,message:m,showCheckbox:s=!1,checkboxLabel:c="",buttons:b=[],onClose:l}=o;document.getElementById("modalIcon").textContent=i||(t==="success"?"✅":t==="error"?"❌":t==="warning"?"⚠️":"ℹ️");document.getElementById("modalIcon").className=`modal-icon ${t}`;document.getElementById("modalTitle").textContent=d;document.getElementById("modalMessage").textContent=m;const h=document.getElementById("modalCheckboxContainer");if(s){h.style.display="flex";document.getElementById("modalCheckboxLabel").textContent=c;document.getElementById("modalCheckbox").checked=!1}else h.style.display="none";const u=document.getElementById("modalButtons");u.innerHTML="";b.forEach(n=>{const x=document.createElement("button");x.className=`modal-btn ${n.type||"secondary"}`;x.textContent=n.text;x.onclick=()=>{const C=s?document.getElementById("modalCheckbox").checked:!1;if(n.onClick)n.onClick(C);closeModal()};u.appendChild(x)});v.style.display="flex";v.onclick=e=>{if(e.target===v){closeModal();if(l)l()}}}
function closeModal(){document.getElementById("modalOverlay").style.display="none"}
function showSuccess(m){showToast(m,"success")}
function showError(m){showToast(m,"error")}

// ==================== FREEZE ====================
function freezeScreen(d=null){if(isFrozen)return;isFrozen=!0;const durasi=d!==null?d:freezeDuration;const o=document.getElementById("freezeOverlay"),t=document.getElementById("freezeTimer");o.style.display="flex";let r=durasi;const e=()=>{const m=Math.floor(r/60),s=r%60;t.textContent=`${m.toString().padStart(2,"0")}:${s.toString().padStart(2,"0")}`;if(r<=0){clearInterval(freezeInterval);o.style.display="none";isFrozen=!1;showToast("Layar sudah tidak dibekukan!","warning",5000)}r--};e();freezeInterval=setInterval(e,1000)}

// ==================== HELPER ====================
function togglePassword(){const i=document.getElementById("tokenInput");i.type=i.type==="password"?"text":"password"}
function toggleNav(){if(isFrozen)return;document.getElementById("navPanel").classList.toggle("show")}
function toggleRagu(){if(isFrozen)return;if(!dataSoal[indexSoal])return;raguLokal[dataSoal[indexSoal].id]=!raguLokal[dataSoal[indexSoal].id];renderNavigator();showToast(raguLokal[dataSoal[indexSoal].id]?"Ditandai ragu":"Tanda ragu dihapus","info",1500)}
function updateNavInfo(){const t=dataSoal.length,j=Object.keys(jawabanLokal).length,e=document.getElementById("navInfo");if(e)e.textContent=`✅ ${j}/${t} terjawab`}

// ==================== FULLSCREEN ====================
function enterFullscreen(){const e=document.documentElement;if(e.requestFullscreen)e.requestFullscreen();else if(e.webkitRequestFullscreen)e.webkitRequestFullscreen();isFullscreen=!0}
function showFullscreenPrompt(){showModal({iconType:"info",title:"Mode Fullscreen Wajib",message:"Klik tombol di bawah untuk masuk fullscreen.",buttons:[{text:"Masuk Fullscreen",type:"primary",onClick:()=>enterFullscreen()}],onClose:()=>{if(!isFullscreen)showFullscreenPrompt()}})}
document.addEventListener("fullscreenchange",()=>{if(!document.fullscreenElement){if(currentUser&&!ujianSelesai){isFullscreen=!1;catatPelanggaran("FULLSCREEN_EXIT","Keluar fullscreen");freezeScreen();showFullscreenPrompt()}}else isFullscreen=!0});

// ==================== ANTI-CURANG ====================
window.addEventListener('pagehide',()=>{isLocked=!0});
window.addEventListener('pageshow',()=>{if(isLocked){isLocked=!1}});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&currentUser&&!ujianSelesai&&!isFrozen){if(!isLocked){catatPelanggaran("TAB_SWITCH","Pindah tab");freezeScreen();document.getElementById("alertOverlay").style.display="block";document.getElementById("alertSound").play();setTimeout(()=>document.getElementById("alertOverlay").style.display="none",3000)}}});
document.addEventListener("contextmenu",e=>{e.preventDefault();if(currentUser&&!ujianSelesai&&!isFrozen){catatPelanggaran("RIGHT_CLICK","Klik kanan");freezeScreen()}});
document.addEventListener("keydown",e=>{if(!currentUser||ujianSelesai||isFrozen)return;if(e.key==="F11"||e.key==="Escape")e.preventDefault();if(e.ctrlKey&&(e.key==="w"||e.key==="t"||e.key==="n")){e.preventDefault();catatPelanggaran("KEYBOARD",`Ctrl+${e.key.toUpperCase()}`);freezeScreen()}});
window.addEventListener("beforeunload",e=>{if(currentUser&&!ujianSelesai){e.preventDefault();e.returnValue=""}});

function catatPelanggaran(j,d){if(!currentUser||ujianSelesai)return;pelanggaranCount++;totalPenalti++}

// ==================== UPDATE TOMBOL SELESAI ====================
function updateTombolSelesai(){const b=document.querySelector(".btn-selesai-modern");if(!b||!waktuMulaiServer)return;const s=new Date(),m=Math.floor((s-waktuMulaiServer)/60000),r=Math.max(minimalMenit-m,0);if(r>0&&!ujianSelesai){tombolSelesaiAktif=!1;b.disabled=!0;b.innerHTML=`<i class="fas fa-lock"></i> (${r}m)`}else{tombolSelesaiAktif=!0;b.disabled=!1;b.innerHTML=`<i class="fas fa-check-circle"></i> SELESAI`}}

// ==================== PARSE ISTILAH ====================
function parseIstilahDariPertanyaan(teks){const istilahMap={};let teksBagianA=teks;const stopMarkers=['BAGIAN B','Bagian B','Pilihan:','Pilihan Jawaban:','\nA.','\nA)','\nA ','A. if','A. '];for(let marker of stopMarkers){const idx=teks.indexOf(marker);if(idx!==-1){teksBagianA=teks.substring(0,idx);break}}const lines=teksBagianA.split('\n');let currentNumber=null;for(let line of lines){line=line.trim();if(!line)continue;const match=line.match(/^(\d+)\.\s+(.+)$/);if(match){currentNumber=match[1];istilahMap[currentNumber]=match[2]}else if(currentNumber&&line){istilahMap[currentNumber]+=' '+line}}if(Object.keys(istilahMap).length===0){const regex=/(\d+)\.\s*([^\n]+)/g;let m;while((m=regex.exec(teksBagianA))!==null){istilahMap[m[1]]=m[2].trim()}}return istilahMap}

// ==================== LOGIN ====================
async function handleLogin(){
    const u=document.getElementById("usernameInput").value.trim(),t=document.getElementById("tokenInput").value.trim();
    if(!u||!t){showError("Isi username dan token!");return}
    try{
        const tR=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/TOKEN_UJIAN!A:H?key=${CONFIG.API_KEY}`),tD=await tR.json(),tRows=tD.values||[];
        let tokenInfo=null;for(let i=1;i<tRows.length;i++)if(tRows[i][0]===t&&tRows[i][5]==="Aktif"){tokenInfo={jenjang:tRows[i][1],mapel:tRows[i][2],jenis:tRows[i][3]};break}
        if(!tokenInfo){showError("Token tidak valid!");return}
        const sR=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/DATA_SISWA!A:H?key=${CONFIG.API_KEY}`),sD=await sR.json(),sRows=sD.values||[];
        let siswa=null;for(let i=1;i<sRows.length;i++)if(sRows[i][2]===u){siswa={nis:sRows[i][0]||'',nama:sRows[i][1]||'',username:sRows[i][2],kelas:sRows[i][4]||'',jenjang:sRows[i][5]||''};break}
        if(!siswa){showError("Username tidak terdaftar!");return}
        const jR=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/JADWAL_UJIAN!A:J?key=${CONFIG.API_KEY}`),jD=await jR.json(),jRows=jD.values||[];
        let jadwal=null;for(let i=1;i<jRows.length;i++)if(String(jRows[i][1]).trim()===String(tokenInfo.jenjang).trim()&&String(jRows[i][2]).trim()===String(tokenInfo.mapel).trim()&&String(jRows[i][3]).trim()===String(tokenInfo.jenis).trim()&&jRows[i][9]==="Aktif"){jadwal={mulai:jRows[i][5],selesai:jRows[i][6],min:parseInt(jRows[i][7])||0};break}
        if(!jadwal){showError("Jadwal tidak ditemukan!");return}
        const n=new Date(),[hS,mS]=String(jadwal.selesai).split(':').map(n=>parseInt(n)),wS=new Date();wS.setHours(hS,mS,0,0);if(n>=wS){showError("Waktu ujian sudah berakhir!");return}
        pendingUser=siswa;pendingUjian={...tokenInfo,...jadwal};pendingWaktuSelesai=wS;
        document.getElementById("loginScreen").style.display="none";document.getElementById("confirmScreen").style.display="block";
        document.getElementById("confirmNIS").textContent=siswa.nis||'-';document.getElementById("confirmNama").textContent=siswa.nama||'-';
        document.getElementById("confirmKelas").textContent=siswa.kelas||'-';document.getElementById("confirmMapel").textContent=`${tokenInfo.mapel} - ${tokenInfo.jenis}`;
        document.getElementById("confirmWaktu").textContent=`${jadwal.mulai} - ${jadwal.selesai}`;
    }catch(e){console.error(e);showError("Gagal terhubung.")}
}

function cancelConfirm(){document.getElementById("confirmScreen").style.display="none";document.getElementById("loginScreen").style.display="block";document.getElementById("usernameInput").value="";document.getElementById("tokenInput").value="";pendingUser=null;pendingUjian=null;pendingWaktuSelesai=null;showToast("Silakan login dengan akun yang benar","info")}

async function startExam(){if(!pendingUser||!pendingUjian){showError("Data tidak valid.");cancelConfirm();return}currentUser=pendingUser;currentUjian=pendingUjian;waktuSelesai=pendingWaktuSelesai;minimalMenit=pendingUjian.min||0;waktuMulaiServer=new Date();idSesi='SES-' + Date.now() + '-' + Math.random().toString(36).substr(2,9);document.getElementById("confirmScreen").style.display="none";document.getElementById("examScreen").style.display="block";document.getElementById("namaDisplay").innerText=`${currentUser.nama||'N/A'} | ${currentUser.kelas||'N/A'}`;document.getElementById("infoDisplay").innerText=`${currentUjian.mapel||'N/A'} - ${currentUjian.jenis||'N/A'}`;await ambilSoal(currentUser.jenjang,currentUjian.mapel,currentUjian.jenis);mulaiTimer();renderNavigator();showFullscreenPrompt();updateTombolSelesai();setInterval(updateTombolSelesai,1000);showSuccess(`Selamat datang, ${currentUser.nama||'Siswa'}!`)}

// ==================== ACAK SOAL ====================
function shuffleArray(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function acakSoalDenganGrup(l){const g={},t=[];l.forEach(s=>{if(s.grupSoal&&s.grupSoal.trim()!==''){const n=s.grupSoal.trim();if(!g[n])g[n]=[];g[n].push(s)}else t.push(s)});const b=[];for(let n in g)b.push(g[n]);const semua=[...b,...t.map(s=>[s])],acak=shuffleArray(semua),hasil=[];acak.forEach(block=>{block.forEach(s=>hasil.push(s))});return hasil}
async function ambilSoal(j,m,js){try{const r=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/BANK_SOAL!A:P?key=${CONFIG.API_KEY}`),d=await r.json(),rows=d.values||[];let mentah=[];for(let i=1;i<rows.length;i++)if(String(rows[i][1]).trim()===String(j).trim()&&String(rows[i][2]).trim()===String(m).trim()&&String(rows[i][3]).trim()===String(js).trim()&&rows[i][13]==="Aktif"){mentah.push({id:rows[i][0],tipe:rows[i][4],pertanyaan:rows[i][5],pilihan:[rows[i][6],rows[i][7],rows[i][8],rows[i][9],rows[i][10]].filter(p=>p),kunci:rows[i][11],bobot:parseFloat(rows[i][12])||1,gambar:rows[i][14]||null,grupSoal:rows[i][15]||''})}if(mentah.length===0){document.getElementById("soalContainer").innerHTML="<p>Belum ada soal.</p>";return}dataSoal=acakSoalDenganGrup(mentah);renderSoal(0)}catch(e){console.error(e)}}

// ==================== RENDER ====================
function renderNavigator(){let h="";for(let i=0;i<dataSoal.length;i++){const s=dataSoal[i],a=jawabanLokal[s.id]!==undefined,r=raguLokal[s.id],c=i===indexSoal;let cls="unanswered";if(a)cls="answered";if(r&&!c)cls="ragu";if(c)cls="current";h+=`<button class="nav-btn-num ${cls}" onclick="goToSoal(${i})">${i+1}</button>`}document.getElementById("navGrid").innerHTML=h;updateNavInfo()}
function goToSoal(i){if(isFrozen)return;renderSoal(i);renderNavigator();if(window.innerWidth<=500)document.getElementById("navPanel").classList.remove("show")}
function renderSoal(idx){
    indexSoal=idx;const s=dataSoal[idx];
    document.getElementById("progressFill").style.width=((idx+1)/dataSoal.length*100)+"%";
    let h=`<h3>Soal ${idx+1}/${dataSoal.length} [${s.tipe}]</h3>`;
    if(s.gambar){let u=s.gambar;if(u.match(/^[a-zA-Z0-9_-]{20,}$/))u=`https://drive.google.com/uc?export=view&id=${u}`;h+=`<img src="${u}" style="max-width:100%;">`}
    h+=`<p><strong>${s.pertanyaan}</strong></p>`;const jaw=jawabanLokal[s.id];
    if(s.tipe==="PG"){s.pilihan.forEach((o,i)=>{const hu=String.fromCharCode(65+i);h+=`<label class="option-label"><input type="radio" name="jwb" value="${hu}" ${jaw===hu?"checked":""} ${isFrozen?"disabled":""} onchange="autoSavePG('${s.id}')"> ${hu}. ${o}</label>`});h+=`<button class="btn-simpan" onclick="simpanPG('${s.id}')" ${isFrozen?"disabled":""}><i class="fas fa-save"></i> Simpan</button>`}
    else if(s.tipe==="PGK"){let a=[];try{a=JSON.parse(jaw||"[]")}catch(e){}s.pilihan.forEach((o,i)=>{const hu=String.fromCharCode(65+i);h+=`<label class="option-label"><input type="checkbox" name="jwb" value="${hu}" ${a.includes(hu)?"checked":""} ${isFrozen?"disabled":""} onchange="autoSavePGK('${s.id}')"> ${hu}. ${o}</label>`});h+=`<button class="btn-simpan" onclick="simpanPGK('${s.id}')" ${isFrozen?"disabled":""}><i class="fas fa-save"></i> Simpan</button>`}
    else if(s.tipe==="B/S"){const p=s.pilihan.filter(p=>p&&p.trim()!=='');if(p.length===0){h+=`<div style="background:#f8fafc;padding:16px;border-radius:12px;margin-bottom:16px;"><p>${s.pertanyaan}</p><div style="display:flex;gap:24px;"><label><input type="radio" name="bs_single" value="B" ${jaw==='B'?'checked':''} onchange="autoSaveBSSingle('${s.id}')"> ✅ BENAR</label><label><input type="radio" name="bs_single" value="S" ${jaw==='S'?'checked':''} onchange="autoSaveBSSingle('${s.id}')"> ❌ SALAH</label></div></div>`;h+=`<button class="btn-simpan" onclick="simpanBSSingle('${s.id}')"><i class="fas fa-save"></i> Simpan</button>`}else{let a=[];try{if(jaw)a=JSON.parse(jaw)}catch(e){if(jaw==="B"||jaw==="S")a=[jaw]}p.forEach((t,i)=>{const jwb=a[i]||'';h+=`<div style="background:#f8fafc;padding:14px;border-radius:12px;margin-bottom:12px;"><p>${i+1}. ${t}</p><div style="display:flex;gap:20px;"><label><input type="radio" name="bs_${i}" value="B" ${jwb==='B'?'checked':''} onchange="autoSaveBS('${s.id}',${p.length})"> ✅ Benar</label><label><input type="radio" name="bs_${i}" value="S" ${jwb==='S'?'checked':''} onchange="autoSaveBS('${s.id}',${p.length})"> ❌ Salah</label></div></div>`});h+=`<button class="btn-simpan" onclick="simpanBS('${s.id}',${p.length})"><i class="fas fa-save"></i> Simpan</button>`}}
    else if(s.tipe==="Jodoh"){let k={},o={};try{k=JSON.parse(s.kunci);o=jaw?JSON.parse(jaw):{}}catch(e){o={}}window.currentMatchingSoal=s;window.currentMatchingJawaban=o;const istilahMap=parseIstilahDariPertanyaan(s.pertanyaan);const keys=Object.keys(k),opsi=s.pilihan.filter(p=>p&&p.trim()),map={};opsi.forEach((opt,i)=>{map[String.fromCharCode(65+i)]=opt});window.hurufMapping=map;h+=`<div style="margin-bottom:12px;padding:10px;background:#e8f0fe;border-radius:12px;"><p style="font-weight:600;color:#1E3A8A;"><i class="fas fa-info-circle"></i> Tarik jawaban (A,B,C,D) dari KANAN ke istilah di KIRI.</p></div><div class="matching-jodoh-container" style="display:flex;gap:16px;">`;h+=`<div style="flex:1;background:#FEF3C7;padding:12px;border-radius:16px;"><div style="font-weight:600;margin-bottom:12px;text-align:center;">🎯 ISTILAH</div>`;for(let key of keys){const f=o[key]!==undefined,huruf=o[key]||'',teks=map[huruf]||'',istilah=istilahMap[key]||key;h+=`<div class="matching-target ${f?'filled':'empty'}" data-key="${key}" id="target_${key}" style="background:white;padding:12px;border-radius:12px;margin-bottom:8px;border:2px dashed #D97706;"><div style="text-align:left;">`;if(f){h+=`<div style="display:flex;align-items:center;gap:8px;"><span style="background:#22C55E;color:white;padding:4px 10px;border-radius:20px;font-size:12px;">${key}</span><span style="color:#16a34a;font-size:13px;"><i class="fas fa-check-circle"></i> ${huruf}. ${teks}</span></div><p style="margin-top:8px;font-size:14px;color:#1E293B;">${istilah}</p>`}else{h+=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span style="background:#D97706;color:white;padding:4px 10px;border-radius:20px;font-size:12px;">${key}</span><span style="color:#94a3b8;font-size:12px;"><i class="fas fa-arrow-right"></i> Tarik jawaban</span></div><p style="font-size:14px;color:#1E293B;">${istilah}</p>`}h+=`</div></div>`}h+=`</div>`;h+=`<div style="flex:1;background:#DBEAFE;padding:12px;border-radius:16px;"><div style="font-weight:600;margin-bottom:12px;text-align:center;">📦 JAWABAN</div>`;opsi.forEach((opt,i)=>{const hu=String.fromCharCode(65+i),used=Object.values(o).includes(hu);if(!used)h+=`<div class="matching-item-right" draggable="true" data-huruf="${hu}" id="drag_${hu}" style="background:white;padding:12px;border-radius:12px;margin-bottom:8px;border:2px solid #1E3A8A;cursor:grab;"><strong style="color:#1E3A8A;">${hu}.</strong> ${opt.replace(/^[A-E]\.\s*/,'')}</div>`;else h+=`<div class="matching-item-right paired" draggable="false" id="drag_${hu}" style="background:#DCFCE7;padding:12px;border-radius:12px;margin-bottom:8px;border:2px solid #22C55E;"><strong style="color:#1E3A8A;">${hu}.</strong> ${opt.replace(/^[A-E]\.\s*/,'')}<span style="color:#16a34a;margin-left:8px;"><i class="fas fa-check-circle"></i></span></div>`});h+=`</div></div><div style="display:flex;gap:12px;margin-top:16px;"><button class="btn-reset-matching" onclick="resetMatching()" style="flex:1;"><i class="fas fa-undo"></i> Reset</button><button class="btn-simpan" onclick="simpanJodohDrag('${s.id}')" style="flex:1;"><i class="fas fa-save"></i> Simpan</button></div>`;setTimeout(()=>initDragDropJodoh(),50)}
    else if(s.tipe==="Isian"){h+=`<input type="text" id="isian" value="${jaw||''}" placeholder="Ketik jawaban..." style="width:100%;padding:14px;border-radius:16px;border:1px solid #E2E8F0;" ${isFrozen?"disabled":""} oninput="debounceAutoSaveIsian('${s.id}')">`;h+=`<button class="btn-simpan" onclick="simpanIsian('${s.id}')"><i class="fas fa-save"></i> Simpan</button>`}
    document.getElementById("soalContainer").innerHTML=h;
}

// ==================== SIMPAN JAWABAN KE GOOGLE FORM ====================
async function simpanKeFormJawaban(idSoal, jawaban, skor) {
    if (!idSesi || !currentUser) return;
    try {
        const formData = new FormData();
        formData.append(FORM_JAWABAN_CONFIG.ENTRY_IDS.idSesi, idSesi);
        formData.append(FORM_JAWABAN_CONFIG.ENTRY_IDS.username, currentUser.username);
        formData.append(FORM_JAWABAN_CONFIG.ENTRY_IDS.idSoal, idSoal);
        formData.append(FORM_JAWABAN_CONFIG.ENTRY_IDS.jawaban, jawaban);
        formData.append(FORM_JAWABAN_CONFIG.ENTRY_IDS.skor, skor);
        await fetch(FORM_JAWABAN_CONFIG.FORM_URL, { method: 'POST', body: formData, mode: 'no-cors' });
        console.log(`✅ Jawaban ${idSoal} terkirim ke Form`);
    } catch(e) { console.error('❌ Gagal kirim jawaban:', e); }
}

function simpanKeLocalStorage(){if(idSesi)localStorage.setItem(`jawaban_${idSesi}`,JSON.stringify(jawabanLokal))}
function autoSavePG(id){const s=document.querySelector('input[name="jwb"]:checked');if(!s)return;jawabanLokal[id]=s.value;renderNavigator();simpanKeLocalStorage();const soal=dataSoal.find(q=>q.id===id);simpanKeFormJawaban(id,s.value,s.value===soal.kunci?soal.bobot:0);showToast('Tersimpan','success',800)}
function autoSavePGK(id){const a=Array.from(document.querySelectorAll('input[name="jwb"]:checked')).map(c=>c.value);if(a.length===0)return;jawabanLokal[id]=JSON.stringify(a);renderNavigator();simpanKeLocalStorage();const soal=dataSoal.find(q=>q.id===id);let s=0;try{if(JSON.stringify(a.sort())===JSON.stringify(JSON.parse(soal.kunci).sort()))s=soal.bobot}catch(e){}simpanKeFormJawaban(id,JSON.stringify(a),s);showToast('Tersimpan','success',800)}
function autoSaveBSSingle(id){const s=document.querySelector('input[name="bs_single"]:checked');if(!s)return;jawabanLokal[id]=s.value;renderNavigator();simpanKeLocalStorage();const soal=dataSoal.find(q=>q.id===id);simpanKeFormJawaban(id,s.value,s.value===soal.kunci?soal.bobot:0);showToast('Tersimpan','success',800)}
function autoSaveBS(id,n){let semua=!0;for(let i=0;i<n;i++)if(!document.querySelector(`input[name="bs_${i}"]:checked`)){semua=!1;break}if(!semua)return;const a=[];for(let i=0;i<n;i++)a.push(document.querySelector(`input[name="bs_${i}"]:checked`).value);jawabanLokal[id]=JSON.stringify(a);renderNavigator();simpanKeLocalStorage();const soal=dataSoal.find(q=>q.id===id);let s=0;try{const k=JSON.parse(soal.kunci);let b=0;for(let i=0;i<k.length;i++)if(a[i]===k[i])b++;s=(b/k.length)*soal.bobot}catch(e){}simpanKeFormJawaban(id,JSON.stringify(a),s);showToast('Tersimpan','success',800)}
function debounceAutoSaveIsian(id){clearTimeout(debounceTimer);debounceTimer=setTimeout(()=>{const i=document.getElementById('isian');if(!i||!i.value.trim())return;jawabanLokal[id]=i.value.trim();renderNavigator();simpanKeLocalStorage();const soal=dataSoal.find(q=>q.id===id);let s=0;if(soal.kunci.toLowerCase().replace(/\s+/g,' ').trim()===i.value.trim().toLowerCase().replace(/\s+/g,' ').trim())s=soal.bobot;simpanKeFormJawaban(id,i.value.trim(),s);showToast('Tersimpan','success',800)},1000)}
function simpanPG(id){autoSavePG(id)}function simpanPGK(id){autoSavePGK(id)}function simpanBSSingle(id){autoSaveBSSingle(id)}function simpanBS(id,n){autoSaveBS(id,n)}
function simpanJodohDrag(id){const o=window.currentMatchingJawaban||{},soal=window.currentMatchingSoal;if(!soal){showError('Data soal tidak valid!');return}let k={};try{k=JSON.parse(soal.kunci)}catch(e){showError('Format kunci salah!');return}const totalKey=Object.keys(k).length,filledKey=Object.keys(o).length;if(filledKey<totalKey){showError(`Baru ${filledKey} dari ${totalKey} yang dipasangkan!`);return}let benar=0;for(let key in k)if(o[key]===k[key])benar++;jawabanLokal[id]=JSON.stringify(o);renderNavigator();simpanKeLocalStorage();const s=(benar/totalKey)*soal.bobot;simpanKeFormJawaban(id,JSON.stringify(o),s);showSuccess(`Jawaban tersimpan! (${benar}/${totalKey} benar)`)}
function simpanIsian(id){const i=document.getElementById('isian');if(!i||!i.value.trim()){showError("Isi jawaban!");return}jawabanLokal[id]=i.value.trim();renderNavigator();simpanKeLocalStorage();const soal=dataSoal.find(q=>q.id===id);let s=0;if(soal.kunci.toLowerCase().replace(/\s+/g,' ').trim()===i.value.trim().toLowerCase().replace(/\s+/g,' ').trim())s=soal.bobot;simpanKeFormJawaban(id,i.value.trim(),s);showSuccess("Jawaban tersimpan!")}
function prevSoal(){if(isFrozen)return;if(indexSoal>0)goToSoal(indexSoal-1)}function nextSoal(){if(isFrozen)return;if(indexSoal<dataSoal.length-1)goToSoal(indexSoal+1)}

// ==================== DRAG & DROP ====================
function initDragDropJodoh(){document.querySelectorAll('.matching-item-right[draggable="true"]').forEach(i=>{i.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',e.target.dataset.huruf)})});document.querySelectorAll('.matching-target').forEach(t=>{t.addEventListener('dragover',e=>e.preventDefault());t.addEventListener('drop',e=>{e.preventDefault();const tk=t.dataset.key,dk=e.dataTransfer.getData('text/plain');if(!tk||!dk)return;if(!window.currentMatchingJawaban)window.currentMatchingJawaban={};if(window.currentMatchingJawaban[tk]){showError('Sudah terisi!');return}if(Object.values(window.currentMatchingJawaban).includes(dk)){showError('Jawaban sudah dipakai!');return}window.currentMatchingJawaban[tk]=dk;updateMatchingUIJodoh();const soal=window.currentMatchingSoal;if(soal){let k={};try{k=JSON.parse(soal.kunci)}catch(e){}const totalKey=Object.keys(k).length,filledKey=Object.keys(window.currentMatchingJawaban).length;if(filledKey===totalKey){jawabanLokal[soal.id]=JSON.stringify(window.currentMatchingJawaban);renderNavigator();simpanKeLocalStorage();const s=(filledKey/totalKey)*soal.bobot;simpanKeFormJawaban(soal.id,JSON.stringify(window.currentMatchingJawaban),s);showSuccess(`✅ Semua terpasangkan! (${filledKey}/${totalKey})`)}else{showSuccess(`Dipasangkan! (${filledKey}/${totalKey})`)}}})})}
function updateMatchingUIJodoh(){const s=window.currentMatchingSoal,o=window.currentMatchingJawaban||{},map=window.hurufMapping||{};let k={};try{k=JSON.parse(s.kunci)}catch(e){}const istilahMap=parseIstilahDariPertanyaan(s.pertanyaan);const keys=Object.keys(k);for(let key of keys){const t=document.getElementById(`target_${key}`);if(t){const f=o[key]!==undefined,h=o[key]||'',teks=map[h]||'',istilah=istilahMap[key]||key;t.className=`matching-target ${f?'filled':'empty'}`;t.style.background=f?'#DCFCE7':'white';t.style.border=f?'2px solid #22C55E':'2px dashed #D97706';t.innerHTML=`<div style="text-align:left;">`;if(f){t.innerHTML+=`<div style="display:flex;align-items:center;gap:8px;"><span style="background:#22C55E;color:white;padding:4px 10px;border-radius:20px;font-size:12px;">${key}</span><span style="color:#16a34a;font-size:13px;"><i class="fas fa-check-circle"></i> ${h}. ${teks}</span></div><p style="margin-top:8px;font-size:14px;color:#1E293B;">${istilah}</p>`}else{t.innerHTML+=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span style="background:#D97706;color:white;padding:4px 10px;border-radius:20px;font-size:12px;">${key}</span><span style="color:#94a3b8;font-size:12px;"><i class="fas fa-arrow-right"></i> Tarik jawaban</span></div><p style="font-size:14px;color:#1E293B;">${istilah}</p>`}t.innerHTML+=`</div>`}}const used=Object.values(o),opsi=s.pilihan.filter(p=>p&&p.trim());opsi.forEach((opt,i)=>{const h=String.fromCharCode(65+i),d=document.getElementById(`drag_${h}`);if(d){const u=used.includes(h);d.className=`matching-item-right${u?' paired':''}`;d.setAttribute('draggable',!u);d.style.background=u?'#DCFCE7':'white';d.style.border=u?'2px solid #22C55E':'2px solid #1E3A8A';d.innerHTML=`<strong style="color:#1E3A8A;">${h}.</strong> ${opt.replace(/^[A-E]\.\s*/,'')}${u?'<span style="color:#16a34a;margin-left:8px;"><i class="fas fa-check-circle"></i></span>':''}`}});initDragDropJodoh()}
function resetMatching(){window.currentMatchingJawaban={};const soal=window.currentMatchingSoal;if(soal){delete jawabanLokal[soal.id];simpanKeLocalStorage();renderNavigator()}renderSoal(indexSoal);showToast('Pasangan direset','info')}

// ==================== TIMER & SELESAI ====================
function mulaiTimer(){if(!waktuSelesai)return;timerInterval=setInterval(()=>{const s=Math.max(waktuSelesai-new Date(),0),d=Math.floor(s/1000),m=Math.floor(d/60),sec=d%60;document.getElementById("timerDisplay").innerText=`${m}:${sec<10?"0":""}${sec}`;if(d===0&&!ujianSelesai){ujianSelesai=!0;clearInterval(timerInterval);showModal({iconType:"warning",title:"Waktu Habis",message:"Ujian akan otomatis berakhir.",buttons:[{text:"OK",type:"primary",onClick:()=>selesaiUjian()}]})}},1000)}
function konfirmasiSelesai(){if(isFrozen)return;if(!tombolSelesaiAktif){const s=Math.max(minimalMenit-Math.floor((new Date()-waktuMulaiServer)/60000),0);showError(`Tunggu ${s} menit lagi!`);return}const b=dataSoal.filter(s=>!jawabanLokal[s.id]).length;showModal({iconType:"warning",title:"Akhiri Ujian?",message:`📝 ${dataSoal.length-b} soal dijawab\n⚠️ ${b} soal belum`,showCheckbox:!0,checkboxLabel:"Saya yakin ingin mengakhiri ujian",buttons:[{text:"Lanjutkan",type:"secondary"},{text:"Ya, Selesai",type:"warning",onClick:c=>{if(!c){showError("Centang konfirmasi!");return!1}selesaiUjian()}}]})}
async function selesaiUjian(){
    clearInterval(timerInterval);if(freezeInterval)clearInterval(freezeInterval);ujianSelesai=!0;
    let t=0,b=0,tot=0;
    dataSoal.forEach(s=>{const j=jawabanLokal[s.id];const bo=s.bobot||1;tot+=bo;if(!j)return;
        if(s.tipe==="PG"){if(j===s.kunci)t+=bo,b++}
        else if(s.tipe==="PGK"){try{if(JSON.stringify(JSON.parse(j).sort())===JSON.stringify(JSON.parse(s.kunci).sort()))t+=bo,b++}catch(e){}}
        else if(s.tipe==="B/S"){try{if(j.startsWith('[')){const ja=JSON.parse(j),ka=JSON.parse(s.kunci);let x=0;for(let i=0;i<ka.length;i++)if(ja[i]===ka[i])x++;t+=(x/ka.length)*bo;if(x===ka.length)b++}else{if(j===s.kunci)t+=bo,b++}}catch(e){if(j===s.kunci)t+=bo,b++}}
        else if(s.tipe==="Jodoh"){try{const jo=JSON.parse(j),ko=JSON.parse(s.kunci);let benar=0;const tt=Object.keys(ko).length;for(let key in ko)if(jo[key]===ko[key])benar++;t+=(benar/tt)*bo;if(benar===tt)b++}catch(e){}}
        else if(s.tipe==="Isian"){const jn=j.toLowerCase().replace(/\s+/g,' ').trim(),kn=s.kunci.toLowerCase().replace(/\s+/g,' ').trim();if(kn.includes('|')){if(kn.split('|').map(k=>k.trim()).includes(jn))t+=bo,b++}else if(jn===kn)t+=bo,b++}
    });
    const p=tot>0?(t/tot)*100:0;
    if(document.exitFullscreen)document.exitFullscreen();document.getElementById("freezeOverlay").style.display="none";
    
    // ⭐ KIRIM NILAI AKHIR KE GOOGLE FORM NILAI
    try {
        const formData = new FormData();
        formData.append(FORM_NILAI_CONFIG.ENTRY_IDS.idSesi, idSesi);
        formData.append(FORM_NILAI_CONFIG.ENTRY_IDS.username, currentUser.username);
        formData.append(FORM_NILAI_CONFIG.ENTRY_IDS.nis, currentUser.nis);
        formData.append(FORM_NILAI_CONFIG.ENTRY_IDS.nama, currentUser.nama);
        formData.append(FORM_NILAI_CONFIG.ENTRY_IDS.jenjang, currentUser.jenjang);
        formData.append(FORM_NILAI_CONFIG.ENTRY_IDS.kelas, currentUser.kelas);
        formData.append(FORM_NILAI_CONFIG.ENTRY_IDS.mapel, currentUjian.mapel);
        formData.append(FORM_NILAI_CONFIG.ENTRY_IDS.jenisUjian, currentUjian.jenis);
        formData.append(FORM_NILAI_CONFIG.ENTRY_IDS.totalSkor, t.toFixed(2));
        formData.append(FORM_NILAI_CONFIG.ENTRY_IDS.jumlahBenar, b);
        formData.append(FORM_NILAI_CONFIG.ENTRY_IDS.jumlahSoal, dataSoal.length);
        formData.append(FORM_NILAI_CONFIG.ENTRY_IDS.persentase, p.toFixed(1) + '%');
        await fetch(FORM_NILAI_CONFIG.FORM_URL, { method: 'POST', body: formData, mode: 'no-cors' });
        console.log('✅ Nilai akhir terkirim ke Form Nilai');
    } catch(e) { console.error('❌ Gagal kirim nilai akhir:', e); }
    
    localStorage.removeItem(`jawaban_${idSesi}`);
    showModal({iconType:"success",title:"🎉 Ujian Selesai!",message:"",buttons:[{text:"Tutup",type:"success",onClick:()=>location.reload()}]});
    setTimeout(()=>{document.querySelector(".modal-message").innerHTML=`<div style="text-align:center;"><div style="font-size:48px;font-weight:800;color:#1E3A8A;">${t.toFixed(2)}</div><div>Total Skor</div><div style="display:flex;justify-content:center;gap:20px;margin-top:16px;"><div>${b}/${dataSoal.length} Benar</div><div>${p.toFixed(1)}%</div></div></div>`},10)
}

// ==================== INISIALISASI ====================
document.addEventListener('DOMContentLoaded',()=>{const y=document.getElementById('currentYear');if(y)y.textContent=new Date().getFullYear()});
