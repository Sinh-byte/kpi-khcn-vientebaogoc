# Migrations DB (Supabase) — dọn dữ liệu trùng

> Hiện tại project đang dùng **Google Sheets** (qua Apps Script) làm nguồn `activities`. Supabase chỉ giữ `kpi_config_entries` / snapshots. Hai file SQL trong thư mục này **chỉ áp dụng khi/nếu** bạn migrate dữ liệu hoạt động sang Supabase (tạo các bảng `activities` và `activity_authors`).
>
> Việc dedup tại nguồn cho luồng hiện tại đã được xử lý ở:
> - `index.html` — hàm `dedupSheetRows(...)` (loại trùng trước khi đẩy lên Sheet)
> - `apps-script/Code.gs` — hàm `dedupValues_(...)` trong `doPost` (chốt chặn server-side)
> - `user.html` — hàm `dedupActivities(...)` (dedup khi đọc dữ liệu, an toàn cho hiển thị)

## Mục tiêu
- Xử lý hiện tượng tra cứu KPI hiển thị **bài bị trùng** sau khi đồng bộ.
- Có 2 nguyên nhân chính:
  1. Bảng `activities` có nhiều bản ghi cùng nội dung (khác `id`) — do sync chạy lặp.
  2. Bảng `activity_authors` có nhiều dòng tác giả trùng tên trong cùng 1 `activity_id`.

Frontend (`user.html`) đã có `dedupActivities(...)` để dedup khi hiển thị, nhưng để **bền vững** thì cần dọn dữ liệu nguồn ở Supabase và thêm `UNIQUE INDEX` chặn trùng về sau.

## Cấu trúc giả định
- `activities(id, year, stt, activity_type, ranking, title, journal, total_authors, h_max, primary_outside_unit, in_unit_author_count, ...)`
- `activity_authors(id, activity_id, author_name, role, author_order, ...)`

Nếu schema khác (đặc biệt là kiểu của `id`/`activity_id`), kiểm tra lại trước khi chạy.

## Cách chạy
1. **Backup trước**: Supabase Dashboard → Database → Backups (hoặc `pg_dump` nếu self-host).
2. Mở **SQL Editor** → tạo query mới.
3. Chạy lần lượt:
   - `001_dedup_activities.sql`
   - `002_dedup_activity_authors.sql`
4. Mỗi file có `BEGIN; ... COMMIT;` — nếu xảy ra lỗi giữa chừng, transaction sẽ rollback.

## Sau khi chạy
- Kiểm tra: trang user, F12 → Console. Khi tra cứu, **không** còn dòng `Dedup activities: X -> Y (removed N duplicates)` nữa nghĩa là DB đã sạch.
- Nếu sync mới sau này cố insert lại trùng, `UNIQUE INDEX` sẽ trả lỗi → cần điều chỉnh script sync sang `INSERT ... ON CONFLICT ... DO UPDATE`.

## Rollback (gợi ý)
- Nếu muốn bỏ index:
  ```sql
  DROP INDEX IF EXISTS activities_unique_content_idx;
  DROP INDEX IF EXISTS activity_authors_unique_per_author_idx;
  ```
- Việc khôi phục các bản ghi đã xoá phải lấy từ backup (SQL không tự rollback sau khi `COMMIT`).
