-- =========================================================
-- 001_dedup_activities.sql
-- Mục tiêu:
--   1) Gộp các bản ghi trùng trong bảng `activities` (cùng nội dung khác id).
--   2) Chuyển toàn bộ `activity_authors` của bản trùng về bản canonical.
--   3) Tạo UNIQUE INDEX để chặn trùng lặp về sau.
--
-- Cách dùng (Supabase Dashboard -> SQL Editor):
--   - Backup trước (Database -> Backups hoặc pg_dump nếu self-host).
--   - Chạy nguyên file. Có BEGIN/COMMIT để rollback được nếu lỗi giữa chừng.
--   - Nếu UNIQUE INDEX tạo lỗi vì còn trùng (rất hiếm), kiểm tra dữ liệu rồi
--     chạy lại đoạn DELETE/UPDATE phía trên.
-- =========================================================

BEGIN;

-- 1) Tính canonical_id cho mỗi nhóm trùng (giữ id nhỏ nhất).
DROP TABLE IF EXISTS _activities_dedup;
CREATE TEMP TABLE _activities_dedup AS
SELECT
    id,
    FIRST_VALUE(id) OVER (
        PARTITION BY
            COALESCE(year, ''),
            LOWER(BTRIM(COALESCE(title, ''))),
            LOWER(BTRIM(COALESCE(journal, ''))),
            LOWER(BTRIM(COALESCE(ranking, ''))),
            LOWER(BTRIM(COALESCE(activity_type, ''))),
            COALESCE(h_max, 0),
            COALESCE(total_authors, 0)
        ORDER BY id ASC
    ) AS canonical_id
FROM activities;

-- 2) Re-point activity_authors từ duplicate -> canonical.
UPDATE activity_authors aa
SET activity_id = d.canonical_id
FROM _activities_dedup d
WHERE aa.activity_id = d.id
  AND d.id <> d.canonical_id;

-- 3) Xoá các bản ghi activities trùng (giữ canonical).
DELETE FROM activities a
USING _activities_dedup d
WHERE a.id = d.id
  AND d.id <> d.canonical_id;

DROP TABLE _activities_dedup;

-- 4) Chống trùng về sau: UNIQUE INDEX trên expressions chuẩn hoá.
--    Cùng (year, title, journal, ranking, activity_type, h_max, total_authors)
--    coi như cùng một công trình.
CREATE UNIQUE INDEX IF NOT EXISTS activities_unique_content_idx
ON activities (
    COALESCE(year, ''),
    LOWER(BTRIM(COALESCE(title, ''))),
    LOWER(BTRIM(COALESCE(journal, ''))),
    LOWER(BTRIM(COALESCE(ranking, ''))),
    LOWER(BTRIM(COALESCE(activity_type, ''))),
    COALESCE(h_max, 0),
    COALESCE(total_authors, 0)
);

COMMIT;
