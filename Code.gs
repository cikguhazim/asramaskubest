// ==========================================
// TETAPAN UTAMA
// ==========================================
const FOLDER_ID = "1c_jDBczFXa-1NTBwUN97nRd_dndgXOjC"; // Gambar Bukti Asrama

// ==========================================
// FUNGSI WEB APP (DO GET & DO POST)
// ==========================================
function doGet(e) {
  return ContentService.createTextOutput("Sistem e-Asrama kini beroperasi sebagai API File Saver. Pangkalan data telah dipindahkan ke Firebase.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var result;

    if (action === "savePDFToDrive") {
      result = savePDFToDrive(payload);
    } else if (action === "saveImageToDrive") {
      var url = saveImageToDrive(payload.base64Data, payload.fileName);
      result = { status: "berjaya", data: url };
    } else {
      result = { status: "error", message: "Tindakan (action) tidak dikenali: " + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================
// 1. FUNGSI SIMPAN GAMBAR KE GOOGLE DRIVE
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

// ==========================================
// 2. FUNGSI SIMPAN PDF KE GOOGLE DRIVE
// ==========================================
function savePDFToDrive(payload) {
  try {
    var base64Data = payload.base64;
    var filename = payload.filename;
    var reportType = payload.reportType; 
    
    // Mapping of report type to Google Drive Folder ID
    var folderMap = {
      "Laporan Harian": "1gBfeS1bsuoqnG5sewU4DbbJEYKyxdYnr",
      "Solat Berjemaah": "1PFVVQDjSP9fXfXaqpOGTeyf6NTGo8riJ",
      "Pelaksanaan Prep": "1Sq4WLOmOQeQ24xb0PK7DCw9SMImPYtvV",
      "Bilik Khas: Makmal Komputer": "1obQMQ5N_l92mLCZQtMPujeCSz1KUlEeE",
      "Bilik Khas: Bilik Muzik": "1ZZFixhe0ftgBNjURapLDKaBjFGEud54c",
      "Disiplin": "1-F7EoVu38GDG1WRc26pPIJqzXsVebQqu"
    };

    var folder;
    var folderId = folderMap[reportType];
    
    if (folderId) {
      folder = DriveApp.getFolderById(folderId);
    } else {
      folder = DriveApp.getRootFolder();
    }
    
    // Clean base64 string if it contains data uri prefix
    if (base64Data.indexOf(',') !== -1) {
      base64Data = base64Data.split(',')[1];
    }
    
    var decoded = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decoded, 'application/pdf', filename);
    
    var file = folder.createFile(blob);
    return { status: "success", url: file.getUrl() };
  } catch(err) {
    return { status: "error", message: err.toString() };
  }
}