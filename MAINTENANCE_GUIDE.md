# Ứng Dụng Lịch Bay - Hướng Dẫn Bảo Trì

## 📋 Tổng Quan

Hướng dẫn này bao gồm bảo trì và khắc phục sự cố cho ứng dụng Quản Lý Lịch Bay Chuyên Nghiệp.

---

## 🚀 Bắt Đầu

### Yêu Cầu
- Node.js 18+
- npm hoặc yarn
- Truy cập Supabase project
- Truy cập PostgreSQL database

### Cài Đặt & Thiết Lập

```bash
# Cài đặt dependencies
npm install

# Thiết lập biến môi trường
cp .env.example .env.local
# Chỉnh sửa .env.local với thông tin Supabase của bạn

# Chạy development server
npm run dev

# Build cho production
npm run build
```

### Biến Môi Trường Cần Thiết
```env
VITE_SUPABASE_URL=supabase_url_của_bạn
VITE_SUPABASE_ANON_KEY=anon_key_của_bạn
```

---

## 🔧 Công Việc Bảo Trì Thường Xuyên

### 1. Quản Lý Cơ Sở Dữ Liệu

#### Sao Lưu Cơ Sở Dữ Liệu
```bash
# Xuất dữ liệu flight_schedule
pg_dump -h host_của_bạn -U postgres -d database_của_bạn \
  -t flight_schedule > backup_$(date +%Y%m%d).sql
```

#### Đặt Lại Dữ Liệu Theo Khoảng Thời Gian
```sql
-- Xóa các bản ghi trong khoảng thời gian cụ thể
DELETE FROM flight_schedule 
WHERE (sta BETWEEN '2026-01-19' AND '2026-01-20')
   OR (std BETWEEN '2026-01-19' AND '2026-01-20');
```

#### Kiểm Tra Kích Thước Cơ Sở Dữ Liệu
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 2. Quản Lý Dữ Liệu Import

#### Giám Sát Tiến Độ Import
- Kiểm tra console logs với tiền tố `[Delete]`, `[Upsert]`
- Giám sát cập nhật thanh tiến độ trong ImportProgressModal
- Xem lại thống kê cuối cùng: inserted, updated, failed counts

#### Debug Các Bản Ghi Thất Bại
```javascript
// Các bản ghi thất bại sẽ in ra:
[Upsert] Record X insert failed: thông báo lỗi
// Kiểm tra chi tiết lỗi trong console trình duyệt
```

#### Vấn Đề Import Thường Gặp
| Vấn Đề | Nguyên Nhân | Giải Pháp |
|--------|-----------|----------|
| "0 inserted, 0 updated" | Bộ lọc khoảng thời gian quá chặt | Điều chỉnh khoảng ngày/giờ |
| Column not found error | Sai mapping cột | Xác minh tên cột khớp database |
| RLS policy violation | Quyền bị từ chối | Kiểm tra vai trò trong hệ thống RBAC |

### 3. Tối Ưu Hóa Hiệu Năng

#### Trạng Thái Index
```sql
-- Kiểm tra việc sử dụng index
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

#### Hiệu Năng Truy Vấn
- Giám sát các truy vấn chậm trong bảng điều khiển Supabase
- Kiểm tra số lượng hàng: `SELECT COUNT(*) FROM flight_schedule;`
- Lưu trữ dữ liệu cũ (> 6 tháng) để cải thiện hiệu năng

### 4. Bảo Mật & Kiểm Soát Truy Cập

#### Quản Lý Vai Trò Người Dùng
```sql
-- Xem vai trò người dùng
SELECT u.id, u.email, r.name as role
FROM auth.users u
JOIN public.user_roles ur ON u.id = ur.user_id
JOIN public.roles r ON ur.role_id = r.id;

-- Thêm người dùng vào vai trò
INSERT INTO user_roles (user_id, role_id)
VALUES (uuid_người_dùng, uuid_vai_trò);
```

#### Kiểm Tra Chính Sách RLS
```sql
SELECT tablename, policyname, permissive, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

#### Đặt Lại Mật Khẩu Người Dùng
- Sử dụng Supabase Dashboard → Authentication → Users
- Gửi email đặt lại mật khẩu cho người dùng
- Người dùng đặt lại thông qua liên kết email

### 5. Giám Sát & Ghi Nhật Ký

#### Kiểm Tra Lỗi Ứng Dụng
1. Console trình duyệt (`F12` → Console tab)
2. Supabase Dashboard → Logs
3. Thông báo lỗi trong modal ứng dụng

#### Tiền Tố Nhật Ký Có Sẵn
- `[Delete]` - Các hoạt động xóa bản ghi
- `[Upsert]` - Các hoạt động insert/update
- `[FileUpload]` - Quy trình tải tệp
- `[Auth Event]` - Các sự kiện xác thực

### 6. Sao Lưu & Khôi Phục

#### Chiến Lược Sao Lưu Hàng Ngày
```bash
# Script sao lưu tự động
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump database_của_bạn | gzip > backups/flight_schedule_$TIMESTAMP.sql.gz

# Chỉ giữ 30 ngày gần đây
find backups/ -name "flight_schedule_*.sql.gz" -mtime +30 -delete
```

#### Khôi Phục Từ Sao Lưu
```bash
# Khôi phục dữ liệu
gunzip -c backups/flight_schedule_YYYYMMDD.sql.gz | psql database_của_bạn
```

---

## 🐛 Khắc Phục Sự Cố

### Ứng Dụng Không Khởi Động
```bash
# Xóa cache và cài đặt lại
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Lỗi TypeScript
```bash
# Xây dựng lại TypeScript
npm run build
# hoặc kiểm tra kiểu
npx tsc --noEmit
```

### Vấn Đề Kết Nối Supabase
1. Xác minh `.env.local` có thông tin xác thực chính xác
2. Kiểm tra trạng thái dự án Supabase (trực tuyến)
3. Kiểm tra kết nối: `curl https://supabase-url-của-bạn/rest/v1/`
4. Kiểm tra chính sách RLS không chặn truy cập public

### Import Bị Treo Ở 0%
- Kiểm tra console có thông báo lỗi
- Xác minh định dạng tệp (Excel .xlsx hoặc .xls)
- Đảm bảo mapping cột chính xác
- Kiểm tra kết nối cơ sở dữ liệu

### Thanh Tiến Độ Không Cập Nhật
- Điều này bình thường cho xử lý theo batch
- Kết quả cuối cùng hiển thị sau hoàn thành
- Kiểm tra nhật ký console để xem tiến độ thực tế

---

## 📊 Lược Đồ Cơ Sở Dữ Liệu

### Các Bảng Chính

#### flight_schedule
- **id** (bigint) - Khóa chính
- **arr_flight** (text) - Số chuyến bay đến
- **dep_flight** (text) - Số chuyến bay đi
- **sta** (timestamp) - Thời gian hạ cánh dự kiến
- **std** (timestamp) - Thời gian cất cánh dự kiến
- **ata, atd** (timestamp) - Thời gian hạ/cất cánh thực tế
- **gate, carousel** (text) - Thông tin cửa ra, băng chuyển
- **arr_pax, dep_pax** (integer) - Số hành khách

**Khóa Tổng Hợp** (logic, không phải ràng buộc cơ sở dữ liệu):
- Đến: `(arr_flight, DATE(sta))`
- Đi: `(dep_flight, DATE(std))`

#### Bảng RBAC
- **roles** - Admin, Dispatcher, Supervisor, Viewer
- **permissions** - Actions: view, edit, import, v.v.
- **role_permissions** - Liên kết vai trò với quyền hạn
- **user_roles** - Gán người dùng cho vai trò

---

## 🔐 Công Việc Quản Trị Thường Gặp

### Thêm Người Dùng Mới
1. Đi tới Supabase Dashboard → Authentication → Users
2. Nhấp "Add User"
3. Nhập email, đặt mật khẩu
4. Người dùng xuất hiện trong bảng `auth.users`

### Gán Vai Trò Cho Người Dùng
```sql
-- Sau khi người dùng được tạo, gán vai trò
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT u.id, r.id, current_user_id
FROM auth.users u, roles r
WHERE u.email = 'user@example.com'
AND r.name = 'dispatcher';
```

### Cấp Quyền Import
```sql
-- Người dùng phải có action 'import' trên resource 'flights'
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'dispatcher'
AND p.action = 'import'
AND p.resource = 'flights';
```

---

## 📈 Điều Chỉnh Hiệu Năng

### Trước Khi Import Lớn
```sql
-- Tắt trigger tạm thời (nếu có)
ALTER TABLE flight_schedule DISABLE TRIGGER ALL;
-- Bật lại sau
ALTER TABLE flight_schedule ENABLE TRIGGER ALL;
```

### Hiệu Năng Xóa Theo Batch
```sql
-- Thay vì xóa hàng loạt, xóa theo batch
DELETE FROM flight_schedule 
WHERE id IN (
  SELECT id FROM flight_schedule 
  WHERE (sta BETWEEN ngày_bắt_đầu AND ngày_kết_thúc)
  LIMIT 1000
);
-- Lặp lại cho đến khi xóa hết
```

### Giám Sát Connection Pool
- Kiểm tra Supabase Dashboard → Database → Connections
- Giới hạn import đồng thời từ 2-3
- Khởi động lại connection pool nếu bị rò rỉ

---

## 🚨 Thủ Tục Khẩn Cấp

### Khẩn Cấp Cơ Sở Dữ Liệu
1. **Kiểm tra trạng thái**: Supabase Dashboard → Database
2. **Xem nhật ký**: Supabase Dashboard → Logs
3. **Liên hệ hỗ trợ** nếu ngoại tuyến

### Dữ Liệu Bị Hỏng
1. Khôi phục từ sao lưu mới nhất
2. Xác minh tính toàn vẹn dữ liệu
3. Chạy lại import nếu cần thiết

### Mất Thông Tin Xác Thực
1. Đặt lại khóa API Supabase trong Dashboard
2. Cập nhật `.env.local` với khóa mới
3. Khởi động lại ứng dụng

---

## 📞 Hỗ Trợ & Tài Nguyên

### Tài Liệu Nội Bộ
- Xem các bình luận trong tệp TypeScript
- Kiểm tra PropTypes component cho hợp đồng API
- Xem lại các tệp migration trong thư mục `/migrations`

### Tài Nguyên Supabase
- [Tài Liệu Supabase](https://supabase.com/docs)
- [Tài Liệu PostgreSQL](https://www.postgresql.org/docs/)
- [Hướng Dẫn Chính Sách RLS](https://supabase.com/docs/guides/auth/row-level-security)

### Công Cụ Phát Triển
- DevTools Trình duyệt: Kiểm tra component React, Network, Console
- Supabase Studio: Truy cập cơ sở dữ liệu trực tiếp qua web
- psql CLI: Truy cập cơ sở dữ liệu qua dòng lệnh

---

## ✅ Danh Sách Kiểm Tra Bảo Trì

- [ ] Hàng tuần: Kiểm tra nhật ký lỗi trong console
- [ ] Hàng tuần: Xác minh gán vai trò người dùng
- [ ] Hàng tháng: Kiểm tra kích thước cơ sở dữ liệu & dọn dẹp
- [ ] Hàng tháng: Kiểm tra quy trình sao lưu & khôi phục
- [ ] Hàng quý: Xem lại & lưu trữ dữ liệu cũ
- [ ] Hàng quý: Cập nhật dependencies (`npm update`)
- [ ] Nửa năm một lần: Kiểm toán bảo mật & xem lại chính sách RLS

---

**Cập Nhật Lần Cuối:** 2 Tháng 2, 2026  
**Phiên Bản:** 1.0
