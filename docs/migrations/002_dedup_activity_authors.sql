-- =========================================================
-- 002_dedup_activity_authors.sql
-- Mục tiêu:
--   1) Trong cùng 1 activity, gộp các tác giả trùng tên (so sánh chuẩn hoá).
--   2) Tạo UNIQUE INDEX để chặn trùng tác giả về sau.
--
-- LƯU Ý:
--   - Chuẩn hoá trùng dùng LOWER(BTRIM(author_name)). Dấu tiếng Việt và
--     khoảng trắng kép vẫn coi là khác nhau (không bỏ dấu hết) để tránh
--     gộp nhầm 2 người gần giống tên.
--   - Nếu sau này muốn bỏ dấu khi so trùng, cần thêm extension `unaccent`
--     và đổi expression bên dưới thành `LOWER(BTRIM(unaccent(author_name)))`.
-- =========================================================

BEGIN;

-- 1) Xoá bản trùng trong cùng activity, giữ id nhỏ nhất.
DELETE FROM activity_authors a
USING activity_authors b
WHERE a.activity_id = b.activity_id
  AND LOWER(BTRIM(COALESCE(a.author_name, ''))) = LOWER(BTRIM(COALESCE(b.author_name, '')))
  AND a.id > b.id;

-- 2) UNIQUE INDEX chống trùng về sau.
CREATE UNIQUE INDEX IF NOT EXISTS activity_authors_unique_per_author_idx
ON activity_authors (
    activity_id,
    LOWER(BTRIM(COALESCE(author_name, '')))
);

COMMIT;
