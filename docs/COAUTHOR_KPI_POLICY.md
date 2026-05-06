## Ghi chú nghiệp vụ: KPI đồng tác giả khi “tác giả chính ngoài Viện”

### Mục tiêu
- Chốt cách hiểu/diễn giải công thức để tính KPI **cho tác giả thuộc Viện/Trường** khi công trình có **tác giả chính ngoài Viện**.
- Tài liệu này là “nguồn tham chiếu” để tránh tranh cãi về sau.

### Ký hiệu
- **\(H_{\max}\)**: giờ/điểm cơ sở của công trình (định mức gốc).
- **\(A\)**: tổng số tác giả của công trình (gồm cả ngoài Viện).
- **\(n\)**: số tác giả thuộc Viện/Trường trong công trình.
- **\(H_{\mathrm{eff}}\)**: phần giờ/điểm “quy về Viện/Trường” theo tỷ lệ tác giả:

  \[
  H_{\mathrm{eff}} = H_{\max}\times\frac{n}{A}
  \]

### Chính sách đã chốt
Trong trường hợp **tác giả chính ngoài Viện**, với **đồng tác giả thuộc Viện/Trường** áp dụng:

\[
\text{Điểm(1 đồng tác giả thuộc Viện)}=\frac{\frac{2}{3}H_{\mathrm{eff}}}{n}
\]

Tương đương (rút gọn đại số):

\[
\frac{\frac{2}{3}H_{\mathrm{eff}}}{n}
=\frac{2}{3}\times\frac{H_{\max}\times\frac{n}{A}}{n}
=\frac{2}{3}\times\frac{H_{\max}}{A}
\]

**Hệ quả quan trọng**
- Điểm của 1 đồng tác giả thuộc Viện theo công thức trên **luôn bằng** cách tính “Cách 2 truyền thống” trên toàn công trình: \(\frac{2}{3}H_{\max}\times\frac{1}{A}\).
- Vì vậy dùng \(H_{\mathrm{eff}}\) trong trường hợp tác giả chính ngoài Viện chỉ là cách “viết lại cho đúng tầng”, không làm thay đổi điểm của từng đồng tác giả thuộc Viện.

### Ví dụ kiểm chứng
Giả sử:
- \(H_{\max}=3600\)
- \(A=14\)
- \(n=2\)

Khi đó:

\[
H_{\mathrm{eff}}=3600\times\frac{2}{14}\approx 514{,}29
\]

Điểm của **1 đồng tác giả thuộc Viện**:

\[
\frac{\frac{2}{3}H_{\mathrm{eff}}}{n}
=\frac{2}{3}\times\frac{514{,}29}{2}
\approx 171{,}43
\]

Đối chiếu với “Cách 2 truyền thống”:

\[
\frac{2}{3}H_{\max}\times\frac{1}{A}
=\frac{2}{3}\times 3600\times\frac{1}{14}
=\frac{2400}{14}
\approx 171{,}43
\]

### Phạm vi
- Tài liệu này **chỉ chốt** cách tính điểm cho **đồng tác giả thuộc Viện/Trường** khi **tác giả chính ngoài Viện**.
- Không thực hiện thay đổi code trong bước này.

