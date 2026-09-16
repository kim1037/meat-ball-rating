/**
 * 彰化肉圓馬拉松｜Google Apps Script Web App
 *
 * 使用方式：
 * 1. 將 SHEET_ID 換成 Google 試算表網址中的 ID。
 * 2. 在 Apps Script 編輯器執行一次 setupSheet() 並授權。
 * 3. 部署為 Web App：執行身分「我」、存取權「任何人」。
 * 4. 將部署後的 /exec 網址貼到 index.html 的 GAS_URL。
 */

const SHEET_ID = "YOUR_GOOGLE_SHEET_ID";
const SHEET_NAME = "Ratings";
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
  sheet.autoResizeColumns(1, HEADERS.length);
}

/** 健康檢查：以瀏覽器開啟 /exec 網址時會看到此回應。 */
function doGet() {
  return jsonResponse_({
    ok: true,
    service: "彰化肉圓馬拉松評分 API",
    sheet: SHEET_NAME,
    time: new Date().toISOString(),
  });
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
