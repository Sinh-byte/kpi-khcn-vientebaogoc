# Hệ thống Tra cứu & Quản lý KPI KHCN — Viện Tế bào gốc

Ứng dụng web tĩnh (Netlify) kết hợp backend Google Apps Script + Google Sheets phục vụ nhập liệu, quy đổi giờ nghiên cứu khoa học (KPI KHCN) và tra cứu theo cá nhân / năm công bố.

## Kiến trúc & Cấu trúc thư mục

```text
kpi-khcn-vientebaogoc/
├── index.html                  # Cổng quản trị (/admin) — cấu hình, upload Excel, bảo mật
├── user.html                   # Cổng tra cứu cá nhân (/user) — tra cứu điểm, xuất Word
├── admin-kpi.html              # Tra cứu KPI theo danh sách nghiên cứu viên (Admin)
├── assets/
│   ├── css/
│   │   ├── common.css          # Design tokens & style dùng chung
│   │   ├── admin-dashboard.css # Style trang quản trị
│   │   ├── admin-kpi.css       # Style trang tra cứu theo người
│   │   └── user.css            # Style trang tra cứu User
│   └── js/
│       ├── config.js           # Nguồn cấu hình tập trung (SCRIPT_URL, token, mặc định)
│       ├── kpi-core.js         # Nghiệp vụ lõi: chuẩn hóa tên, lọc trùng, tính điểm KPI
│       ├── admin-auth.js       # Module xác thực Admin (đăng nhập, thiết lập lần đầu, OTP)
│       ├── admin-dashboard.js  # Controller trang quản trị
│       ├── admin-kpi.js        # Controller trang tra cứu theo người
│       └── user-portal.js      # Controller trang tra cứu User
├── apps-script/
│   └── Code.gs                 # Backend Google Apps Script (Sheet năm, KPI_Settings, KPI_Config, Admin_Auth)
├── docs/
│   ├── COAUTHOR_KPI_POLICY.md  # Quy ước công thức đồng tác giả khi tác giả chính ngoài Viện
│   ├── KPI_CONFIG_API.md       # Tài liệu API cấu hình KPI
│   └── migrations/             # SQL migration dự phòng khi dùng Supabase
├── tests/
│   ├── kpi-core.test.js        # Unit test cho nghiệp vụ tính KPI & lọc trùng
│   └── syntax-check.js         # Kiểm tra cú pháp JS/GS, liên kết asset và quét mật khẩu cứng
├── netlify.toml                # Cấu hình publish tĩnh trên Netlify
├── _redirects                  # Định tuyến /user và /admin
└── package.json
```

## Xác thực & Bảo mật Admin

- **Không lưu mật khẩu trong mã nguồn.** Mật khẩu quản trị được lưu trong sheet riêng `Admin_Auth` trên Google Sheets dưới dạng băm **SHA-256 + salt ngẫu nhiên**.
- **Thiết lập lần đầu:** Khi `Admin_Auth` chưa có dữ liệu, màn hình đăng nhập tự động yêu cầu đặt mật khẩu Admin (tối thiểu 6 ký tự) và email khôi phục.
- **Quên mật khẩu:** Hệ thống tạo mã OTP 6 chữ số (hiệu lực 10 phút, tối đa 5 lần thử sai) và gửi qua `MailApp.sendEmail` tới email khôi phục đã đăng ký.
- **Đổi mật khẩu / email:** Thực hiện trực tiếp tại mục **Bảo mật & Mật khẩu Admin** trong `index.html` sau khi đăng nhập.

## Triển khai

### 1. Backend (Google Apps Script)
1. Mở Google Sheet chứa các sheet năm (`2024`, `2025`, `2026`, ...), `KPI_Settings`, `KPI_Config`.
2. Vào **Extensions → Apps Script**, dán nội dung `apps-script/Code.gs`.
3. Chọn **Deploy → New deployment → Web app** (`Execute as: Me`, `Who has access: Anyone`) và cấp quyền Sheets + MailApp.
4. Cập nhật `SCRIPT_URL` duy nhất tại `assets/js/config.js`.

### 2. Frontend (Netlify)
- Netlify publish trực tiếp thư mục gốc (`publish = "."`, không cần bước build).
- Route `/admin` trỏ tới `index.html`; route `/user` trỏ tới `user.html`.

## Kiểm thử

Yêu cầu Node.js >= 18:

```bash
npm run verify
```

Lệnh trên chạy kiểm tra cú pháp toàn bộ tệp JS/Apps Script, kiểm tra đường dẫn asset cục bộ trong HTML, quét mật khẩu cứng và chạy bộ unit test nghiệp vụ KPI.
