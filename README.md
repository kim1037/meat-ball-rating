# 彰化肉圓馬拉松

純前端單頁網站，可直接部署到 GitHub Pages。評分資料的讀寫都經由同一支 Google Apps Script Web App，試算表本身維持私人、不需要對外發布。

## 專案檔案

- `index.html`：完整 SPA、台味復古視覺、評分表單、評分讀取與 Chart.js 雷達圖。
- `google-script.js`：貼入 Google Apps Script 的後端程式。
- `image/main_post.jpg`：活動主視覺原圖（1536×1024）。
- `image/og-poster.jpg`：分享預覽圖（1200×630，由主視覺產生，見下方「分享預覽圖」）。
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
4. 在函式選單選取 `setupSheet`，按「執行」，依畫面完成 Google 授權。執行後會自動：

   - 建立 `Ratings` 工作表與標題列、凍結首列
   - 將試算表時區設為 `Asia/Taipei`（`SHEET_TIMEZONE`）
   - 把 `timestamp` 欄的顯示格式固定成 ISO 8601（`yyyy-mm-ddThh:mm:ss`）

   時間格式這一項是必要的：發布的 CSV 會套用儲存格顯示格式，中文地區預設會輸出「2026/9/16 下午 2:30:00」，前端 `new Date()` 解析不了，歷史評分的日期會全部顯示「日期未記錄」。若試算表是在加入此設定前建立的，請重新執行一次 `setupSheet`。
5. 右上角選擇「部署 → 新增部署作業 → 網頁應用程式」，設定：

   - 執行身分：**我**
   - 誰可以存取：**任何人**

6. 完成部署，複製以 `/exec` 結尾的 Web App 網址。
7. 直接在瀏覽器開啟該網址；若看到 `"ok":true`，代表 Web App 可用。

每次修改 Apps Script 後，都要到「管理部署作業」編輯現有部署並建立新版本，否則線上網址仍會執行舊程式。

### CORS 說明

Apps Script 的 `ContentService` 不提供自行加入 `Access-Control-Allow-Origin` 標頭的 API。這份前端以 `Content-Type: text/plain` 傳送 JSON，屬於瀏覽器的 CORS「簡單請求」，不會送出 GAS 無法處理的 `OPTIONS` 預檢；Web App 必須發布為「任何人」才能讓 GitHub Pages 寫入。請勿把 Content-Type 改為 `application/json`，否則會觸發預檢而失敗。

## 3. 為什麼不用發布的 CSV

早期版本以「發布到網路」的 CSV 當讀取來源，已改掉。原因是該 CSV 由多個快取節點提供，實測同一時間連續請求會**隨機拿到新舊兩種版本**：

```text
第 1 次  資料列數: 0
第 2 次  資料列數: 0
第 3 次  資料列數: 3
第 4 次  資料列數: 0
第 5 次  資料列數: 3
```

使用者送出評分後重新整理，有機率看到自己的評分消失。加上 `&_=timestamp` 之類的 cache-busting 參數無效，過期發生在 Google 節點之間而非瀏覽器。

現在改由 `doGet` 直接讀試算表回傳 JSON，沒有快取問題，另外兩個好處是試算表不必公開發布，而且前端少一個 PapaParse 相依。

**若你之前已經發布過 CSV，可以到「檔案 → 共用 → 發布到網路」按「停止發布」**，減少不必要的公開曝光。

## 4. 填入前端網址

開啟 `index.html`，找到：

```js
const GAS_URL = "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL";
```

換成第 2 步的 `/exec` 網址。店家、人員或推薦品項也可在同一檔案的 `SHOPS`、評審 `<option>` 清單中調整。

重要：`SHOPS` 中每家的 `id` 是評分關聯鍵。正式開始收資料後，不要任意修改既有 ID，否則舊評分不會歸到該店家。

## 5. 本機預覽

不要直接雙擊 `index.html`（`file://` 可能有跨來源限制），在專案目錄執行：

```bash
python3 -m http.server 8000
```

再開啟 `http://localhost:8000`。尚未填入 `GAS_URL` 時，介面仍可預覽，但不會讀寫評分。

## 6. 部署 GitHub Pages

1. 在 GitHub 建立 repository，並將這三個檔案推送到預設分支：

   ```bash
   git init
   git add index.html google-script.js image/ README.md
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

## 分享預覽圖

貼到 LINE 群組或 Facebook 時顯示的縮圖為 `image/og-poster.jpg`（1200×630），由 `index.html` 的 Open Graph meta 指定。

主視覺原圖 `image/main_post.jpg` 是 1536×1024（1.5:1），與 OG 的 1.91:1 不合。上下裁切會切到標題與碗、跑者，因此改以左右補邊（pillarbox）保留完整畫面，補邊處用主視覺本身模糊放大當底。重新產生的指令：

```bash
magick image/main_post.jpg \
  \( -clone 0 -resize 1200x630^ -gravity center -extent 1200x630 -blur 0x30 -modulate 96,105 \) \
  \( -clone 0 -resize 1200x630 \) \
  -delete 0 -gravity center -composite \
  -strip -interlace JPEG -sampling-factor 4:2:0 -quality 84 \
  image/og-poster.jpg
```

補邊是權宜做法，主視覺實際只佔預覽卡約八成寬。若要讓畫面填滿，需按 1200×630 重新排版，而不是直接縮放。

其他注意事項：

- 檔案需壓在 **300 KB 以下**，LINE 對過大的圖會放棄抓取（目前約 193 KB）。
- meta 內是絕對網址，目前寫死為 `https://kim1037.github.io/meat-ball-rating/`。換 repository 或接自訂網域時，`og:url`、`og:image`、`twitter:image` 三處都要一起改。
- 標語以網頁版的「**跑一份馬，拉一份情**」為準。主視覺右下角目前寫「跑一場"馬"，拉一份情」，重新產圖時需更正。
- 主視覺左下角的「報名時間 6/5–8/15」對這個網站沒有意義（站內無報名流程），重新排版時建議移除。

改完 meta 後，各平台都有快取。Facebook 用 [Sharing Debugger](https://developers.facebook.com/tools/debug/) 按「Scrape Again」可強制更新；LINE 沒有公開的清快取工具，可在網址後加 `?v=2` 之類的參數繞過。

## 使用與維護提醒

- 店家營業時間可能異動，活動前請向店家確認；頁面資料可直接在 `SHOPS` 更新。
- GitHub Pages 是公開資源，GAS Web App 也允許匿名讀寫。試算表本身維持私人，但拿到 `/exec` 網址的人可以讀取全部評分並寫入新資料。若是公開大型活動，建議再加入 CAPTCHA、寫入頻率限制或改用有驗證的後端。
- 前端會忽略不在 1–5 的值，並在平均計算時排除 N/A。
