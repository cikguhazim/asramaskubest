// ==========================================
// TETAPAN UTAMA (SILA TUKAR ID DI BAWAH)
// ==========================================
const FOLDER_ID = "1c_jDBczFXa-1NTBwUN97nRd_dndgXOjC"; 
const SHEET_ID = "1oY-LbRwZ0z74lpSQm5rKHgEXw3Hn0nbwawbeVY9je0o"; 

const TAB_STUDENTS = "Students"; 
const TAB_LOGS = "Logs";         
const TAB_PENDING = "Pending";   

// ==========================================
// FUNGSI WEB APP (DO GET & DO POST)
// ==========================================
function doGet(e) {
  return ContentService.createTextOutput("Sistem e-Asrama kini beroperasi sebagai API. Sila gunakan pautan antaramuka di GitHub Pages untuk log masuk.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var result;

    if (action === "sahkanLogMasuk") {
      result = sahkanLogMasuk(payload.username, payload.password);
    } else if (action === "getAppInitData") {
      result = getAppInitData(payload.username);
    } else if (action === "processEntry") {
      result = processEntry(payload, payload.username);
    } else if (action === "resolvePending") {
      result = resolvePending(payload.id, payload.isApproved, payload.username);
    } else if (action === "addStudent") {
      result = addStudent(payload);
    } else if (action === "removeStudent") {
      result = removeStudent(payload);
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================
// 1. FUNGSI LOG MASUK
// ==========================================
var PENGGUNA = {
  "warden1": { peranan: "warden", kataLaluan: "1234" },
  "warden2": { peranan: "warden", kataLaluan: "1234" },
  "pengawal": { peranan: "guard", kataLaluan: "0000" }
};

function sahkanLogMasuk(username, password) {
  var userKecil = String(username).toLowerCase().trim();
  if (PENGGUNA[userKecil]) {
    if (PENGGUNA[userKecil].kataLaluan === password) {
      return { status: "berjaya", peranan: PENGGUNA[userKecil].peranan, username: userKecil };
    } else { return { status: "gagal", mesej: "Kata laluan salah!" }; }
  }
  return { status: "gagal", mesej: "ID Pengguna tidak wujud." };
}

// ==========================================
// 2. FUNGSI AMBIL DATA AWAL (LOAD DATA)
// ==========================================
function getAppInitData(username) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var role = PENGGUNA[username] ? PENGGUNA[username].peranan : "guard";

  var studentSheet = ss.getSheetByName(TAB_STUDENTS);
  var sData = studentSheet.getDataRange().getValues();
  var students = [];
  
  for(var i = 1; i < sData.length; i++) {
    if(!sData[i][0]) continue; 
    students.push({
      name: sData[i][0],      
      block: sData[i][1],     
      classroom: sData[i][2], 
      status: sData[i][3] || "Masuk", 
      timestamp: sData[i][4] || "",   
      reason: sData[i][5] || "-",     
      imageUrl: sData[i][6] || ""     
    });
  }

  var pendingSheet = ss.getSheetByName(TAB_PENDING);
  var pending = [];
  if (pendingSheet) {
    var pData = pendingSheet.getDataRange().getValues();
    for(var i = 1; i < pData.length; i++) {
      if(!pData[i][0]) continue;
      pending.push({
        id: pData[i][0],
        timestamp: pData[i][1],
        name: pData[i][2],
        action: pData[i][3],
        reason: pData[i][4],
        imageUrl: pData[i][5],
        guardEmail: pData[i][6]
      });
    }
  }

  return { status: "berjaya", data: { role: role, pending: pending, students: students } };
}

// ==========================================
// 3. FUNGSI KEMASKINI STATUS & GAMBAR
// ==========================================
function processEntry(payload, username) {
  var data = payload.data;
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var isGuard = (PENGGUNA[username] && PENGGUNA[username].peranan === "guard");
  
  var imgUrl = "";
  if (data.imageFile && data.imageFile.trim() !== "") {
     var randomText = Math.floor(Math.random() * 10000);
     imgUrl = saveImageToDrive(data.imageFile, "Bukti_" + randomText + ".jpg");
  }

  var names = JSON.parse(data.studentNames);
  var timestamp = data.customDate + "T" + data.customTime; 
  var reasonText = (data.actionType === 'Masuk') ? "-" : data.reason;

  if (isGuard) {
    var sheetPending = ss.getSheetByName(TAB_PENDING);
    if(sheetPending.getLastRow() === 0) {
       sheetPending.appendRow(["ID", "Timestamp", "Nama", "Action", "Reason", "Image", "GuardEmail"]);
    }
    names.forEach(function(studentName) {
      var uniqueID = new Date().getTime() + "_" + Math.floor(Math.random() * 1000);
      sheetPending.appendRow([uniqueID, timestamp, studentName, data.actionType, reasonText, imgUrl, username]);
    });
    return { status: "berjaya", data: "Data dihantar. Menunggu pengesahan Warden." };
  }

  var sheet = ss.getSheetByName(TAB_STUDENTS);
  var sheetLogs = ss.getSheetByName(TAB_LOGS);
  var dataRow = sheet.getDataRange().getValues();
  var newLogRows = [];

  for (var i = 1; i < dataRow.length; i++) {
    var currentName = dataRow[i][0];
    
    if (names.includes(currentName)) {
      sheet.getRange(i + 1, 4).setValue(data.actionType); 
      sheet.getRange(i + 1, 5).setValue(timestamp);       
      sheet.getRange(i + 1, 6).setValue(reasonText);      
      
      if (imgUrl !== "") {
         sheet.getRange(i + 1, 7).setValue(imgUrl); 
      } else if (data.actionType === 'Masuk') {
         sheet.getRange(i + 1, 7).setValue(""); 
      }

      var finalImageLog = (imgUrl !== "") ? imgUrl : (data.actionType === 'Masuk' ? "" : (dataRow[i][6] || ""));
      var logDate = new Date(data.customDate + "T" + data.customTime);
      newLogRows.push([logDate, currentName, data.actionType, reasonText, finalImageLog]);
    }
  }

  if (newLogRows.length > 0 && sheetLogs) {
    if(sheetLogs.getLastRow() === 0) sheetLogs.appendRow(["Timestamp", "Nama Murid", "Status", "Sebab", "Gambar"]);
    sheetLogs.getRange(sheetLogs.getLastRow() + 1, 1, newLogRows.length, 5).setValues(newLogRows);
  }
  
  return { status: "berjaya", data: "Berjaya dikemaskini!" };
}

function resolvePending(id, isApproved, username) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var pendingSheet = ss.getSheetByName(TAB_PENDING);
  if (!pendingSheet) return { status: "gagal", data: "Tiada sheet Pending." };
  
  var pData = pendingSheet.getDataRange().getValues();
  for (var i = 1; i < pData.length; i++) {
    if (pData[i][0] == id) {
      if (isApproved) {
        var sheet = ss.getSheetByName(TAB_STUDENTS);
        var sData = sheet.getDataRange().getValues();
        for (var j = 1; j < sData.length; j++) {
          if(sData[j][0] == pData[i][2]) {
             sheet.getRange(j + 1, 4).setValue(pData[i][3]);
             sheet.getRange(j + 1, 5).setValue(pData[i][1]);
             sheet.getRange(j + 1, 6).setValue(pData[i][4]);
             if(pData[i][5]) sheet.getRange(j + 1, 7).setValue(pData[i][5]); 
             
             var sheetLogs = ss.getSheetByName(TAB_LOGS);
             if(sheetLogs) sheetLogs.appendRow([new Date(pData[i][1]), pData[i][2], pData[i][3], pData[i][4], pData[i][5]]);
             break;
          }
        }
      }
      pendingSheet.deleteRow(i + 1);
      return { status: "berjaya", data: isApproved ? "Permohonan Diluluskan" : "Permohonan Ditolak" };
    }
  }
  return { status: "gagal", data: "Rekod tidak dijumpai." };
}

// ==========================================
// 4. FUNGSI URUS PELAJAR (TAMBAH / BUANG)
// ==========================================
function addStudent(payload) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(TAB_STUDENTS);
  
  if (!sheet) {
    return { status: "error", message: "Sheet Students tidak dijumpai" };
  }
  
  var newRow = [
    payload.name, 
    payload.block, 
    payload.classroom, 
    "Masuk", 
    "", 
    "-", 
    ""
  ];
  sheet.appendRow(newRow);
  
  return { status: "berjaya", data: "Pelajar berjaya ditambah" };
}

function removeStudent(payload) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(TAB_STUDENTS);
  
  if (!sheet) {
    return { status: "error", message: "Sheet Students tidak dijumpai" };
  }
  
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();
  var deleted = false;
  
  for (var i = values.length - 1; i >= 1; i--) { 
    if (values[i][0] === payload.name) { 
      sheet.deleteRow(i + 1); 
      deleted = true;
      break; 
    }
  }
  
  if (deleted) {
    return { status: "berjaya", data: "Pelajar berjaya dipadam" };
  } else {
    return { status: "error", message: "Pelajar tidak dijumpai" };
  }
}

// ==========================================
// 5. FUNGSI SIMPAN GAMBAR KE GOOGLE DRIVE
// ==========================================
function saveImageToDrive(base64Data, fileName) {
  if (!base64Data) return ""; 

  try {
    var split = base64Data.split('base64,');
    if (split.length < 2) throw new Error("Format gambar tak sah.");
    
    var contentType = split[0].replace('data:', '').replace(';', '');
    var decoded = Utilities.base64Decode(split[1]);
    var blob = Utilities.newBlob(decoded, contentType, fileName);
    
    var folder = DriveApp.getFolderById(FOLDER_ID);
    var file = folder.createFile(blob);
    
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch(errShare) {
      // Abaikan ralat ini jika KPM sekat
    }
    
    // Pulangkan pautan yang serasi dengan web (uc?export=view)
    return "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w800";
    
  } catch (e) { 
    throw new Error("Gagal simpan ke Drive: " + e.message); 
  }
}