  
    // ==============================================================
    // MASUKKAN URL WEB APP API ANDA DI BAWAH INI
    // ==============================================================
    const API_URL = "https://script.google.com/macros/s/AKfycbyzTSGvKzD8D2ehAYJa3XH0NFXfzfTwqoUrLhK0XR-HsjFYUQmYkojV_K2DEPi0LwWx/exec";

    const WARDEN_NAMES = {
      "warden1": "NIK MUHAMMAD HAZIM BIN NIK ROHIMI",
      "warden2": "MUHAMAD FIRDAUS BIN NOORIZAN",
      "warden3": "NOR SYAFIQAH BINTI NOOR AZMI",
      "warden4": "FATIN ALIA BINTI MOHD SUHAIMIN",
      "warden5": "SITI NUR IZYANA BINTI CHE RAHIM",
      "kwarden": "MUHAMMAD AZUWAN BIN KAMARUDDIN",
      "pasrama": "SITI NUR FATIHAH BINTI MUSA",
      "pengawal": "Pengawal Keselamatan"
    };

    let allStudents = [];
    let allPending = [];
    let allMeritLogs = [];
    let allAktivitiLogs = [];
    let selectedStudents = new Set();
    let disc_selectedStudents = new Set();
    let actionModal, detailsModal, offcanvasLog, tambahModal, myPieChart, aktivitiDetailsModal;
    let userRole = "";
    let userEmail = "";

    window.onload = function () {
      actionModal = new bootstrap.Modal(document.getElementById('actionModal'));
      detailsModal = new bootstrap.Modal(document.getElementById('detailsModal'));
      tambahModal = new bootstrap.Modal(document.getElementById('tambahPelajarModal'));
      aktivitiDetailsModal = new bootstrap.Modal(document.getElementById('aktivitiDetailsModal'));
      offcanvasLog = new bootstrap.Offcanvas(document.getElementById('offcanvasLog'));
      setCurrentDateTime();
    };

    function setCurrentDateTime() {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      document.getElementById('customDate').value = now.toISOString().slice(0, 10);
      document.getElementById('customTime').value = now.toISOString().slice(11, 16);
    }

    async function callServer(actionData) {
      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(actionData),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });
      const result = await response.json();

      if (result.status === "error") throw new Error(result.message);
      return result.data !== undefined ? result.data : result;
    }

    async function prosesLogMasuk() {
      const uname = document.getElementById('loginUsername').value;
      const pass = document.getElementById('loginPass').value;
      const btn = document.getElementById('btnLogin');
      const err = document.getElementById('loginError');

      if (!uname || !pass) { err.innerText = "Sila isi ID Pengguna dan kata laluan."; err.style.display = 'block'; return; }
      btn.disabled = true; btn.innerText = "MENYEMAK..."; err.style.display = 'none';

      try {
        const res = await callServer({ action: "sahkanLogMasuk", username: uname, password: pass });
        if (res.status === "berjaya") {
          userRole = res.peranan; userEmail = res.username;
          document.getElementById('loginScreen').style.display = 'none';
          document.getElementById('mainDashboard').style.display = 'block';

          if (userRole === 'guard') {
            bukaKeberadaan();
          } else {
            paparMenuUtama();
          }

          loadDataServer();
        } else {
          err.innerText = res.mesej; err.style.display = 'block';
          btn.disabled = false; btn.innerText = "LOG MASUK";
        }
      } catch (e) {
        err.innerText = "Ralat: " + e.message;
        err.style.display = 'block';
        btn.disabled = false; btn.innerText = "LOG MASUK";
      }
    }

    function logKeluar() {
      userRole = ""; userEmail = "";
      document.getElementById('mainDashboard').style.display = 'none';
      document.getElementById('loginScreen').style.display = 'flex';
      document.getElementById('loginPass').value = '';
      document.getElementById('btnLogin').disabled = false;
      document.getElementById('btnLogin').innerText = "LOG MASUK";
    }

    async function loadDataServer() {
      document.getElementById('loader').style.display = 'flex';
      clearSelection();
      try {
        const data = await callServer({ action: "getAppInitData", username: userEmail });
        document.getElementById('userBadge').innerText = (data.role === 'warden' ? 'Warden' : 'Pengawal');

        if (data.role === 'warden') {
          document.getElementById('chartSection').style.display = 'block';
          document.getElementById('adminToolsSection').style.display = 'block';
        }

        document.getElementById('pendingSection').style.display = 'block';

        allPending = data.pending;
        allMeritLogs = data.meritLogs || [];
        allAktivitiLogs = data.aktivitiLogs || [];
        renderPendingData();
        renderData(data.students);

        if (data.classesList) {
          const classSelect = document.getElementById('newStudentClass');
          classSelect.innerHTML = '<option value="">-- Sila Pilih --</option>' + data.classesList.map(c => `<option value="${c}">${c}</option>`).join('');
        }
        if (data.dormsList) {
          const dormSelect = document.getElementById('newStudentDorm');
          dormSelect.innerHTML = '<option value="">-- Sila Pilih --</option>' + data.dormsList.map(d => `<option value="${d}">${d}</option>`).join('');
        }
      } catch (err) { alert("Ralat memuat data: " + err.message); }
      document.getElementById('loader').style.display = 'none';
    }

    function renderData(data) {
      allStudents = data;
      filterList();
      updateDashboard(allStudents);
    }

    function updateDashboard(students) {
      if (userRole !== 'warden') return;
      let masuk = 0, keluar = 0, sakit = 0;
      students.forEach(s => {
        if (s.status === 'Masuk') masuk++; else if (s.status === 'Keluar') keluar++; else if (s.status === 'Sakit') sakit++;
      });
      const ctx = document.getElementById('statusChart').getContext('2d');
      if (myPieChart) myPieChart.destroy();
      myPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['Masuk', 'Keluar', 'Sakit'], datasets: [{ data: [masuk, keluar, sakit], backgroundColor: ['#198754', '#dc3545', '#ffc107'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
      });
    }

    function filterList() {
      const searchTerm = document.getElementById('searchInput').value.toLowerCase();
      const statusFilter = document.getElementById('filterStatus').value;
      const container = document.getElementById('studentList');
      container.innerHTML = '';

      const filtered = allStudents.filter(s => {
        const matchSearch = String(s.name).toLowerCase().includes(searchTerm) ||
          String(s.classroom).toLowerCase().includes(searchTerm) ||
          String(s.block).toLowerCase().includes(searchTerm);
        const matchStatus = statusFilter === 'Semua' || s.status === statusFilter;
        return matchSearch && matchStatus;
      });

      if (filtered.length === 0) {
        container.innerHTML = `<div class="text-center text-muted mt-4"><i class="fas fa-search fa-2x mb-2"></i><p>Tiada rekod dijumpai</p></div>`;
        return;
      }

      filtered.forEach(s => {
        const isSel = selectedStudents.has(s.name) ? 'selected' : '';
        let badgeCls = s.status === 'Masuk' ? 'status-masuk' : (s.status === 'Keluar' ? 'status-keluar' : 'status-sakit');

        let timeStr = "-";
        let daysOutStr = "";
        if (s.timestamp) {
          let d = new Date(s.timestamp);
          timeStr = d.toLocaleDateString('ms-MY') + " " + d.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });
          if (s.status !== 'Masuk') {
            const diffTime = Math.abs(new Date() - d);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays > 0) {
              daysOutStr = `<span class="badge bg-warning text-dark ms-1" style="font-size: 0.7rem;"><i class="fas fa-calendar-times"></i> ${diffDays} hari</span>`;
            }
          }
        }

        let attachIcon = (s.imageUrl && s.imageUrl.trim() !== "")
          ? `<span class="badge bg-secondary ms-1" onclick="showDetails('${s.name}'); event.stopPropagation();" title="Ada Lampiran"><i class="fas fa-paperclip"></i> Lampiran</span>`
          : '';

        let meritPts = s.meritPoints || 0;
        let meritBadge = meritPts >= 0
          ? `<span class="badge bg-light text-success border border-success"><i class="fas fa-star text-warning"></i> ${meritPts} Mata</span>`
          : `<span class="badge bg-light text-danger border border-danger"><i class="fas fa-exclamation-triangle"></i> ${meritPts} Mata</span>`;

        const div = document.createElement('div');
        div.className = `student-card ${isSel}`;
        div.id = 'card-' + s.name.replace(/\s+/g, '-');
        div.innerHTML = `
          <div class="d-flex justify-content-between align-items-center">
            <div style="flex:1;" onclick="toggleSelection('${s.name}')">
              <h6 class="mb-1">${s.name} ${attachIcon}</h6>
              <small class="text-muted"><i class="fas fa-door-open me-1"></i>${s.classroom} | ${s.block}</small><br>
              <small class="text-muted" style="font-size:0.75rem;"><i class="far fa-clock me-1"></i>${timeStr}${daysOutStr}</small>
              <div class="mt-1">${meritBadge}</div>
            </div>
            <div class="text-end ms-2">
              <span class="status-badge ${badgeCls} mb-2 d-inline-block">${s.status}</span><br>
              <button class="btn btn-sm btn-light border" onclick="showDetails('${s.name}'); event.stopPropagation();"><i class="fas fa-info-circle text-info"></i></button>
              ${userRole === 'warden' ? `<button class="btn btn-sm btn-light border text-danger ms-1" onclick="buangPelajar('${s.name.replace(/'/g, "\\'")}'); event.stopPropagation();"><i class="fas fa-trash-alt"></i></button>` : ''}
            </div>
          </div>
        `;
        container.appendChild(div);
      });
    }

    function pilihPukal(jenis) {
      const searchTerm = document.getElementById('searchInput').value.toLowerCase();
      const statusFilter = document.getElementById('filterStatus').value;

      allStudents.forEach(s => {
        const matchSearch = String(s.name).toLowerCase().includes(searchTerm) || String(s.classroom).toLowerCase().includes(searchTerm) || String(s.block).toLowerCase().includes(searchTerm);
        const matchStatus = statusFilter === 'Semua' || s.status === statusFilter;

        if (matchSearch && matchStatus) {
          if (jenis === 'Semua' || s.status === jenis) {
            selectedStudents.add(s.name);
          }
        }
      });
      filterList();
      updateBottomBar();
    }

    function renderPendingData() {
      const container = document.getElementById('pendingContainer');
      document.getElementById('pendingCount').innerText = allPending.length;
      container.innerHTML = '';

      if (allPending.length === 0) { document.getElementById('pendingSection').style.display = 'none'; return; }
      document.getElementById('pendingSection').style.display = 'block';

      allPending.forEach(p => {
        let badgeCls = p.action === 'Masuk' ? 'status-masuk' : (p.action === 'Keluar' ? 'status-keluar' : 'status-sakit');
        let d = new Date(p.timestamp);
        let timeStr = d.toLocaleDateString('ms-MY') + " " + d.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });

        let actionButtons = "";
        if (userRole === 'warden') {
          actionButtons = `
              <button class="btn btn-sm btn-success mb-1" onclick="resolvePendingReq('${p.id}', true)"><i class="fas fa-check"></i></button>
              <button class="btn btn-sm btn-danger" onclick="resolvePendingReq('${p.id}', false)"><i class="fas fa-times"></i></button>
            `;
        } else {
          actionButtons = `<span class="badge bg-warning text-dark px-2 py-2"><i class="fas fa-hourglass-half me-1"></i> Menunggu...</span>`;
        }

        const div = document.createElement('div');
        div.className = `student-card pending-card`;
        div.id = 'pending-' + p.id;
        div.innerHTML = `
          <div class="d-flex justify-content-between">
            <div>
              <h6 class="mb-1">${p.name}</h6>
              <span class="status-badge ${badgeCls}">${p.action}</span>
              <small class="text-muted ms-2">${timeStr}</small>
              <p class="mb-0 mt-1 small text-secondary"><i class="fas fa-comment-dots"></i> ${p.reason || '-'}</p>
              ${p.imageUrl ? `<a href="${p.imageUrl}" target="_blank" class="badge bg-secondary text-decoration-none mt-1"><i class="fas fa-paperclip"></i> Lihat Gambar</a>` : ''}
              <p class="mb-0 mt-1 small text-muted" style="font-size:0.7rem;">Oleh: ${p.guardEmail}</p>
            </div>
            <div class="d-flex flex-column justify-content-center align-items-end">
              ${actionButtons}
            </div>
          </div>
        `;
        container.appendChild(div);
      });
    }

    function showDetails(name) {
      let s = allStudents.find(x => x.name === name);
      if (!s) return;
      document.getElementById('d_name').innerText = s.name;
      document.getElementById('d_class').innerText = s.classroom;
      document.getElementById('d_block').innerText = s.block;

      let badge = document.getElementById('d_status');
      badge.innerText = s.status;
      badge.className = "status-badge " + (s.status === 'Masuk' ? 'status-masuk' : (s.status === 'Keluar' ? 'status-keluar' : 'status-sakit'));

      let d_merit = document.getElementById('d_merit');
      if (d_merit) {
        let meritPts = s.meritPoints || 0;
        d_merit.innerHTML = meritPts >= 0
          ? `<i class="fas fa-star text-warning"></i> ${meritPts} Mata Merit`
          : `<i class="fas fa-exclamation-triangle text-danger"></i> ${meritPts} Mata Demerit`;
      }

      if (s.timestamp) {
        let d = new Date(s.timestamp);
        let timeStr = d.toLocaleDateString('ms-MY') + " " + d.toLocaleTimeString('ms-MY');
        if (s.status !== 'Masuk') {
          const diffTime = Math.abs(new Date() - d);
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > 0) {
            timeStr += ` (${diffDays} hari tidak masuk)`;
          }
        }
        document.getElementById('d_time').innerText = timeStr;
      } else { document.getElementById('d_time').innerText = "-"; }

      if (s.reason && s.reason !== "-") {
        document.getElementById('d_reason_box').style.display = 'block';
        document.getElementById('d_reason').innerText = s.reason;
      } else { document.getElementById('d_reason_box').style.display = 'none'; }

      if (s.imageUrl && s.imageUrl !== "") {
        document.getElementById('d_img_box').style.display = 'block';
        document.getElementById('d_img').src = s.imageUrl;
        document.getElementById('d_img_link').href = s.imageUrl;
      } else { document.getElementById('d_img_box').style.display = 'none'; }

      detailsModal.show();
    }

    function toggleSelection(name) {
      if (selectedStudents.has(name)) { selectedStudents.delete(name); } else { selectedStudents.add(name); }
      const card = document.getElementById('card-' + name.replace(/\s+/g, '-'));
      if (card) { card.classList.toggle('selected'); }
      updateBottomBar();
    }

    function clearSelection() {
      selectedStudents.clear();
      document.querySelectorAll('.student-card.selected').forEach(el => el.classList.remove('selected'));
      updateBottomBar();
    }

    function updateBottomBar() {
      const bar = document.getElementById('bottomBar');
      const count = document.getElementById('selectionCount');
      if (selectedStudents.size > 0) {
        count.innerText = `${selectedStudents.size} Dipilih`;
        bar.style.display = 'flex';
      } else { bar.style.display = 'none'; }
    }

    function openActionModal() {
      document.getElementById('studentNames').value = JSON.stringify(Array.from(selectedStudents));
      document.getElementById('cameraInput').value = "";
      document.getElementById('imageFile').value = "";
      document.getElementById('imagePreview').style.display = 'none';
      setCurrentDateTime();
      toggleReasonField();
      actionModal.show();
    }

    function toggleReasonField() {
      var action = document.getElementById('actionType').value;
      var group = document.getElementById('reasonGroup');
      if (action === 'Masuk') { group.style.display = 'none'; document.getElementById('reason').value = ""; }
      else { group.style.display = 'block'; }
    }

    function compressAndConvertToBase64() {
      var file = document.getElementById('cameraInput').files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (event) {
        var img = new Image();
        img.onload = function () {
          var canvas = document.createElement('canvas');
          var ctx = canvas.getContext('2d');
          var MAX_WIDTH = 800; var MAX_HEIGHT = 800;
          var width = img.width; var height = img.height;
          if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
          else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
          canvas.width = width; canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          var dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          document.getElementById('imageFile').value = dataUrl;
          document.getElementById('previewImg').src = dataUrl;
          document.getElementById('imagePreview').style.display = 'block';
        }
        img.src = event.target.result;
      }
      reader.readAsDataURL(file);
    }

    function submitForm() {
      var f = document.getElementById('statusForm');
      if (f.actionType.value !== 'Masuk' && f.reason.value.trim() === '') { alert("Sila nyatakan sebab / tujuan."); return; }
      actionModal.hide();
      document.getElementById('savingToast').style.display = 'block';
      sendDataOptimistic();
    }

    async function sendDataOptimistic() {
      var f = document.getElementById('statusForm');
      var rawNames = f.studentNames.value; var names = JSON.parse(rawNames);
      var action = f.actionType.value; var reason = f.reason.value;
      var timestamp = f.customDate.value + 'T' + f.customTime.value;
      var imageBase64 = f.imageFile.value;

      if (userRole === 'warden') {
        names.forEach(n => {
          var s = allStudents.find(x => x.name === n);
          if (s) {
            s.status = action;
            s.reason = (action === 'Masuk') ? '-' : reason;
            s.timestamp = timestamp;
            if (imageBase64) s.imageUrl = imageBase64;
          }
        });
        renderData(allStudents);
      }
      clearSelection();

      var d = { studentNames: rawNames, actionType: action, customDate: f.customDate.value, customTime: f.customTime.value, reason: reason, imageFile: imageBase64 };

      try {
        const res = await callServer({ action: "processEntry", data: d, username: userEmail });
        document.getElementById('savingToast').style.display = 'none';
        var syncToast = document.getElementById('syncToast');
        syncToast.innerHTML = '<i class="fas fa-check-circle text-success me-2"></i> ' + res;
        syncToast.style.display = 'block'; setTimeout(() => { syncToast.style.display = 'none'; }, 4000);
        if (userRole === 'guard') { loadDataServer(); }
      } catch (err) {
        alert("Gagal menghantar rekod: " + err.message);
        document.getElementById('savingToast').style.display = 'none'; loadDataServer();
      }
    }

    async function resolvePendingReq(id, isApproved) {
      document.getElementById('savingToast').style.display = 'block';
      var card = document.getElementById('pending-' + id);
      if (card) card.style.display = 'none';
      try {
        const res = await callServer({ action: "resolvePending", id: id, isApproved: isApproved, username: userEmail });
        document.getElementById('savingToast').style.display = 'none';
        var syncToast = document.getElementById('syncToast');
        syncToast.innerHTML = '<i class="fas fa-info-circle text-info me-2"></i> ' + res;
        syncToast.style.display = 'block'; setTimeout(() => { syncToast.style.display = 'none'; }, 4000);

        const data = await callServer({ action: "getAppInitData", username: userEmail });
        allPending = data.pending; renderPendingData(); renderData(data.students);
      } catch (err) {
        document.getElementById('savingToast').style.display = 'none';
        var syncToast = document.getElementById('syncToast');
        syncToast.innerHTML = '<i class="fas fa-exclamation-triangle text-danger me-2"></i> Gagal diproses.';
        syncToast.style.display = 'block'; setTimeout(() => { syncToast.style.display = 'none'; }, 4000);
        if (card) card.style.display = 'block';
      }
    }

    // ==========================================
    // FUNGSI MUAT TURUN PDF (jsPDF)
    // ==========================================
    function muatTurunPDFSalahLaku() {
      if (!currentHistoryStudent) return;
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      doc.setFontSize(14);
      doc.text("Lampiran Senarai Salah Laku", 14, 20);

      doc.setFontSize(10);
      doc.text("Nama Pelajar : " + currentHistoryStudent, 14, 28);

      let student = allStudents.find(s => s.name === currentHistoryStudent);
      if (student) {
        doc.text("Kelas : " + (student.classroom || "-") + "   |   Dorm : " + (student.block || "-"), 14, 34);
      }
      doc.text("Tarikh Cetakan : " + new Date().toLocaleDateString('ms-MY'), 14, 40);

      const monthFilter = document.getElementById('filterMonth') ? document.getElementById('filterMonth').value : "all";
      let salahLakuLogs = allMeritLogs.filter(log => {
        if (log.name !== currentHistoryStudent) return false;
        if (log.type !== 'Demerit') return false;
        if (monthFilter !== "all") {
          let d = new Date(log.timestamp);
          if ((d.getMonth() + 1).toString() !== monthFilter) return false;
        }
        return true;
      });

      let sortedLogs = [...salahLakuLogs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      const tableData = sortedLogs.map((log, index) => {
        let d = new Date(log.timestamp);
        let timeStr = d.toLocaleDateString('ms-MY') + " " + d.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });
        return [
          index + 1,
          timeStr,
          log.reason || '-'
        ];
      });

      doc.autoTable({
        startY: 46,
        head: [['No', 'Tarikh & Masa', 'Sebab / Catatan']],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 10,
          textColor: [0, 0, 0],
          lineColor: [180, 180, 180],
          lineWidth: 0.1,
          cellPadding: 2,
          valign: 'middle'
        },
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 15, halign: 'center' },
          1: { cellWidth: 45 },
          2: { cellWidth: 'auto' }
        }
      });

      doc.save("Salah_Laku_" + currentHistoryStudent.replace(/[^a-zA-Z0-9]/g, '_') + ".pdf");
    }

    function muatTurunPDF() {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      doc.setFontSize(14);
      doc.text("Laporan E-Kehadiran Asrama", 14, 20);

      doc.setFontSize(10);
      const statusFilter = document.getElementById('filterStatus').value;
      doc.text("Tapisan Status : " + statusFilter, 14, 28);
      doc.text("Tarikh Laporan : " + new Date().toLocaleDateString('ms-MY'), 14, 34);

      const searchTerm = document.getElementById('searchInput').value.toLowerCase();
      const filtered = allStudents.filter(s => {
        const matchSearch = String(s.name).toLowerCase().includes(searchTerm) ||
          String(s.classroom).toLowerCase().includes(searchTerm) ||
          String(s.block).toLowerCase().includes(searchTerm);
        const matchStatus = statusFilter === 'Semua' || s.status === statusFilter;
        return matchSearch && matchStatus;
      });

      const tableData = filtered.map((s, index) => {
        let timeStr = "-";
        if (s.timestamp) {
          let d = new Date(s.timestamp);
          timeStr = d.toLocaleDateString('ms-MY') + " " + d.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });
          if (s.status !== 'Masuk') {
            const diffTime = Math.abs(new Date() - d);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays > 0) {
              timeStr += ` (${diffDays} hari)`;
            }
          }
        }
        return [index + 1, s.name, s.classroom, s.block, s.status, timeStr, s.reason || '-'];
      });

      doc.autoTable({
        startY: 40,
        head: [['No', 'Nama', 'Kelas', 'Dorm', 'Status', 'Masa', 'Sebab/Tujuan']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [13, 110, 253] }
      });

      doc.save("Laporan_Kehadiran_Asrama.pdf");
    }

    // ==========================================
    // FUNGSI BARU: LOG PERGERAKAN HARI INI
    // ==========================================
    function bukaLogHariIni() {
      const container = document.getElementById('logHariIniContainer');
      container.innerHTML = ''; // Kosongkan data lama

      // Dapatkan tarikh mula hari ini (00:00:00)
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      // Tapis hanya pelajar yang ada rekod pada hari ini sahaja
      const logsToday = allStudents.filter(s => {
        if (!s.timestamp) return false;
        let d = new Date(s.timestamp);
        return d >= startOfToday; // Bandingkan jika tarikh lebih besar dari mula hari ini
      });

      // Susun mengikut waktu paling terkini di atas
      logsToday.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Jika tiada pergerakan
      if (logsToday.length === 0) {
        container.innerHTML = `
          <div class="text-center p-4">
            <i class="fas fa-box-open fa-3x text-muted mb-3"></i>
            <p class="text-muted">Tiada pergerakan direkodkan pada hari ini.</p>
          </div>
        `;
      } else {
        // Bina senarai pergerakan
        let html = '<ul class="list-group list-group-flush">';
        logsToday.forEach(s => {
          let d = new Date(s.timestamp);
          let timeStr = d.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });
          let badgeCls = s.status === 'Masuk' ? 'status-masuk' : (s.status === 'Keluar' ? 'status-keluar' : 'status-sakit');

          html += `
          <li class="list-group-item d-flex justify-content-between align-items-center px-3 py-3 border-bottom">
            <div>
              <h6 class="mb-1" style="font-size: 0.95rem;">${s.name}</h6>
              <small class="text-muted d-block" style="font-size: 0.75rem;">
                <i class="far fa-clock me-1"></i>${timeStr} &nbsp;|&nbsp; <i class="fas fa-door-open me-1"></i>${s.classroom}
              </small>
            </div>
            <span class="status-badge ${badgeCls}">${s.status}</span>
          </li>`;
        });
        html += '</ul>';
        container.innerHTML = html;
      }

      // Buka Offcanvas (Menu Tepi)
      offcanvasLog.show();
    }

    // ==========================================
    // FUNGSI URUS PELAJAR (TAMBAH / BUANG)
    // ==========================================
    function bukaModalTambah() {
      document.getElementById('newStudentName').value = '';
      document.getElementById('newStudentClass').value = '';
      document.getElementById('newStudentGender').value = 'Lelaki';
      document.getElementById('newStudentReligion').value = 'Islam';
      document.getElementById('newStudentDorm').value = '';
      tambahModal.show();
    }

    async function simpanPelajarBaru() {
      const nama = document.getElementById('newStudentName').value.trim();
      const kelas = document.getElementById('newStudentClass').value.trim();
      const gender = document.getElementById('newStudentGender').value;
      const religion = document.getElementById('newStudentReligion').value;
      const dorm = document.getElementById('newStudentDorm').value.trim();

      if (!nama || !kelas || !gender || !religion || !dorm) { alert("Sila isi semua maklumat."); return; }

      document.getElementById('savingToast').style.display = 'block';
      tambahModal.hide();

      try {
        const res = await callServer({
          action: "addStudent",
          name: nama,
          classroom: kelas,
          gender: gender,
          religion: religion,
          block: dorm,
          username: userEmail
        });
        document.getElementById('savingToast').style.display = 'none';
        var syncToast = document.getElementById('syncToast');
        syncToast.innerHTML = '<i class="fas fa-check-circle text-success me-2"></i> Pelajar ditambah.';
        syncToast.style.display = 'block'; setTimeout(() => { syncToast.style.display = 'none'; }, 4000);

        loadDataServer(); // Muat semula senarai dari server
      } catch (err) {
        document.getElementById('savingToast').style.display = 'none';
        alert("Gagal menambah pelajar: " + err.message);
      }
    }

    async function buangPelajar(nama) {
      if (!confirm("Anda pasti mahu memadam rekod pelajar: " + nama + "?")) return;

      document.getElementById('savingToast').style.display = 'block';
      try {
        const res = await callServer({
          action: "removeStudent",
          name: nama,
          username: userEmail
        });
        document.getElementById('savingToast').style.display = 'none';
        var syncToast = document.getElementById('syncToast');
        syncToast.innerHTML = '<i class="fas fa-trash text-success me-2"></i> Pelajar dipadam.';
        syncToast.style.display = 'block'; setTimeout(() => { syncToast.style.display = 'none'; }, 4000);

        loadDataServer(); // Muat semula senarai dari server
      } catch (err) {
        document.getElementById('savingToast').style.display = 'none';
        alert("Gagal memadam pelajar: " + err.message);
      }
    }

    // ==========================================
    // FUNGSI ROUTING & REKOD DISIPLIN
    // ==========================================
    function paparMenuUtama() {
      document.getElementById('mainMenuView').style.display = 'block';

      const welcomeEl = document.getElementById('welcomeNameText');
      if (welcomeEl) {
        welcomeEl.innerText = (typeof WARDEN_NAMES !== 'undefined' && WARDEN_NAMES[userEmail])
          ? WARDEN_NAMES[userEmail]
          : userEmail;
      }

      document.getElementById('attendanceView').style.display = 'none';
      document.getElementById('disciplineView').style.display = 'none';
      document.getElementById('reportView').style.display = 'none';
      document.getElementById('penjanaLaporanView').style.display = 'none';
      document.getElementById('aktivitiMenuView').style.display = 'none';
      document.getElementById('aktivitiFormView').style.display = 'none';
      document.getElementById('btnBackMenu').style.display = 'none';
    }

    function bukaKeberadaan() {
      document.getElementById('mainMenuView').style.display = 'none';
      document.getElementById('attendanceView').style.display = 'block';
      document.getElementById('disciplineView').style.display = 'none';
      document.getElementById('reportView').style.display = 'none';
      document.getElementById('penjanaLaporanView').style.display = 'none';

      if (userRole === 'warden') {
        document.getElementById('btnBackMenu').style.display = 'block';
      } else {
        document.getElementById('btnBackMenu').style.display = 'none';
      }

      filterList();
    }

    function bukaLaporan() {
      document.getElementById('mainMenuView').style.display = 'none';
      document.getElementById('attendanceView').style.display = 'none';
      document.getElementById('disciplineView').style.display = 'none';
      document.getElementById('reportView').style.display = 'block';
      document.getElementById('penjanaLaporanView').style.display = 'none';
      document.getElementById('aktivitiMenuView').style.display = 'none';
      document.getElementById('aktivitiFormView').style.display = 'none';
      document.getElementById('btnBackMenu').style.display = 'block';

      renderReportIndividu();
    }

    function bukaDisiplin(jenis) {
      document.getElementById('mainMenuView').style.display = 'none';
      document.getElementById('attendanceView').style.display = 'none';
      document.getElementById('disciplineView').style.display = 'block';
      document.getElementById('reportView').style.display = 'none';
      document.getElementById('penjanaLaporanView').style.display = 'none';
      document.getElementById('aktivitiMenuView').style.display = 'none';
      document.getElementById('aktivitiFormView').style.display = 'none';
      document.getElementById('btnBackMenu').style.display = 'block';

      document.getElementById('disc_type').value = jenis;
      const title = document.getElementById('disciplineTitle');
      const btn = document.getElementById('btnHantarDisiplin');

      if (jenis === 'Merit') {
        title.innerHTML = '<i class="fas fa-star text-success me-2"></i> Rekod Amalan Baik';
        btn.className = 'btn btn-lg w-100 text-white btn-success';
        document.getElementById('disc_tindakan_group').style.display = 'none';
      } else {
        title.innerHTML = '<i class="fas fa-exclamation-triangle text-danger me-2"></i> Rekod Salah Laku';
        btn.className = 'btn btn-lg w-100 text-white btn-danger';
        document.getElementById('disc_tindakan_group').style.display = 'block';
      }

      // Setup forms
      document.getElementById('disc_date').value = new Date().toISOString().split('T')[0];
      document.getElementById('disc_points').value = '';
      document.querySelectorAll('.point-btn').forEach(btn => {
        btn.classList.remove('active', 'btn-primary', 'text-white');
        btn.classList.add('btn-outline-primary');
      });
      document.getElementById('disc_reason').value = '';
      document.getElementById('disc_tindakan').value = '';
      document.getElementById('disc_cameraInput').value = '';
      disc_selectedStudents.clear();
      document.getElementById('disc_imageFile').value = '';
      document.getElementById('disc_imagePreview').style.display = 'none';

      // Setup Dorm List
      const uniqueDorms = [...new Set(allStudents.map(s => s.block))].filter(b => b.trim() !== "");
      uniqueDorms.sort();
      const dormSelect = document.getElementById('disc_dormSelect');
      dormSelect.innerHTML = uniqueDorms.map(d => `<option value="${d}">${d}</option>`).join('');

      filterDisciplineStudents();
    }

    function toggleDisciplineTarget() {
      const target = document.getElementById('disc_targetType').value;
      if (target === 'Individu') {
        document.getElementById('disc_individu_group').style.display = 'block';
        document.getElementById('disc_dorm_group').style.display = 'none';
      } else {
        document.getElementById('disc_individu_group').style.display = 'none';
        document.getElementById('disc_dorm_group').style.display = 'block';
      }
    }

    function filterDisciplineStudents() {
      const search = document.getElementById('disc_search').value.toLowerCase();
      const list = document.getElementById('disc_studentList');
      list.innerHTML = '';

      const filtered = allStudents.filter(s => s.name.toLowerCase().includes(search) && s.status === "Masuk");
      filtered.forEach(s => {
        const isChecked = disc_selectedStudents.has(s.name) ? 'checked' : '';
        list.innerHTML += `
          <div class="form-check border-bottom py-2">
            <input class="form-check-input disc-student-cb" type="checkbox" value="${s.name}" id="cb_${s.name.replace(/[^a-zA-Z0-9]/g, '')}" ${isChecked} onchange="toggleDiscStudent('${s.name}', this.checked)">
            <label class="form-check-label w-100" for="cb_${s.name.replace(/[^a-zA-Z0-9]/g, '')}">
              ${s.name} <small class="text-muted">(${s.block})</small>
            </label>
          </div>
        `;
      });
    }

    function setDiscPoints(val) {
      document.getElementById('disc_points').value = val;
      const btns = document.querySelectorAll('.point-btn');
      btns.forEach(btn => {
        btn.classList.remove('active', 'btn-primary', 'text-white');
        btn.classList.add('btn-outline-primary');
      });
      const activeBtn = Array.from(btns).find(b => b.innerText == val);
      if (activeBtn) {
        activeBtn.classList.remove('btn-outline-primary');
        activeBtn.classList.add('active', 'btn-primary', 'text-white');
      }
    }

    function toggleDiscStudent(name, isChecked) {
      if (isChecked) {
        disc_selectedStudents.add(name);
      } else {
        disc_selectedStudents.delete(name);
      }
    }

    function compressDiscImage() {
      var file = document.getElementById('disc_cameraInput').files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (event) {
        var img = new Image();
        img.onload = function () {
          var canvas = document.createElement('canvas');
          var ctx = canvas.getContext('2d');
          var MAX_WIDTH = 800; var MAX_HEIGHT = 800;
          var width = img.width; var height = img.height;
          if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
          else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
          canvas.width = width; canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          var dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          document.getElementById('disc_imageFile').value = dataUrl;
          document.getElementById('disc_previewImg').src = dataUrl;
          document.getElementById('disc_imagePreview').style.display = 'block';
        }
        img.src = event.target.result;
      }
      reader.readAsDataURL(file);
    }

    async function hantarRekodDisiplin() {
      const type = document.getElementById('disc_type').value;
      const targetType = document.getElementById('disc_targetType').value;
      let points = parseInt(document.getElementById('disc_points').value);
      const reason = document.getElementById('disc_reason').value.trim();
      const tindakan = document.getElementById('disc_tindakan').value.trim();
      const imageBase64 = document.getElementById('disc_imageFile').value;
      const customDate = document.getElementById('disc_date').value;

      if (!points || points < 1 || points > 10) { alert("Sila masukkan mata antara 1 hingga 10."); return; }
      if (!reason) { alert("Sila nyatakan catatan/sebab."); return; }
      if (!customDate) { alert("Sila pilih tarikh."); return; }

      let targetStudents = [];
      if (targetType === 'Individu') {
        targetStudents = Array.from(disc_selectedStudents);
        if (targetStudents.length === 0) { alert("Sila pilih sekurang-kurangnya seorang pelajar."); return; }
      } else {
        const dorm = document.getElementById('disc_dormSelect').value;
        targetStudents = allStudents.filter(s => s.block === dorm && s.status === "Masuk").map(s => s.name);
        if (targetStudents.length === 0) { alert("Tiada pelajar yang hadir dijumpai di dorm ini."); return; }
        if (!confirm(`Tindakan ini akan mengemaskini mata untuk ${targetStudents.length} pelajar yang HADIR di dorm ${dorm}. Teruskan?`)) return;
      }

      if (type === 'Demerit') {
        points = -Math.abs(points);
      }

      document.getElementById('savingToast').style.display = 'block';
      const btn = document.getElementById('btnHantarDisiplin');
      btn.disabled = true;

      try {
        const payload = {
          action: "recordBehavior",
          studentNames: JSON.stringify(targetStudents),
          type: type,
          points: points,
          reason: reason,
          tindakan: type === 'Demerit' ? tindakan : '',
          imageFile: imageBase64,
          customDate: customDate,
          username: userEmail
        };

        await callServer(payload);
        document.getElementById('savingToast').style.display = 'none';

        var syncToast = document.getElementById('syncToast');
        syncToast.innerHTML = '<i class="fas fa-check-circle text-success me-2"></i> Rekod disimpan.';
        syncToast.style.display = 'block'; setTimeout(() => { syncToast.style.display = 'none'; }, 4000);

        btn.disabled = false;
        loadDataServer();
        paparMenuUtama();
      } catch (err) {
        document.getElementById('savingToast').style.display = 'none';
        alert("Ralat menyimpan rekod: " + err.message);
        btn.disabled = false;
      }
    }

    // ==========================================
    // FUNGSI AKTIVITI
    // ==========================================
    function bukaAktivitiMenu() {
      document.getElementById('mainMenuView').style.display = 'none';
      document.getElementById('attendanceView').style.display = 'none';
      document.getElementById('disciplineView').style.display = 'none';
      document.getElementById('reportView').style.display = 'none';
      document.getElementById('penjanaLaporanView').style.display = 'none';
      document.getElementById('aktivitiMenuView').style.display = 'block';
      document.getElementById('aktivitiFormView').style.display = 'none';
      document.getElementById('btnBackMenu').style.display = 'block';
    }

    function bukaAktivitiForm(jenisAktiviti) {
      document.getElementById('aktivitiMenuView').style.display = 'none';
      document.getElementById('aktivitiFormView').style.display = 'block';

      document.getElementById('aktivitiTitle').innerText = "Rekod: " + jenisAktiviti;
      document.getElementById('akt_type').value = jenisAktiviti;

      if (jenisAktiviti.includes('Bilik Khas')) {
        document.getElementById('akt_bilikKhas_group').style.display = 'block';
      } else {
        document.getElementById('akt_bilikKhas_group').style.display = 'none';
      }

      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      document.getElementById('akt_date').value = now.toISOString().slice(0, 10);
      document.getElementById('akt_time').value = now.toISOString().slice(11, 16);

      document.getElementById('akt_targetType').value = 'Dorm';
      toggleAktivitiTarget();
      populateAktivitiDropdowns();

      document.getElementById('akt_imageFile').value = "";
      document.getElementById('akt_cameraInput').value = "";
      document.getElementById('akt_imagePreview').style.display = "none";
    }

    function toggleAktivitiTarget() {
      const target = document.getElementById('akt_targetType').value;
      document.getElementById('akt_individu_group').style.display = target === 'Individu' ? 'block' : 'none';
      document.getElementById('akt_dorm_group').style.display = target === 'Dorm' ? 'block' : 'none';
      document.getElementById('akt_kelas_group').style.display = target === 'Kelas' ? 'block' : 'none';
    }

    function populateAktivitiDropdowns() {
      const dormSelect = document.getElementById('akt_dormSelect');
      const classSelect = document.getElementById('akt_kelasSelect');
      dormSelect.innerHTML = '';
      classSelect.innerHTML = '';

      let dorms = new Set();
      let classes = new Set();
      allStudents.forEach(s => {
        if (s.block) dorms.add(s.block);
        if (s.classroom) classes.add(s.classroom);
      });

      Array.from(dorms).sort().forEach(d => {
        const opt = document.createElement('option');
        opt.value = d; opt.text = d;
        dormSelect.appendChild(opt);
      });

      Array.from(classes).sort().forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.text = c;
        classSelect.appendChild(opt);
      });

      filterAktivitiStudents();
    }

    let akt_selectedStudents = new Set();
    function filterAktivitiStudents() {
      const term = document.getElementById('akt_search').value.toLowerCase();
      const container = document.getElementById('akt_studentList');
      const aktType = document.getElementById('akt_type').value;
      container.innerHTML = '';

      allStudents.forEach(s => {
        if (s.status !== 'Masuk') return;
        if (aktType.includes('Solat Berjemaah') && s.religion.toLowerCase() !== 'islam') return;

        if (s.name.toLowerCase().includes(term) || (s.classroom && s.classroom.toLowerCase().includes(term))) {
          const div = document.createElement('div');
          div.className = "form-check mb-1 border-bottom pb-1";

          const chk = document.createElement('input');
          chk.className = "form-check-input";
          chk.type = "checkbox";
          chk.value = s.name;
          chk.id = "akt_chk_" + s.name.replace(/\s+/g, '');
          chk.checked = akt_selectedStudents.has(s.name);

          chk.onchange = (e) => {
            if (e.target.checked) akt_selectedStudents.add(s.name);
            else akt_selectedStudents.delete(s.name);
          };

          const lbl = document.createElement('label');
          lbl.className = "form-check-label";
          lbl.htmlFor = chk.id;
          lbl.innerHTML = `<strong>${s.name}</strong> <small class="text-muted">(${s.classroom || '-'} / ${s.block || '-'})</small>`;

          div.appendChild(chk);
          div.appendChild(lbl);
          container.appendChild(div);
        }
      });
    }

    function selectAllAktivitiStudents() {
      const container = document.getElementById('akt_studentList');
      const checkboxes = container.querySelectorAll('.form-check-input');

      let allSelected = true;
      checkboxes.forEach(chk => { if (!chk.checked) allSelected = false; });

      checkboxes.forEach(chk => {
        chk.checked = !allSelected;
        if (!allSelected) akt_selectedStudents.add(chk.value);
        else akt_selectedStudents.delete(chk.value);
      });
    }

    function compressAktImage() {
      const file = document.getElementById('akt_cameraInput').files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          } else {
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
          }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          document.getElementById('akt_imageFile').value = dataUrl;
          document.getElementById('akt_previewImg').src = dataUrl;
          document.getElementById('akt_imagePreview').style.display = 'block';
        }
        img.src = e.target.result;
      }
      reader.readAsDataURL(file);
    }

    async function hantarRekodAktiviti() {
      let type = document.getElementById('akt_type').value;
      if (type.includes('Bilik Khas')) {
        type = "Bilik Khas: " + document.getElementById('akt_bilikKhas_select').value;
      }
      const targetType = document.getElementById('akt_targetType').value;
      const date = document.getElementById('akt_date').value;
      const time = document.getElementById('akt_time').value;
      const imageBase64 = document.getElementById('akt_imageFile').value;

      let targetStudents = [];
      if (targetType === 'Dorm') {
        const dorm = document.getElementById('akt_dormSelect').value;
        let filtered = allStudents.filter(s => s.block === dorm && s.status === 'Masuk');
        if (type.includes('Solat Berjemaah')) filtered = filtered.filter(s => s.religion.toLowerCase() === 'islam');
        targetStudents = filtered.map(s => s.name);
      } else if (targetType === 'Kelas') {
        const kls = document.getElementById('akt_kelasSelect').value;
        let filtered = allStudents.filter(s => s.classroom === kls && s.status === 'Masuk');
        if (type.includes('Solat Berjemaah')) filtered = filtered.filter(s => s.religion.toLowerCase() === 'islam');
        targetStudents = filtered.map(s => s.name);
      } else {
        targetStudents = Array.from(akt_selectedStudents);
      }

      if (targetStudents.length === 0) {
        alert("Sila pilih sekurang-kurangnya seorang pelajar.");
        return;
      }

      const btn = document.getElementById('btnHantarAktiviti');
      btn.disabled = true;
      document.getElementById('savingToast').style.display = 'flex';

      let wardenName = (typeof WARDEN_NAMES !== 'undefined' && WARDEN_NAMES[userEmail]) ? WARDEN_NAMES[userEmail] : userEmail;

      const payload = {
        action: "recordActivity",
        studentNames: JSON.stringify(targetStudents),
        type: type,
        imageFile: imageBase64,
        date: date,
        time: time,
        username: wardenName
      };

      try {
        await callServer(payload);
        document.getElementById('savingToast').style.display = 'none';

        var syncToast = document.getElementById('syncToast');
        syncToast.innerHTML = '<i class="fas fa-check-circle text-success me-2"></i> Rekod disimpan.';
        syncToast.style.display = 'block'; setTimeout(() => { syncToast.style.display = 'none'; }, 4000);

        btn.disabled = false;
        akt_selectedStudents.clear();
        paparMenuUtama();
      } catch (err) {
        document.getElementById('savingToast').style.display = 'none';
        alert("Ralat menyimpan rekod: " + err.message);
        btn.disabled = false;
      }
    }

    // ==========================================
    // FUNGSI LAPORAN (REPORT RENDERING)
    // ==========================================
    function bukaPenjanaLaporan() {
      document.getElementById('mainMenuView').style.display = 'none';
      document.getElementById('attendanceView').style.display = 'none';
      document.getElementById('disciplineView').style.display = 'none';
      document.getElementById('reportView').style.display = 'none';
      document.getElementById('penjanaLaporanView').style.display = 'block';
      document.getElementById('aktivitiMenuView').style.display = 'none';
      document.getElementById('aktivitiFormView').style.display = 'none';
      document.getElementById('btnBackMenu').style.display = 'block';

      renderLaporanTindakan();
    }

    function renderLaporanDinamik() {
      const jenisLaporan = document.getElementById('laporanJenis').value;
      const titleText = document.getElementById('laporanJenisText').value;
      const monthFilter = document.getElementById('laporanTindakanMonth').value;
      const thead = document.getElementById('thead-laporanDinamik');
      const tbody = document.getElementById('tbody-laporanDinamik');

      document.getElementById('tajukPenjanaLaporan').innerText = titleText;

      let htmlHead = '';
      let htmlBody = '';
      let filteredLogs = [];

      if (jenisLaporan === 'Disiplin') {
        htmlHead = `<tr><th style="width: 50px">No</th><th>Tarikh</th><th>Nama Murid</th><th>Kelas / Dorm</th><th>Salah Laku</th><th>Tindakan / Hukuman</th><th>Warden</th></tr>`;
        filteredLogs = allMeritLogs.filter(log => log.type === 'Demerit');
      } else {
        htmlHead = `<tr><th style="width: 50px">No</th><th>Tarikh</th><th>Bilangan Murid</th><th>Jenis Aktiviti</th><th>Warden</th></tr>`;
        filteredLogs = allAktivitiLogs.filter(log => log.type.includes(jenisLaporan));
      }

      if (monthFilter !== "all") {
        filteredLogs = filteredLogs.filter(log => {
          let d = new Date(log.timestamp);
          return (d.getMonth() + 1).toString() === monthFilter;
        });
      }

      let sortedLogs = [...filteredLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      if (sortedLogs.length === 0) {
        htmlBody = `<tr><td colspan="7" class="text-center text-muted py-4">Tiada rekod dijumpai.</td></tr>`;
      } else {
        if (jenisLaporan === 'Disiplin') {
          sortedLogs.forEach((log, index) => {
            let student = allStudents.find(s => s.name === log.name);
            let classDorm = student ? `${student.classroom || '-'} / ${student.block || '-'}` : '-';
            let d = new Date(log.timestamp);
            let timeStr = d.toLocaleDateString('ms-MY') + " " + d.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });
            let wardenName = WARDEN_NAMES[log.warden] || log.warden || '-';

            htmlBody += `<tr><td>${index + 1}</td><td class="small text-muted">${timeStr}</td><td class="fw-bold">${log.name}</td><td>${classDorm}</td><td>${log.reason || '-'}</td><td class="text-danger fw-bold">${log.tindakan || '-'}</td><td class="small text-muted">${wardenName}</td></tr>`;
          });
        } else {
          // GROUP ACTIVITY LOGS BY SESSION
          let groupedLogs = {};
          sortedLogs.forEach(log => {
            let d = new Date(log.timestamp);
            let timeStr = d.toLocaleDateString('ms-MY') + " " + d.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });
            let wardenName = WARDEN_NAMES[log.warden] || log.warden || '-';
            let key = timeStr + "|" + log.type + "|" + wardenName;

            if (!groupedLogs[key]) {
              groupedLogs[key] = {
                timeStr: timeStr,
                dateObj: d,
                type: log.type,
                wardenName: wardenName,
                students: []
              };
            }
            groupedLogs[key].students.push(log.name);
          });

          let groupArray = Object.values(groupedLogs);
          groupArray.sort((a, b) => b.dateObj - a.dateObj);

          groupArray.forEach((group, index) => {
            let groupKey = encodeURIComponent(JSON.stringify(group));
            htmlBody += `<tr style="cursor: pointer;" onclick="showAktivitiDetails('${groupKey}')" class="table-hover-row">
              <td>${index + 1}</td>
              <td class="small text-muted">${group.timeStr}</td>
              <td class="fw-bold text-primary">${group.students.length} Orang</td>
              <td>${group.type}</td>
              <td class="small text-muted">${group.wardenName}</td>
            </tr>`;
          });
        }
      }
      thead.innerHTML = htmlHead;
      tbody.innerHTML = htmlBody;
    }

    function showAktivitiDetails(groupKeyEncoded) {
      const group = JSON.parse(decodeURIComponent(groupKeyEncoded));
      document.getElementById('akt_detail_title').innerText = `${group.type} (${group.timeStr}) - ${group.wardenName}`;

      const tbody = document.getElementById('akt_detail_tbody');
      let html = '';

      group.students.forEach((studentName, index) => {
        let student = allStudents.find(s => s.name === studentName);
        let classDorm = student ? `${student.classroom || '-'} / ${student.block || '-'}` : '-';
        html += `<tr>
          <td>${index + 1}</td>
          <td class="fw-bold">${studentName}</td>
          <td>${classDorm}</td>
        </tr>`;
      });

      tbody.innerHTML = html;
      aktivitiDetailsModal.show();
    }

    function setLaporanJenis(btnElement) {
      document.getElementById('laporanJenis').value = btnElement.getAttribute('data-val');
      document.getElementById('laporanJenisText').value = btnElement.getAttribute('data-text');
      
      const buttons = document.querySelectorAll('.btn-laporan-jenis');
      buttons.forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline-primary');
      });
      btnElement.classList.remove('btn-outline-primary');
      btnElement.classList.add('btn-primary');
      
      const jenis = btnElement.getAttribute('data-val');
      if (jenis === 'Laporan Harian') {
        document.getElementById('laporanTableContainer').style.display = 'none';
        document.getElementById('laporanHarianContainer').style.display = 'block';
        document.getElementById('laporanTindakanMonth').parentElement.style.display = 'none';
        document.getElementById('tajukPenjanaLaporan').innerText = "Laporan Harian";
        populateHarianDropdowns();
      } else {
        document.getElementById('laporanTableContainer').style.display = 'block';
        document.getElementById('laporanHarianContainer').style.display = 'none';
        document.getElementById('laporanTindakanMonth').parentElement.style.display = 'flex';
        renderLaporanDinamik();
      }
    }

    function populateHarianDropdowns() {
      if (!document.getElementById('harianTarikh').value) {
        document.getElementById('harianTarikh').valueAsDate = new Date();
      }
      
      let jumlahMasuk = 0;
      allStudents.forEach(s => {
        if (s.status === 'Masuk') jumlahMasuk++;
      });
      document.getElementById('harianKehadiranSekolah').value = jumlahMasuk;

      const containers = ['harianPpmPagi', 'harianPpmPetang', 'harianPpmOffice', 'harianWarden'];
      if (document.getElementById('harianPpmPagi').innerHTML.trim() === '') {
        let optionsHtml = '';
        for (const key in WARDEN_NAMES) {
          optionsHtml += `
            <div class="form-check">
              <input class="form-check-input border-secondary" type="checkbox" value="${WARDEN_NAMES[key]}" id="chk_${key}">
              <label class="form-check-label" for="chk_${key}">${WARDEN_NAMES[key]}</label>
            </div>
          `;
        }
        containers.forEach(id => {
          let modifiedHtml = optionsHtml.replace(/chk_/g, 'chk_' + id + '_');
          document.getElementById(id).innerHTML = modifiedHtml;
        });
      }
    }

    function getLaporanHarianData() {
      const days = ["AHAD", "ISNIN", "SELASA", "RABU", "KHAMIS", "JUMAAT", "SABTU"];
      const dateVal = document.getElementById('harianTarikh').value;
      let dateObj = dateVal ? new Date(dateVal) : new Date();
      const hari = days[dateObj.getDay()];
      const tarikh = dateObj.toLocaleDateString('ms-MY');

      const getSelectedList = (containerId) => {
        const container = document.getElementById(containerId);
        const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
        const selected = Array.from(checkboxes).map(chk => chk.value.split(' ').map(w=>w.toUpperCase()).join(' '));
        return selected.length > 0 ? selected : ["TIADA"];
      };

      let counts = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, 'PK': 0 };
      let jumlahMasuk = 0;
      allStudents.forEach(s => {
        if (s.status === 'Masuk') {
          jumlahMasuk++;
          let cls = (s.classroom || '').toUpperCase();
          if (cls.includes('1')) counts['1']++;
          else if (cls.includes('2')) counts['2']++;
          else if (cls.includes('3')) counts['3']++;
          else if (cls.includes('4')) counts['4']++;
          else if (cls.includes('5')) counts['5']++;
          else if (cls.includes('6')) counts['6']++;
          else if (cls.includes('PK') || cls.includes('PENDIDIKAN KHAS')) counts['PK']++;
        }
      });

      return {
        hari,
        tarikh,
        ppmPagi: getSelectedList('harianPpmPagi'),
        ppmPetang: getSelectedList('harianPpmPetang'),
        ppmOffice: getSelectedList('harianPpmOffice'),
        warden: getSelectedList('harianWarden'),
        catatan: document.getElementById('harianCatatan').value,
        counts,
        jumlahMasuk,
        kehadiranSekolah: document.getElementById('harianKehadiranSekolah').value || '0'
      };
    }

    function generateLaporanHarianText() {
      const data = getLaporanHarianData();
      
      const formatList = (list, bullet) => list.map(item => `  ${bullet}  ${item}`).join('\n');
      let catatanText = data.catatan ? `\nCATATAN / LAPORAN DISIPLIN:\n${data.catatan}\n` : '';

      return `LAPORAN KEHADIRAN MURID ASRAMA
HARI:${data.hari}
TARIKH: ${data.tarikh}

PPM BERTUGAS SHIFT
PAGI (5.30pg-2.30ptg)   
${formatList(data.ppmPagi, '-')}
  
PETANG(1.00tgh-10.00mlm) 
${formatList(data.ppmPetang, '-')}
     
OFFICE HOUR (7.30pg-4.30ptg)
${formatList(data.ppmOffice, '-')}
 
WARDEN BERTUGAS
${formatList(data.warden, '•')}
${catatanText}
Keberadaan Murid di Asrama :~
THN 1: ${data.counts['1']}
THN 2: ${data.counts['2']}
THN 3: ${data.counts['3']}
THN 4: ${data.counts['4']}
THN 5: ${data.counts['5']}
THN 6: ${data.counts['6']}
Pk: ${data.counts['PK']}

JUMLAH KESELURUHAN :${data.jumlahMasuk}
JUMLAH KEHADIRAN KE SEKOLAH     : ${data.kehadiranSekolah}`;
    }

    function salinLaporanHarian() {
      const text = generateLaporanHarianText();
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      alert("Laporan berjaya disalin!");
    }

    function cetakLaporanDinamik() {
      const { jsPDF } = window.jspdf;
      const jenisLaporan = document.getElementById('laporanJenis').value;

      if (jenisLaporan === 'Laporan Harian') {
        const doc = new jsPDF('portrait');
        const data = getLaporanHarianData();
        
        doc.setFillColor(13, 110, 253);
        doc.rect(0, 0, 210, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("LAPORAN HARIAN KEHADIRAN MURID", 105, 18, { align: "center" });
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
        doc.text(`Hari: ${data.hari}`, 14, 40);
        doc.text(`Tarikh: ${data.tarikh}`, 150, 40);
        
        doc.setDrawColor(200, 200, 200);
        doc.line(14, 45, 196, 45);

        doc.autoTable({
          startY: 50,
          head: [['Kategori Shift', 'Senarai Nama Bertugas']],
          body: [
            ['PPM Shift Pagi (5.30pg - 2.30ptg)', data.ppmPagi.join('\n')],
            ['PPM Shift Petang (1.00tgh - 10.00mlm)', data.ppmPetang.join('\n')],
            ['PPM Office Hour (7.30pg - 4.30ptg)', data.ppmOffice.join('\n')],
            ['Warden Bertugas', data.warden.join('\n')]
          ],
          theme: 'grid',
          headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255] },
          styles: { fontSize: 10, cellPadding: 4, valign: 'middle' },
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } }
        });

        let currentY = doc.lastAutoTable.finalY + 10;
        
        doc.autoTable({
          startY: currentY,
          head: [['Keberadaan Murid', 'Jumlah']],
          body: [
            ['Tahun 1', String(data.counts['1'])],
            ['Tahun 2', String(data.counts['2'])],
            ['Tahun 3', String(data.counts['3'])],
            ['Tahun 4', String(data.counts['4'])],
            ['Tahun 5', String(data.counts['5'])],
            ['Tahun 6', String(data.counts['6'])],
            ['Pendidikan Khas (PK)', String(data.counts['PK'])],
            [{ content: 'JUMLAH KESELURUHAN (MASUK)', styles: { fontStyle: 'bold' } }, { content: String(data.jumlahMasuk), styles: { fontStyle: 'bold' } }],
            [{ content: 'JUMLAH KEHADIRAN KE SEKOLAH', styles: { fontStyle: 'bold', textColor: [255,255,255], fillColor: [39, 174, 96] } }, { content: String(data.kehadiranSekolah), styles: { fontStyle: 'bold', textColor: [255,255,255], fillColor: [39, 174, 96] } }]
          ],
          theme: 'grid',
          headStyles: { fillColor: [142, 68, 173], textColor: [255, 255, 255] },
          styles: { fontSize: 10, cellPadding: 3 },
          columnStyles: { 0: { cellWidth: 100 } }
        });

        currentY = doc.lastAutoTable.finalY + 10;

        if (data.catatan) {
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.text("Catatan / Laporan Disiplin:", 14, currentY);
          currentY += 6;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          
          let splitCatatan = doc.splitTextToSize(data.catatan, 180);
          doc.text(splitCatatan, 14, currentY);
        }

        doc.save("Laporan_Harian_" + data.tarikh.replace(/\//g, '-') + ".pdf");
        return;
      }

      const doc = new jsPDF('landscape');
      const tajukLaporan = document.getElementById('laporanJenisText').value;

      doc.setFontSize(14);
      doc.text(tajukLaporan, 14, 20);

      const monthFilter = document.getElementById('laporanTindakanMonth');
      let monthText = monthFilter.options[monthFilter.selectedIndex].text;

      doc.setFontSize(10);
      doc.text("Bulan : " + monthText, 14, 28);
      doc.text("Tarikh Cetakan : " + new Date().toLocaleDateString('ms-MY'), 14, 34);

      let filteredLogs = [];
      if (jenisLaporan === 'Disiplin') {
        filteredLogs = allMeritLogs.filter(log => log.type === 'Demerit');
      } else {
        filteredLogs = allAktivitiLogs.filter(log => log.type.includes(jenisLaporan));
      }

      if (monthFilter.value !== "all") {
        filteredLogs = filteredLogs.filter(log => {
          let d = new Date(log.timestamp);
          return (d.getMonth() + 1).toString() === monthFilter.value;
        });
      }

      let sortedLogs = [...filteredLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      let tableData = [];
      if (jenisLaporan === 'Disiplin') {
        tableData = sortedLogs.map((log, index) => {
          let student = allStudents.find(s => s.name === log.name);
          let classDorm = student ? `${student.classroom || '-'} / ${student.block || '-'}` : '-';
          let d = new Date(log.timestamp);
          let timeStr = d.toLocaleDateString('ms-MY') + " " + d.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });
          let wardenName = WARDEN_NAMES[log.warden] || log.warden || '-';

          return [index + 1, timeStr, log.name, classDorm, log.reason || '-', log.tindakan || '-', wardenName];
        });
      } else {
        let groupedLogs = {};
        sortedLogs.forEach(log => {
          let d = new Date(log.timestamp);
          let timeStr = d.toLocaleDateString('ms-MY') + " " + d.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });
          let wardenName = WARDEN_NAMES[log.warden] || log.warden || '-';
          let key = timeStr + "|" + log.type + "|" + wardenName;

          if (!groupedLogs[key]) {
            groupedLogs[key] = {
              timeStr: timeStr,
              dateObj: d,
              type: log.type,
              wardenName: wardenName,
              students: []
            };
          }
          groupedLogs[key].students.push(log.name);
        });

        let groupArray = Object.values(groupedLogs);
        groupArray.sort((a, b) => b.dateObj - a.dateObj);

        tableData = groupArray.map((group, index) => {
          return [index + 1, group.timeStr, group.students.length + " Orang", group.type, group.wardenName];
        });
      }

      let headHeaders = [];
      let columnStyles = {};

      if (jenisLaporan === 'Disiplin') {
        headHeaders = ['No', 'Tarikh & Masa', 'Nama Murid', 'Kelas / Dorm', 'Salah Laku', 'Tindakan / Hukuman', 'Warden'];
        columnStyles = {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 35 },
          2: { cellWidth: 45 },
          3: { cellWidth: 25 },
          4: { cellWidth: 'auto' },
          5: { cellWidth: 40, fontStyle: 'bold', textColor: [220, 53, 69] },
          6: { cellWidth: 25 }
        };
      } else {
        headHeaders = ['No', 'Tarikh & Masa', 'Bilangan Murid', 'Jenis Aktiviti', 'Warden'];
        columnStyles = {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 40 },
          2: { cellWidth: 35 },
          3: { cellWidth: 'auto' },
          4: { cellWidth: 40 }
        };
      }

      doc.autoTable({
        startY: 40,
        head: [headHeaders],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 9,
          textColor: [0, 0, 0],
          lineColor: [180, 180, 180],
          lineWidth: 0.1,
          cellPadding: 3,
          valign: 'middle'
        },
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontStyle: 'bold'
        },
        columnStyles: columnStyles
      });

      let pdfName = tajukLaporan.replace(/[^a-zA-Z0-9]/g, '_') + ".pdf";
      doc.save(pdfName);
    }

    function renderReportIndividu() {
      const tbody = document.getElementById('tbody-individu');
      const searchTerm = document.getElementById('searchIndividu') ? document.getElementById('searchIndividu').value.toLowerCase() : "";
      const monthFilter = document.getElementById('filterMonth') ? document.getElementById('filterMonth').value : "all";
      const yearFilter = document.getElementById('filterYear') ? document.getElementById('filterYear').value : "all";
      const genderFilter = document.getElementById('filterGender') ? document.getElementById('filterGender').value : "all";

      let filtered = allStudents.map(s => {
        let studentCopy = { ...s };
        if (monthFilter === "all") {
          studentCopy.displayPoints = s.meritPoints || 0;
        } else {
          let monthPoints = 0;
          let studentLogs = allMeritLogs.filter(log => {
            if (log.name !== s.name) return false;
            let d = new Date(log.timestamp);
            return (d.getMonth() + 1).toString() === monthFilter;
          });
          studentLogs.forEach(l => { monthPoints += (parseInt(l.points) || 0); });
          studentCopy.displayPoints = monthPoints;
        }
        return studentCopy;
      });

      if (searchTerm) {
        filtered = filtered.filter(s => s.name.toLowerCase().includes(searchTerm));
      }
      if (yearFilter !== "all") {
        filtered = filtered.filter(s => s.classroom && s.classroom.match(new RegExp('\\b' + yearFilter + '\\b')));
      }
      if (genderFilter !== "all") {
        filtered = filtered.filter(s => s.gender && s.gender.toLowerCase() === genderFilter.toLowerCase());
      }

      let sorted = [...filtered].sort((a, b) => b.displayPoints - a.displayPoints);

      let html = '';
      if (sorted.length === 0) {
        html = '<tr><td colspan="4" class="text-center text-muted py-4">Tiada rekod dijumpai.</td></tr>';
      } else {
        sorted.forEach((s, index) => {
          let pts = s.displayPoints || 0;
          let badge = pts >= 0 ? `<span class="badge bg-success">${pts}</span>` : `<span class="badge bg-danger">${pts}</span>`;
          html += `
            <tr>
              <td>${index + 1}</td>
              <td class="fw-bold">
                <a href="javascript:void(0)" onclick="viewStudentHistory('${s.name}')" class="text-decoration-none text-dark d-block">
                  ${s.name} <i class="fas fa-external-link-alt ms-1 small text-muted"></i>
                </a>
              </td>
              <td class="text-muted small">${s.block}</td>
              <td class="text-end">${badge}</td>
            </tr>
          `;
        });
      }
      tbody.innerHTML = html;
    }

    function renderReportDorm() {
      const tbody = document.getElementById('tbody-dorm');
      const monthFilter = document.getElementById('filterMonth') ? document.getElementById('filterMonth').value : "all";
      const yearFilter = document.getElementById('filterYear') ? document.getElementById('filterYear').value : "all";
      const genderFilter = document.getElementById('filterGender') ? document.getElementById('filterGender').value : "all";

      let dormTotals = {};
      let filteredStudents = allStudents;
      if (yearFilter !== "all") filteredStudents = filteredStudents.filter(s => s.classroom && s.classroom.match(new RegExp('\\b' + yearFilter + '\\b')));
      if (genderFilter !== "all") filteredStudents = filteredStudents.filter(s => s.gender && s.gender.toLowerCase() === genderFilter.toLowerCase());

      filteredStudents.forEach(s => {
        if (!dormTotals[s.block]) dormTotals[s.block] = 0;

        let pts = 0;
        if (monthFilter === "all") {
          pts = s.meritPoints || 0;
        } else {
          let studentLogs = allMeritLogs.filter(log => {
            if (log.name !== s.name) return false;
            let d = new Date(log.timestamp);
            return (d.getMonth() + 1).toString() === monthFilter;
          });
          studentLogs.forEach(l => { pts += (parseInt(l.points) || 0); });
        }
        dormTotals[s.block] += pts;
      });

      let sortedDorms = Object.keys(dormTotals).map(dorm => {
        return { dorm: dorm, total: dormTotals[dorm] };
      }).sort((a, b) => b.total - a.total);

      let html = '';
      sortedDorms.forEach((d, index) => {
        let badge = d.total >= 0 ? `<span class="badge bg-success fs-6">${d.total}</span>` : `<span class="badge bg-danger fs-6">${d.total}</span>`;
        html += `
          <tr>
            <td>${index + 1}</td>
            <td class="fw-bold fs-5">${d.dorm}</td>
            <td class="text-end">${badge}</td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    }

    let currentHistoryStudent = "";
    function viewStudentHistory(studentName) {
      currentHistoryStudent = studentName;
      document.getElementById('studentHistoryModalTitle').innerText = "Rekod: " + studentName;
      const container = document.getElementById('studentHistoryContainer');
      const monthFilter = document.getElementById('filterMonth') ? document.getElementById('filterMonth').value : "all";

      let studentLogs = allMeritLogs.filter(log => {
        if (log.name !== studentName) return false;
        if (monthFilter !== "all") {
          let d = new Date(log.timestamp);
          if ((d.getMonth() + 1).toString() !== monthFilter) return false;
        }
        return true;
      });

      const btnPrint = document.getElementById('btnPrintSalahLaku');
      if (btnPrint) {
        let hasSalahLaku = studentLogs.some(log => log.type === 'Demerit');
        btnPrint.style.display = hasSalahLaku ? 'block' : 'none';
      }

      if (!studentLogs || studentLogs.length === 0) {
        container.innerHTML = '<div class="text-center text-muted p-4"><i class="fas fa-folder-open fa-3x mb-2"></i><br>Tiada rekod disiplin setakat ini.</div>';
      } else {
        let sortedLogs = [...studentLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        let html = '<div class="list-group list-group-flush">';

        sortedLogs.forEach(log => {
          let d = new Date(log.timestamp);
          let timeStr = d.toLocaleDateString('ms-MY') + " " + d.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });
          let typeIcon = log.type === 'Merit' ? '<i class="fas fa-star text-success"></i>' : '<i class="fas fa-exclamation-triangle text-danger"></i>';
          let pointBadge = log.points >= 0 ? `<span class="badge bg-success">+${log.points}</span>` : `<span class="badge bg-danger">${log.points}</span>`;
          let imageLink = (log.imageUrl && log.imageUrl.trim() !== "")
            ? `<a href="${log.imageUrl}" target="_blank" class="badge bg-secondary text-decoration-none mt-2"><i class="fas fa-camera"></i> Gambar</a>` : '';

          let wardenName = WARDEN_NAMES[log.warden] || log.warden || '-';

          html += `
            <div class="list-group-item py-3">
              <div class="d-flex w-100 justify-content-between align-items-center mb-1">
                <h6 class="mb-0 fw-bold">${typeIcon} ${log.type}</h6>
                ${pointBadge}
              </div>
              <p class="mb-1 text-dark small">${log.reason}</p>
              <small class="text-muted"><i class="far fa-clock"></i> ${timeStr} | Oleh: ${wardenName}</small>
              <div>${imageLink}</div>
            </div>
          `;
        });
        html += '</div>';
        container.innerHTML = html;
      }

      let myModal = new bootstrap.Modal(document.getElementById('studentHistoryModal'));
      myModal.show();
    }

    function renderReportSejarah() {
      const container = document.getElementById('historyLogContainer');
      const monthFilter = document.getElementById('filterMonth') ? document.getElementById('filterMonth').value : "all";
      const yearFilter = document.getElementById('filterYear') ? document.getElementById('filterYear').value : "all";
      const genderFilter = document.getElementById('filterGender') ? document.getElementById('filterGender').value : "all";

      let filteredLogs = allMeritLogs || [];
      if (monthFilter !== "all") {
        filteredLogs = filteredLogs.filter(log => {
          let d = new Date(log.timestamp);
          return (d.getMonth() + 1).toString() === monthFilter;
        });
      }

      if (yearFilter !== "all" || genderFilter !== "all") {
        filteredLogs = filteredLogs.filter(log => {
          let student = allStudents.find(s => s.name === log.name);
          if (!student) return false;
          if (yearFilter !== "all" && !(student.classroom && student.classroom.match(new RegExp('\\b' + yearFilter + '\\b')))) return false;
          if (genderFilter !== "all" && !(student.gender && student.gender.toLowerCase() === genderFilter.toLowerCase())) return false;
          return true;
        });
      }

      if (!filteredLogs || filteredLogs.length === 0) {
        container.innerHTML = '<div class="text-center text-muted p-4"><i class="fas fa-folder-open fa-3x mb-2"></i><br>Tiada rekod setakat ini.</div>';
        return;
      }

      let sortedLogs = [...filteredLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      let html = '<div class="list-group">';
      sortedLogs.forEach(log => {
        let d = new Date(log.timestamp);
        let timeStr = d.toLocaleDateString('ms-MY') + " " + d.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });

        let typeIcon = log.type === 'Merit' ? '<i class="fas fa-star text-success"></i>' : '<i class="fas fa-exclamation-triangle text-danger"></i>';
        let pointBadge = log.points >= 0 ? `<span class="badge bg-success">+${log.points}</span>` : `<span class="badge bg-danger">${log.points}</span>`;

        let imageLink = (log.imageUrl && log.imageUrl.trim() !== "")
          ? `<a href="${log.imageUrl}" target="_blank" class="badge bg-secondary text-decoration-none mt-2"><i class="fas fa-camera"></i> Gambar</a>` : '';

        let wardenName = WARDEN_NAMES[log.warden] || log.warden || '-';

        html += `
          <div class="list-group-item list-group-item-action py-3">
            <div class="d-flex w-100 justify-content-between align-items-center mb-1">
              <h6 class="mb-0 fw-bold">${typeIcon} ${log.name}</h6>
              ${pointBadge}
            </div>
            <p class="mb-1 text-dark small">${log.reason}</p>
            <small class="text-muted"><i class="far fa-clock"></i> ${timeStr} | Oleh: ${wardenName}</small>
            <div>${imageLink}</div>
          </div>
        `;
      });
      html += '</div>';
      container.innerHTML = html;
    }
  
