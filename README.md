# 彰化肉圓馬拉松

純前端單頁網站，可直接部署到 GitHub Pages。評分資料由 Google 試算表提供 CSV 讀取，並透過 Google Apps Script Web App 寫入。

## 專案檔案

- `index.html`：完整 SPA、台味復古視覺、評分表單、CSV 讀取與 Chart.js 雷達圖。
- `google-script.js`：貼入 Google Apps Script 的後端程式。
- `README.md`：設定及部署說明。

## 1. 建立 Google 試算表

1. 建立一份空白 Google 試算表，例如命名為「彰化肉圓馬拉松評分」。
2. 從網址複製試算表 ID。網址格式是：

   ```text
   https://docs.google.com/spreadsheets/d/這一段就是試算表ID/edit
   ```

3. 不必手動建立欄位；下一步執行 `setupSheet()` 會自動建立名為 `Ratings` 的工作表及下列標題列：

   ```text
   timestamp | shopId | shopName | reviewer | skin | filling | sauce | soup | cpValue | environment | comment
   ```

如果選擇手動建立，欄位名稱、大小寫及順序必須完全相同。N/A 會存成空白儲存格，前端計算平均時會自動忽略。

## 2. 設定並發布 Google Apps Script

1. 在試算表選擇「擴充功能 → Apps Script」。
2. 將預設 `Code.gs` 內容清空，貼上 [`google-script.js`](./google-script.js) 的完整內容。
3. 把程式頂端的：

   ```js
   const SHEET_ID = "YOUR_GOOGLE_SHEET_ID";
   ```

   改成第 1 步取得的試算表 ID。
4. 在函式選單選取 `setupSheet`，按「執行」，依畫面完成 Google 授權。執行後會自動建立欄位及格式。
5. 右上角選擇「部署 → 新增部署作業 → 網頁應用程式」，設定：

   - 執行身分：**我**
   - 誰可以存取：**任何人**

6. 完成部署，複製以 `/exec` 結尾的 Web App 網址。
7. 直接在瀏覽器開啟該網址；若看到 `"ok":true`，代表 Web App 可用。

每次修改 Apps Script 後，都要到「管理部署作業」編輯現有部署並建立新版本，否則線上網址仍會執行舊程式。

### CORS 說明

Apps Script 的 `ContentService` 不提供自行加入 `Access-Control-Allow-Origin` 標頭的 API。這份前端以 `Content-Type: text/plain` 傳送 JSON，屬於瀏覽器的 CORS「簡單請求」，不會送出 GAS 無法處理的 `OPTIONS` 預檢；Web App 必須發布為「任何人」才能讓 GitHub Pages 寫入。請勿把 Content-Type 改為 `application/json`，否則會觸發預檢而失敗。

## 3. 發布試算表 CSV

1. 回到 Google 試算表，選擇「檔案 → 共用 → 發布到網路」。
2. 選擇單一工作表 `Ratings`，格式選「逗號分隔值 (.csv)」。
3. 按「發布」並複製網址，格式通常類似：

   ```text
   https://docs.google.com/spreadsheets/d/e/......../pub?gid=0&single=true&output=csv
   ```

發布 CSV 代表知道網址的人可以讀取評分內容；不要在評語或評審名稱存放個資或敏感資訊。

## 4. 填入前端網址

開啟 `index.html`，找到：

```js
const CSV_URL = "YOUR_PUBLISHED_GOOGLE_SHEET_CSV_URL";
const GAS_URL = "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL";
```

分別換成第 3 步的 CSV 網址與第 2 步的 `/exec` 網址。店家、人員或推薦品項也可在同一檔案的 `SHOPS`、評審 `<option>` 清單中調整。

重要：`SHOPS` 中每家的 `id` 是評分關聯鍵。正式開始收資料後，不要任意修改既有 ID，否則舊評分不會歸到該店家。

## 5. 本機預覽

不要直接雙擊 `index.html`（`file://` 可能有跨來源限制），在專案目錄執行：

```bash
python3 -m http.server 8000
```

再開啟 `http://localhost:8000`。尚未填入兩個網址時，介面仍可預覽，但不會讀寫評分。

## 6. 部署 GitHub Pages

1. 在 GitHub 建立 repository，並將這三個檔案推送到預設分支：

   ```bash
   git init
   git add index.html google-script.js README.md
   git commit -m "Build Changhua meatball marathon rating site"
   git branch -M main
   git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
   git push -u origin main
   ```

2. 到 repository 的「Settings → Pages」。
3. Source 選「Deploy from a branch」，分支選 `main`、資料夾選 `/ (root)`，按 Save。
4. 等待 GitHub 完成部署，網站網址會是：

   ```text
   https://YOUR_ACCOUNT.github.io/YOUR_REPOSITORY/
   ```

## 使用與維護提醒

- 店家營業時間可能異動，活動前請向店家確認；頁面資料可直接在 `SHOPS` 更新。
- GitHub Pages 與發布的 CSV 都是公開資源，GAS Web App 也允許匿名寫入。若是公開大型活動，建議再加入 CAPTCHA、寫入頻率限制或改用有驗證的後端。
- 前端會忽略不在 1–5 的值，並在平均計算時排除 N/A。
- 若資料沒有立即更新，Google 發布 CSV 可能有短暫快取，稍後重新整理即可。
