/**
 * 彰化肉圓馬拉松｜Google Apps Script Web App
 *
 * 使用方式：
 * 1. 將 SHEET_ID 換成 Google 試算表網址中的 ID。
 * 2. 在 Apps Script 編輯器執行一次 setupSheet() 並授權。
 * 3. 部署為 Web App：執行身分「我」、存取權「任何人」。
 * 4. 將部署後的 /exec 網址貼到 index.html 的 GAS_URL。
 */

const SHEET_ID = "1zpUqyiIzH5-CDJqk_0J4zIO36AFfn-NvUPC9YF7iCCo";
const SHEET_NAME = "Ratings";
const SHEET_TIMEZONE = "Asia/Taipei";
const HEADERS = [
  "timestamp",
  "shopId",
  "shopName",
  "reviewer",
  "skin",
  "filling",
  "sauce",
  "soup",
  "cpValue",
  "environment",
  "comment",
];

/** 建立工作表與標題列；首次部署前請在編輯器手動執行一次。 */
function setupSheet() {
  const sheet = getOrCreateSheet_();
  ensureHeaders_(sheet);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setBackground("#1d5a6c")
    .setFontColor("#ffffff")
    .setFontWeight("bold");

  // 發布的 CSV 會套用儲存格顯示格式。中文地區預設會輸出「2026/9/16 下午 2:30:00」，
  // 前端的 new Date() 無法解析，因此固定成 ISO 8601 樣式；儲存格本身仍是日期型別，排序照常。
  sheet.getRange(2, 1, sheet.getMaxRows() - 1, 1)
    .setNumberFormat('yyyy-mm-dd"T"hh:mm:ss');

  sheet.autoResizeColumns(1, HEADERS.length);
}

/**
 * 回傳全部評分。前端改以此取代發布的 CSV：
 * 發布 CSV 由多個快取節點提供，實測同一時間的請求會隨機拿到新舊兩種版本，
 * 使用者送出評分後重新整理有機率看到資料消失。此處直接讀試算表，沒有快取問題。
 */
function doGet() {
  try {
    const sheet = getOrCreateSheet_();
    const lastRow = sheet.getLastRow();
    const rows = lastRow < 2
      ? []
      : sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues().map(rowToObject_);

    return jsonResponse_({
      ok: true,
      service: "彰化肉圓馬拉松評分 API",
      sheet: SHEET_NAME,
      time: new Date().toISOString(),
      count: rows.length,
      ratings: rows,
    });
  } catch (error) {
    console.error(error);
    return jsonResponse_({ ok: false, message: error.message || "讀取失敗" });
  }
}

function rowToObject_(row) {
  const result = {};
  HEADERS.forEach((key, index) => {
    const value = row[index];
    // 時間欄是日期型別，統一轉成 ISO 字串讓前端的 new Date() 能解析。
    result[key] = value instanceof Date ? value.toISOString() : value;
  });
  return result;
}

/** 接收前端以 text/plain 傳來的 JSON，驗證後寫入試算表。 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("找不到 POST 內容");
    }

    const data = JSON.parse(e.postData.contents);
    validatePayload_(data);

    // 多人同時送出時，避免寫入列互相覆蓋。
    lock.waitLock(10000);
    const sheet = getOrCreateSheet_();
    ensureHeaders_(sheet);
    const timestamp = new Date();

    sheet.appendRow([
      timestamp,
      cleanCell_(data.shopId, 60),
      cleanCell_(data.shopName, 80),
      cleanCell_(data.reviewer, 40),
      scoreOrBlank_(data.skin),
      scoreOrBlank_(data.filling),
      scoreOrBlank_(data.sauce),
      scoreOrBlank_(data.soup),
      scoreOrBlank_(data.cpValue),
      scoreOrBlank_(data.environment),
      cleanCell_(data.comment || "", 120),
    ]);

    SpreadsheetApp.flush();
    return jsonResponse_({
      ok: true,
      timestamp: timestamp.toISOString(),
      message: "評分已新增",
    });
  } catch (error) {
    console.error(error);
    return jsonResponse_({ ok: false, message: error.message || "寫入失敗" });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function getOrCreateSheet_() {
  if (!SHEET_ID || SHEET_ID === "YOUR_GOOGLE_SHEET_ID") {
    throw new Error("請先設定 google-script.js 的 SHEET_ID");
  }
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  // 時區若與活動所在地不符，匯出的時間會整批位移。
  if (spreadsheet.getSpreadsheetTimeZone() !== SHEET_TIMEZONE) {
    spreadsheet.setSpreadsheetTimeZone(SHEET_TIMEZONE);
  }
  return spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
}

function ensureHeaders_(sheet) {
  const current = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
  const isEmpty = current.every((value) => !value);
  if (isEmpty) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    return;
  }
  if (current.join("|") !== HEADERS.join("|")) {
    throw new Error(`「${SHEET_NAME}」工作表標題列不符，請依 README 檢查欄位與順序`);
  }
}

function validatePayload_(data) {
  if (!data || typeof data !== "object") throw new Error("資料格式錯誤");
  if (!String(data.shopId || "").trim()) throw new Error("缺少店家 ID");
  if (!String(data.shopName || "").trim()) throw new Error("缺少店家名稱");
  if (!String(data.reviewer || "").trim()) throw new Error("請選擇評分人員");
  if (String(data.comment || "").length > 120) throw new Error("評語不可超過 120 字");

  const dimensions = ["skin", "filling", "sauce", "soup", "cpValue", "environment"];
  dimensions.forEach((key) => {
    if (data[key] !== null && data[key] !== "" && !isValidScore_(data[key])) {
      throw new Error(`${key} 分數必須是 1 到 5，或使用 N/A`);
    }
  });
}

function isValidScore_(value) {
  const score = Number(value);
  return Number.isInteger(score) && score >= 1 && score <= 5;
}

function scoreOrBlank_(value) {
  return value === null || value === "" ? "" : Number(value);
}

/** 防止使用者輸入被試算表當成公式執行。 */
function cleanCell_(value, maxLength) {
  let text = String(value == null ? "" : value).trim().slice(0, maxLength);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return text;
}

function jsonResponse_(payload) {
  // Apps Script ContentService 會由 Google 的 Web App 端點處理跨來源回應。
  // 前端使用 text/plain「簡單請求」，因此不會觸發無法處理的 OPTIONS 預檢。
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
