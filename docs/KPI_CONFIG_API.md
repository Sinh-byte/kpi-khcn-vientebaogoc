# KPI_Config — Contract API (Apps Script + Sheet)

## Sheet `KPI_Config`

Tạo sheet tên đúng **`KPI_Config`** trong Spreadsheet mà Apps Script đang dùng.

**Hàng tiêu đề (dòng 1):**

| year | rowType | groupKey | authorRowKey | invalid | authorNoPoints | kOverride | updatedAt |
|------|---------|----------|--------------|---------|----------------|-----------|-----------|

- **year**: năm tra cứu (chuỗi, ví dụ `2025`).
- **rowType**: `group` hoặc `author`.
- **groupKey**: khóa nhóm công trình — **cùng giá trị** với `getActivityGroupKey(activity)` trong `user.html` (chuỗi ghép title, journal, year, …).
- **authorRowKey**: khóa một dòng tác giả — **cùng giá trị** với `getAuthorRowStorageKey(activity)` (= groupKey + `||` + tên đã chuẩn hoá).
- **invalid**: chỉ dùng khi `rowType = group` (`TRUE`/`FALSE`).
- **authorNoPoints**: chỉ dùng khi `rowType = author`.
- **kOverride**: số `1`–`4` hoặc để trống (= áp dụng “tự động”, không ghi đè K).

Script tự tạo sheet + tiêu đề nếu chưa có.

## Apps Script

1. Copy nội dung file `apps-script/KpiConfig.gs` vào project Apps Script của bạn.
2. Trong `doGet(e)` hiện có (đang phục vụ `availableYears`, đọc sheet năm, …), **thêm nhánh đầu tiên**:

```javascript
function doGet(e) {
  var kpi = handleKpiConfigDoGet_(e);
  if (kpi) return kpi;

  // ... code doGet cũ của bạn (sheet=..., JSON activities, v.v.)
}
```

3. Đặt `SECRET_TOKEN` trong `KpiConfig.gs` (hoặc để `''` để tắt kiểm tra).
4. **Triển khai lại** Web App (Deploy → New version / Manage deployments).

## `user.html`

- `KPI_CONFIG_CLOUD_ENABLED = true` để bật đồng bộ.
- `KPI_CONFIG_TOKEN = '...'` phải **khớp** `SECRET_TOKEN` trong Apps Script (hoặc cả hai để trống).

## HTTP API (GET — cùng `SCRIPT_URL` như tra cứu)

Tất cả đều là query string `GET` (tránh vướng CORS POST từ Netlify).

### `action=getKpiConfig`

```
?action=getKpiConfig&year=2025&token=...
```

**Phản hồi JSON:**

```json
{
  "ok": true,
  "year": "2025",
  "invalidByGroup": { "<groupKey thô>": true },
  "authorByRow": {
    "<authorRowKey thô>": {
      "authorNoPoints": false,
      "kOverride": 2
    }
  }
}
```

Khóa trong `invalidByGroup` / `authorByRow` là **chuỗi thô** (không `encodeURIComponent`), trùng với hàm trong `user.html`.

### `action=setInvalid`

```
?action=setInvalid&year=2025&groupKey=<encodeURIComponent(groupKey)>&invalid=true&token=...
```

`invalid=false`: xóa dòng `group` tương ứng trên Sheet.

### `action=setAuthorRow`

```
?action=setAuthorRow&year=2025&authorRowKey=<encodeURIComponent(authorRowKey)>&authorNoPoints=true|false&kOverride=2&token=...
```

`kOverride` có thể để trống để xóa K ghi đè. Nếu `authorNoPoints=false` và không có `kOverride`, dòng `author` bị **xóa** (không còn ghi đè).

## Thứ tự ưu tiên trên client (`user.html`)

1. Dữ liệu từ Sheet (sau khi `getKpiConfig` tải xong) được gộp vào `cloudConfig` và **đồng bộ xuống `localStorage`** (offline).
2. Khi xung đột, **Sheet** là nguồn sau khi fetch; chỉnh trên UI sẽ **ghi Sheet + local**.

## Giới hạn

- URL GET có giới hạn độ dài; khóa `groupKey` / `authorRowKey` rất dài có thể lỗi trên một số trình duyệt — khi đó cần chuyển sang POST + proxy hoặc rút gọn khóa phía server.
