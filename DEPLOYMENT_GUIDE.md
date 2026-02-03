# 🚀 Hướng Dẫn Triển Khai Ứng Dụng Airport OPS Master

Hướng dẫn này cung cấp các bước chi tiết để triển khai ứng dụng Airport OPS Master từ đầu, bao gồm cấu hình Supabase, khởi tạo database, tạo bảng, policies, và RPC functions.

---

## 📋 Yêu Cầu Tiên Quyết

- **Supabase Account**: https://supabase.com (free tier có thể dùng)
- **Node.js**: ≥ 18.0.0
- **Git**: Để clone repository
- **PostgreSQL CLI** (tuỳ chọn): pg_dump, psql
- **Code Editor**: VS Code, WebStorm, etc.

---

## 🔧 Bước 1: Tạo & Cấu Hình Supabase Project

### 1.1 Tạo Project Mới

1. Đăng nhập vào [supabase.com](https://supabase.com)
2. Nhấp **"New Project"**
3. Điền thông tin:
   - **Project Name**: `airport-ops-master`
   - **Database Password**: Tạo password mạnh (lưu lại an toàn)
   - **Region**: Chọn region gần bạn nhất
4. Nhấp **"Create new project"** và chờ ~2 phút

### 1.2 Lấy Thông Tin Kết Nối

1. Vào **Project Settings** → **API**
2. Copy các giá trị sau vào file `.env.local`:
   ```env
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...
   ```

3. Vào **Project Settings** → **Database** → **Connection Pooling**:
   - Mode: `Transaction`
   - Lấy connection string cho PostgreSQL CLI

---

## 📦 Bước 2: Cấu Hình Project Locally

### 2.1 Clone Repository & Cài Dependencies

```bash
# Clone code
git clone <your-repo-url>
cd OPS-build

# Cài npm packages
npm install

# Tạo file .env.local
cp .env.example .env.local
# Hoặc tạo file mới và điền:
cat > .env.local << EOF
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
EOF
```

### 2.2 Kiểm Tra Kết Nối

```bash
# Chạy development server
npm run dev

# Truy cập http://localhost:5173
# Nếu không có lỗi trong console, kết nối OK
```

---

## 🗄️ Bước 3: Khởi Tạo Database Schema

### 3.1 Chuẩn Bị SQL Scripts

Tất cả migrations nằm trong folder `migrations/`. Cần chạy theo thứ tự từ 12 đến 21.

**Order chạy migrations:**
1. `12_create_analytics_config.sql`
2. `13_fix_analytics_config_rls.sql`
3. `14_add_upsert_helper_columns.sql`
4. `15_enable_rls_flight_schedule.sql`
5. `16_create_rbac_system.sql`
6. `17_fix_rbac_rls_policies.sql`
7. `18_fix_rbac_with_security_definer.sql`
8. `19_recreate_policies_clean.sql`
9. `20_fix_has_permission_rpc.sql`
10. `21_add_supervisor_assign_permissions.sql`

### 3.2 Chạy Migrations Qua Supabase Console

**Cách 1: Dùng Supabase SQL Editor (Dễ nhất)**

1. Vào Supabase Dashboard → **SQL Editor**
2. Mở file migration #12 từ folder `migrations/`
3. Copy toàn bộ nội dung SQL
4. Paste vào Supabase SQL Editor
5. Nhấp **"Run"**
6. Xem kết quả thành công (✓ green tick)
7. Lặp lại bước 2-6 cho các migration #13, #14, ... #21

**Lưu ý:** Chạy tuần tự từ 12 → 21, không bỏ qua

**Cách 2: Dùng PostgreSQL CLI (Cho những người quen terminal)**

```bash
# Lấy connection string từ Supabase
# (Project Settings → Database → Connection string)

# Kết nối đến database
psql "postgresql://postgres:PASSWORD@HOST:PORT/postgres?sslmode=require"

# Chạy tất cả migrations
for file in migrations/1{2..21}_*.sql; do
  echo "Running $file..."
  psql "postgresql://..." -f "$file"
done
```

### 3.3 Xác Minh Migrations Chạy Thành Công

1. Vào **Database** → **Tables** trong Supabase
2. Kiểm tra các bảng này tồn tại:
   - `flight_schedule` (chuyến bay)
   - `roles` (vai trò)
   - `permissions` (quyền hạn)
   - `role_permissions` (map roles → permissions)
   - `user_roles` (map users → roles)
   - `analytics_config` (cấu hình phân tích)
   - `audit_log` (ghi lại thay đổi)

---

## 👥 Bước 4: Thiết Lập RBAC (Role-Based Access Control)

### 4.1 Tạo Roles Mặc Định

Chạy SQL script sau trong Supabase SQL Editor:

```sql
-- Xóa roles cũ (nếu có)
DELETE FROM roles WHERE name IN ('admin', 'supervisor', 'dispatcher', 'analyst', 'viewer');

-- Tạo roles mới
INSERT INTO roles (name, description) VALUES
  ('admin', 'Administrator - Full access'),
  ('supervisor', 'Supervisor - View and manage operations'),
  ('dispatcher', 'Dispatcher - Schedule flights'),
  ('analyst', 'Analyst - View data and reports'),
  ('viewer', 'Viewer - Read-only access');

-- Xác minh
SELECT * FROM roles;
```

### 4.2 Tạo Permissions

```sql
-- Xóa permissions cũ (nếu có)
DELETE FROM permissions;

-- Tạo permissions
INSERT INTO permissions (action, resource, description) VALUES
  ('view', 'flights', 'View flight data'),
  ('edit', 'flights', 'Edit flight data'),
  ('delete', 'flights', 'Delete flights'),
  ('view', 'gates', 'View gate assignments'),
  ('edit', 'gates', 'Assign gates'),
  ('view', 'counters', 'View counter data'),
  ('edit', 'counters', 'Manage counters'),
  ('view', 'users', 'View user list'),
  ('edit', 'users', 'Manage users'),
  ('view', 'analytics', 'View analytics'),
  ('export', 'data', 'Export data');

-- Xác minh
SELECT * FROM permissions;
```

### 4.3 Map Roles → Permissions

```sql
-- Lấy IDs (có thể thay đổi dựa trên hệ thống của bạn)
-- Cách tìm: SELECT id, name FROM roles; SELECT id, action, resource FROM permissions;

-- Ví dụ mapping (thay thế role_id và permission_id bằng giá trị thực tế)
-- Admin: Có tất cả quyền
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin';

-- Supervisor: view flights, edit gates, view analytics
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'supervisor' AND p.action = 'view';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'supervisor' AND p.resource IN ('gates', 'analytics');

-- Dispatcher: view + edit flights
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'dispatcher' AND p.resource = 'flights';

-- Analyst: view analytics, export
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'analyst' AND p.action IN ('view', 'export');

-- Viewer: view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'viewer' AND p.action = 'view';

-- Xác minh
SELECT r.name, p.action, p.resource 
FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
JOIN permissions p ON rp.permission_id = p.id
ORDER BY r.name, p.resource;
```

---

## 👤 Bước 5: Tạo Người Dùng & Gán Roles

### 5.1 Tạo Người Dùng Trong Supabase Auth

1. Vào **Authentication** → **Users**
2. Nhấp **"Add user"**
3. Điền:
   - **Email**: `admin@airport.local` (hoặc email thực tế)
   - **Password**: Tạo password (hoặc tự động)
4. Nhấp **"Send invite"** hoặc **"Create user"**

**Tạo tối thiểu 2-3 người dùng có vai trò khác nhau**

### 5.2 Gán Roles Cho Người Dùng

Chạy SQL script sau (thay `USER_ID` bằng UUID thực tế từ auth.users):

```sql
-- Lấy user IDs
SELECT id, email FROM auth.users;

-- Gán roles (thay thế email addresses)
-- Admin
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM auth.users u, roles r
WHERE u.email = 'admin@airport.local' AND r.name = 'admin';

-- Supervisor
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM auth.users u, roles r
WHERE u.email = 'supervisor@airport.local' AND r.name = 'supervisor';

-- Dispatcher
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM auth.users u, roles r
WHERE u.email = 'dispatcher@airport.local' AND r.name = 'dispatcher';

-- Xác minh
SELECT u.email, r.name 
FROM user_roles ur
JOIN auth.users u ON ur.user_id = u.id
JOIN roles r ON ur.role_id = r.id;
```

---

## 🔒 Bước 6: Cấu Hình Row-Level Security (RLS)

### 6.1 Kích Hoạt RLS Trên Bảng flight_schedule

```sql
-- Kích hoạt RLS
ALTER TABLE flight_schedule ENABLE ROW LEVEL SECURITY;

-- Tạo policy mặc định: chỉ admin có quyền đầy đủ
CREATE POLICY "admin_full_access" ON flight_schedule
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  );

-- Supervisor + Dispatcher: có quyền read/write
CREATE POLICY "ops_team_access" ON flight_schedule
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
        AND r.name IN ('admin', 'supervisor', 'dispatcher')
    )
  );

-- Analyst + Viewer: chỉ read
CREATE POLICY "read_only_access" ON flight_schedule
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  )
  WITH CHECK (false);

-- Xác minh
SELECT * FROM pg_policies WHERE tablename = 'flight_schedule';
```

### 6.2 Kích Hoạt RLS Trên Các Bảng RBAC

```sql
-- Kích hoạt RLS trên roles, permissions, user_roles
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_config ENABLE ROW LEVEL SECURITY;

-- Tạo policies đơn giản: admin full access
CREATE POLICY "admin_manage_rbac" ON roles
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  );

-- Lặp lại cho permissions, user_roles, analytics_config...
CREATE POLICY "admin_manage_permissions" ON permissions
  USING (EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name = 'admin'));

CREATE POLICY "admin_manage_user_roles" ON user_roles
  USING (EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name = 'admin'));

CREATE POLICY "user_view_own_config" ON analytics_config
  USING (true);  -- Tất cả user có quyền xem config
```

---

## 🔧 Bước 7: Tạo RPC Functions (Các Hàm Helper)

### 7.1 Hàm Kiểm Tra Quyền

```sql
CREATE OR REPLACE FUNCTION check_user_permission(
  p_user_id UUID,
  p_action VARCHAR,
  p_resource VARCHAR
)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = p_user_id
      AND p.action = p_action
      AND p.resource = p_resource
  )
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id AND r.name = 'admin'
  );
$$;

-- Test hàm
SELECT check_user_permission(
  (SELECT id FROM auth.users LIMIT 1),
  'view',
  'flights'
);
```

### 7.2 Hàm Lấy Roles Của User

```sql
CREATE OR REPLACE FUNCTION get_user_roles(p_user_id UUID)
RETURNS TABLE(role_name VARCHAR, role_id UUID)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT r.name, r.id FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  WHERE ur.user_id = p_user_id;
$$;

-- Test
SELECT * FROM get_user_roles((SELECT id FROM auth.users LIMIT 1));
```

### 7.3 Hàm Ghi Audit Log

```sql
CREATE OR REPLACE FUNCTION log_audit(
  p_action VARCHAR,
  p_resource_type VARCHAR,
  p_resource_id VARCHAR,
  p_changes JSONB
)
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
AS $$
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, changes)
  VALUES (auth.uid(), p_action, p_resource_type, p_resource_id, p_changes)
  RETURNING id;
$$;
```

---

## 📊 Bước 8: Khởi Tạo Dữ Liệu Sample (Tuỳ Chọn)

```sql
-- Thêm dữ liệu sample flight_schedule
INSERT INTO flight_schedule (
  arr_flight, dep_flight, sta, std, arr_pax, dep_pax,
  from, to, al_code, ac_type, dep_gate, arr_stand, carousel
) VALUES
  ('EK101', 'EK102', '2026-02-03 08:00', '2026-02-03 10:00', 250, 250, 'DXB', 'BKK', 'EK', 'A380', 'A01', 'S01', '01'),
  ('SQ206', 'SQ207', '2026-02-03 09:30', '2026-02-03 11:45', 180, 180, 'SIN', 'BKK', 'SQ', 'A350', 'A02', 'S02', '02'),
  ('VN154', 'VN155', '2026-02-03 11:00', '2026-02-03 13:30', 280, 280, 'HAN', 'BKK', 'VN', 'A321', 'B01', 'S03', '03');

-- Xác minh
SELECT COUNT(*) FROM flight_schedule;
```

---

## ✅ Bước 9: Test Ứng Dụng

### 9.1 Chạy Development Server

```bash
npm run dev

# Truy cập http://localhost:5173
```

### 9.2 Test Đăng Nhập

1. Nhấp **"Login"** trên trang chủ
2. Nhập email & password của người dùng
3. Nếu thành công → redirect to `/home` hoặc `/dispatch`

### 9.3 Test Các Tính Năng

| Tính Năng | Cách Test |
|-----------|----------|
| **Dispatch** | Vào `/dispatch`, thấy Gantt chart |
| **Data Table** | Vào `/data-table`, thấy danh sách chuyến bay |
| **Import** | Vào `/data-sync`, upload Excel file |
| **Analytics** | Vào `/analytics`, thấy chart |
| **RBAC** | Đổi tài khoản khác role, kiểm tra quyền |

### 9.4 Debug Nếu Có Lỗi

```javascript
// Mở Browser Console (F12)
// Kiểm tra:
// 1. Network tab: Supabase requests có status 200?
// 2. Console tab: Có error gì không?
// 3. Application tab: localStorage có auth token?
```

---

## 🚢 Bước 10: Triển Khai Lên Production

### 10.1 Build Ứng Dụng

```bash
npm run build

# Output: dist/ folder
# File tạo: index.html, assets/index-*.js, ...
```

### 10.2 Deploy Lên Vercel (Dễ nhất)

**Cách 1: Dùng Vercel UI**
1. Vào [vercel.com](https://vercel.com)
2. Nhấp **"New Project"**
3. Connect GitHub repository
4. Project settings: `vercel.json` sẽ được apply tự động
5. Thêm environment variables:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...
   ```
6. Nhấp **"Deploy"**

**Cách 2: Deploy Local Với Vercel CLI**
```bash
# Cài Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# Thêm environment variables khi prompt
```

### 10.3 Deploy Lên Netlify

```bash
# Cài Netlify CLI
npm install -g netlify-cli

# Build
npm run build

# Deploy
netlify deploy --prod --dir=dist

# Hoặc dùng UI: https://app.netlify.com
```

### 10.4 Deploy Lên Server Riêng (Self-hosted)

```bash
# Build
npm run build

# Copy dist/ to server
scp -r dist/ user@server:/var/www/airport-ops/

# Setup nginx (ví dụ)
# - Root: /var/www/airport-ops/
# - Redirect 404 to index.html (cho React Router)
```

---

## 🔄 Bước 11: Cấu Hình Backup & Monitoring

### 11.1 Bật Backup Supabase

1. Vào **Project Settings** → **Backups**
2. Chọn **"Enable automated backups"**
3. Chọn frequency: Daily/Weekly

### 11.2 Monitor Application

```bash
# Kiểm tra logs
# Vercel: Vào Deployments → View logs
# Supabase: Vào Database → Logs

# Kiểm tra performance
# Vercel: Analytics tab
# Browser: DevTools → Lighthouse
```

---

## 📋 Checklist Triển Khai Hoàn Chỉnh

- [ ] Tạo Supabase project
- [ ] Copy `.env.local` với đúng credentials
- [ ] Chạy migrations #12-21 theo thứ tự
- [ ] Tạo roles: admin, supervisor, dispatcher, analyst, viewer
- [ ] Tạo permissions & map vào roles
- [ ] Tạo ít nhất 2-3 test users
- [ ] Gán roles cho test users
- [ ] Bật RLS trên tất cả bảng
- [ ] Tạo RPC functions
- [ ] Test đăng nhập với các roles khác nhau
- [ ] Test import/export dữ liệu
- [ ] Build & test production build locally (`npm run build` + `npm run preview`)
- [ ] Deploy lên Vercel/Netlify
- [ ] Cấu hình custom domain (tuỳ chọn)
- [ ] Bật backups tự động
- [ ] Gửi access info cho team

---

## 🛠️ Troubleshooting

### Lỗi: "Supabase connection failed"
**Nguyên nhân**: `.env.local` sai hoặc Supabase URL không đúng

**Giải pháp**:
```bash
# Kiểm tra .env.local
cat .env.local

# So sánh với giá trị từ Supabase Dashboard
# Copy lại đúng URL và Key
```

### Lỗi: "RLS policy violation"
**Nguyên nhân**: User không có quyền theo policy

**Giải pháp**:
```sql
-- Kiểm tra user_roles
SELECT * FROM user_roles WHERE user_id = 'user_uuid_here';

-- Kiểm tra role_permissions
SELECT * FROM role_permissions WHERE role_id = 'role_uuid_here';

-- Kiểm tra policies
SELECT * FROM pg_policies WHERE tablename = 'flight_schedule';
```

### Lỗi: "Column does not exist"
**Nguyên nhân**: Migration chưa chạy hoặc chạy sai thứ tự

**Giải pháp**:
```sql
-- Kiểm tra cấu trúc bảng
\d flight_schedule

-- Xem migrations đã chạy
-- Vercel: Check migrations table (nếu có)
-- Hoặc: Drop & re-run tất cả migrations
```

### Lỗi: "Unauthorized"
**Nguyên nhân**: JWT token hết hạn hoặc không valid

**Giải pháp**:
```bash
# Xóa localStorage & đăng nhập lại
# F12 → Application → Clear localStorage

# Hoặc check token:
# localStorage.getItem('supabase.auth.token')
```

---

## 📞 Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **React Docs**: https://react.dev
- **React Router**: https://reactrouter.com
- **Vite Docs**: https://vitejs.dev

---

## 🎯 Bước Tiếp Theo

1. **Đào tạo Team**: Hướng dẫn cách sử dụng ứng dụng
2. **Data Sync**: Import dữ liệu thực tế từ hệ thống cũ
3. **Customization**: Điều chỉnh analytics metrics theo yêu cầu
4. **Monitoring**: Setup alerts & logging
5. **Documentation**: Tạo internal wiki cho team

---

*Hướng dẫn cập nhật: 2026-02-03*
