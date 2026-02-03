# 📋 Cấu Trúc và Giới Thiệu Chi Tiết Ứng Dụng Airport OPS Master

## 🎯 Tổng Quan Ứng Dụng

**Airport OPS Master** là một ứng dụng web quản lý hoạt động sân bay toàn diện, được xây dựng bằng **React + TypeScript + Vite** và sử dụng **Supabase** làm backend. Ứng dụng hỗ trợ quản lý lịch bay, phân công cổng sân bay, quản lý check-in, phân tích dữ liệu, và hệ thống quản lý quyền RBAC.

**Phiên bản:** 1.0.0  
**Node.js yêu cầu:** ≥ 18.0.0  
**Framework chính:** React 18.2.0, TypeScript 5.2.2

---

## 📁 Cấu Trúc Thư Mục Chi Tiết

### 1. **Thư Mục Gốc (Root Level)**

```
📦 OPS-build
├── 📄 package.json          # Cấu hình npm, dependencies
├── 📄 tsconfig.json         # Cấu hình TypeScript
├── 📄 vite.config.ts        # Cấu hình Vite build tool
├── 📄 index.html            # HTML entry point
├── 📄 index.tsx             # React entry point
├── 📄 App.tsx               # Root component + routing
├── 📄 types.ts              # TypeScript interfaces & types
├── 📄 supabaseClient.ts     # Supabase client initialization
├── 📄 supabaseConfig.ts     # Supabase configuration
├── 📄 vercel.json           # Vercel deployment config
├── 📄 FEATURES_LOGIC.md     # Tài liệu logic tính năng chi tiết
├── 📄 MAINTENANCE_GUIDE.md  # Hướng dẫn bảo trì
└── 📄 APP_STRUCTURE.md      # File này
```

---

### 2. **📂 Components** - Các Component UI Chính

Chứa các component React tái sử dụng cho giao diện người dùng:

| Component | Mục Đích |
|-----------|---------|
| **AuthModal.tsx** | Modal xác thực đăng nhập/đăng ký |
| **ProtectedRoute.tsx** | Wrapper để bảo vệ các route cần xác thực |
| **FileUpload.tsx** | Component upload file Excel/CSV |
| **ImportProgressModal.tsx** | Hiển thị tiến độ import dữ liệu |
| **DateTimePickerModal.tsx** | Chọn ngày giờ cho time range filter |
| **TimeRangeSelector.tsx** | Chọn khoảng thời gian import |
| **ColumnSelector.tsx** | Chọn cột từ file upload để map vào DB |
| **ColumnToggle.tsx** | Bật/tắt hiển thị cột |
| **FlightTableFilter.tsx** | Lọc bảng chuyến bay |
| **RoleManagerModal.tsx** | Quản lý vai trò người dùng (RBAC) |
| **AnalyticsConfigModal.tsx** | Cấu hình thông số phân tích |
| **BeltAnalytics.tsx** | Phân tích băng chuyền (Carousel) |
| **GateAnalytics.tsx** | Phân tích sử dụng cổng sân bay |
| **StandAnalytics.tsx** | Phân tích sử dụng vị trí đỗ máy bay |
| **InfrastructureTab.tsx** | Tab hiển thị phân tích hạ tầng |

---

### 3. **📂 Pages** - Các Trang Chính Của Ứng Dụng

| Trang | Đường dẫn | Chức Năng |
|------|----------|---------|
| **Home.tsx** | `/home` | Trang chủ, đăng nhập, giới thiệu |
| **Dispatch.tsx** | `/dispatch` | Lập lịch biểu, phân công cổng (Gantt chart) - Phiên bản Supabase |
| **DispatchLocal.tsx** | `/dispatch-local` | Backup: Lập lịch biểu local (không Supabase) |
| **FlightDataTable.tsx** | `/data-table` | Bảng dữ liệu chi tiết tất cả chuyến bay |
| **DataSync.tsx** | `/data-sync` | Trang import/export dữ liệu |
| **Analytics.tsx** | `/analytics` | Phân tích dữ liệu (Supabase) - Cấu hình động |
| **AnalyticsLocal.tsx** | `/analytics-local` | Backup: Phân tích dữ liệu local |

---

### 4. **📂 Utils** - Hàm Tiện Ích

Chứa các service, utility functions cho xử lý logic:

| File | Chức Năng |
|------|---------|
| **flightDataService.ts** | Tìm nạp, xử lý dữ liệu chuyến bay từ DB |
| **importDataService.ts** | Xử lý import dữ liệu từ Excel: parse, validate, upsert |
| **exportService.ts** | Export dữ liệu ra Excel/CSV |
| **ganttExportService.ts** | Export Gantt chart ra PDF |
| **columnMappingService.ts** | Map cột từ file Excel vào database schema |
| **analyticsConfigService.ts** | Quản lý cấu hình phân tích động |
| **infraAnalyticsService.ts** | Tính toán chỉ số hạ tầng (gate, stand, belt) |
| **dateUtils.ts** | Hàm xử lý ngày giờ, time range |
| **permissionUtils.ts** | Kiểm tra quyền dựa trên RBAC |
| **securityUtils.ts** | Hàm bảo mật, sanitize input |
| **rbacTests.ts** | Test hệ thống RBAC |

---

### 5. **📂 Migrations** - SQL Migrations Cho Database

Chứa các script SQL khởi tạo và cập nhật cấu trúc database:

| Migration | Mục Đích |
|-----------|---------|
| **12_create_analytics_config.sql** | Tạo bảng analytics_config |
| **13_fix_analytics_config_rls.sql** | Cấu hình RLS (Row-Level Security) cho analytics_config |
| **14_add_upsert_helper_columns.sql** | Thêm helper columns cho upsert |
| **15_enable_rls_flight_schedule.sql** | Bật RLS cho flight_schedule |
| **16_create_rbac_system.sql** | Tạo hệ thống RBAC (roles, permissions, user_roles) |
| **17_fix_rbac_rls_policies.sql** | Sửa RLS policies cho RBAC |
| **18_fix_rbac_with_security_definer.sql** | Thêm security definer cho RPC functions |
| **19_recreate_policies_clean.sql** | Tái tạo policies từ đầu (clean) |
| **20_fix_has_permission_rpc.sql** | Sửa RPC function check_user_permission |
| **21_add_supervisor_assign_permissions.sql** | Thêm quyền supervisor assign permissions |

---

### 6. **📂 Supabase/Functions** - Server-Side Functions

```
supabase/functions/
└── sync-external-db/
    └── index.ts  # Hàm đồng bộ dữ liệu từ external database
```

---

### 7. **📂 Scripts** - Các Script Utility

| Script | Mục Đích |
|--------|---------|
| **clearAllCounters.js** | Xóa tất cả counter data |
| **migrateConfigToSupabase.js** | Migrate analytics config lên Supabase |

---

### 8. **📂 Public** - Tài Nguyên Static

```
public/
├── index.html          # HTML gốc
└── assets/             # Build output (JS, CSS)
    ├── index-*.js      # Main bundle
    ├── index.es-*.js   # ES module
    └── purify.es-*.js  # DOMPurify library
```

---

## 🏗️ Kiến Trúc Ứng Dụng

### 1. **Phân Lớp Kiến Trúc**

```
┌─────────────────────────────────────────────────────────┐
│              UI Layer (React Components)                 │
│  Pages (Home, Dispatch, Analytics) + Components (Modal) │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│          Business Logic Layer (Utils/Services)           │
│  flightDataService, importDataService, analyticsService  │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│        Data Access Layer (Supabase Client)              │
│      supabaseClient.ts + supabaseConfig.ts              │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│    Database Layer (PostgreSQL via Supabase)             │
│  Tables: flight_schedule, roles, permissions, user_roles │
└─────────────────────────────────────────────────────────┘
```

### 2. **Routing**

Ứng dụng sử dụng React Router v6 với Hash routing:

```
/               → Redirect to /home
/home           → Home page (public)
/dispatch       → Gantt chart dispatch (protected)
/dispatch-local → Local dispatch backup (protected)
/data-table     → Flight data table (protected)
/data-sync      → Import/Export page (protected)
/analytics      → Analytics dashboard (protected)
/analytics-local → Local analytics backup (protected)
```

---

## 🗄️ Cấu Trúc Database

### Bảng Chính

#### **flight_schedule**
Lưu trữ thông tin chi tiết tất cả chuyến bay:

```
Cột Chính:
- id (UUID)              : Khóa chính
- arr_flight (String)    : Số chuyến bay đến
- dep_flight (String)    : Số chuyến bay đi
- sta (Date)             : Scheduled Time of Arrival
- std (Date)             : Scheduled Time of Departure
- ata (Date)             : Actual Time of Arrival
- atd (Date)             : Actual Time of Departure
- arr_pax (Number)       : Hành khách đến
- dep_pax (Number)       : Hành khách đi
- from (String)          : Sân bay/Thành phố xuất phát
- to (String)            : Sân bay/Thành phố đến
- al_code (String)       : Mã hãng hàng không
- ac_type (String)       : Loại máy bay (A320, B787...)
- dep_gate (String)      : Cổng xuất phát
- arr_stand (String)     : Vị trí đỗ máy bay đến
- dep_stand (String)     : Vị trí đỗ máy bay đi
- carousel (String)      : Băng chuyền lấy hành lý
- counters (Array)       : Cầu check-in (01, 02, M01...)
- arr_sts (String)       : Trạng thái arrival
- dep_sts (String)       : Trạng thái departure
```

#### **roles**
Quản lý các vai trò trong hệ thống:

```
- id (UUID)              : Khóa chính
- name (String)          : Tên vai trò (admin, supervisor, dispatcher...)
- description (Text)     : Mô tả
- created_at (Timestamp) : Thời gian tạo
```

#### **permissions**
Quyền hạn có sẵn:

```
- id (UUID)              : Khóa chính
- action (String)        : view, edit, delete, assign_gate...
- resource (String)      : flights, gates, counters, users...
- description (Text)     : Mô tả
```

#### **role_permissions**
Mapping giữa roles và permissions:

```
- role_id → roles.id
- permission_id → permissions.id
```

#### **user_roles**
Gán vai trò cho người dùng:

```
- user_id → auth.users.id
- role_id → roles.id
```

#### **analytics_config**
Cấu hình phân tích động (có thể chỉnh sửa):

```
- id (UUID)
- name (String)          : Tên cấu hình
- metric_type (String)   : gate, stand, belt
- config (JSONB)         : Tham số cấu hình
```

#### **audit_log**
Ghi lại các thay đổi dữ liệu:

```
- id (UUID)
- user_id (UUID)         : Người thực hiện
- action (String)        : insert, update, delete
- resource_type (String) : Loại tài nguyên
- resource_id (String)   : ID tài nguyên
- changes (JSONB)        : Chi tiết thay đổi
```

---

## 🔐 Hệ Thống Bảo Mật (RBAC)

### Các Vai Trò Mặc Định

| Vai Trò | Quyền | Mô Tả |
|---------|-------|-------|
| **admin** | Tất cả | Quản trị viên - quyền toàn bộ |
| **supervisor** | Xem, chỉnh sửa, phân công cổng | Giám sát hoạt động |
| **dispatcher** | Xem, chỉnh sửa lịch bay | Lập lịch biểu |
| **analyst** | Xem dữ liệu, báo cáo | Phân tích dữ liệu |
| **viewer** | Chỉ xem | Người xem dữ liệu |

### Row-Level Security (RLS)

- Tất cả bảng flight_schedule có RLS enabled
- Policy: Người dùng chỉ xem dữ liệu theo quyền role của họ
- RPC function `check_user_permission()` để kiểm tra quyền

---

## 🚀 Tính Năng Chính

### 1. **Smart Upsert Import**
- Tự động phát hiện và cập nhật dữ liệu trùng
- Map tùy chỉnh cột từ Excel
- Hỗ trợ Time Range filter

### 2. **Dispatch (Gantt Chart)**
- Hiển thị lịch bay dưới dạng Gantt chart
- Phân công cổng sân bay (Gate Assignment)
- Phát hiện xung đột thời gian

### 3. **Analytics Dashboard**
- Phân tích sử dụng cổng (Gate Analytics)
- Phân tích sử dụng vị trí đỗ máy bay (Stand Analytics)
- Phân tích throughput băng chuyền (Belt Analytics)
- Cấu hình thông số động

### 4. **Quản Lý Người Dùng & Quyền**
- RBAC system với 5 vai trò
- Assign quyền chi tiết cho từng người dùng
- Audit log ghi lại tất cả thay đổi

### 5. **Import/Export Dữ Liệu**
- Upload Excel, CSV
- Export bảng ra Excel
- Export Gantt chart ra PDF

### 6. **Backup Local**
- Dispatch Local (không cần Supabase)
- Analytics Local (offline mode)

---

## 🔄 Luồng Dữ Liệu Chính

### Import Dữ Liệu

```
User Upload Excel
    ↓
Parse File (columnMappingService)
    ↓
Map cột vào Database Schema
    ↓
Apply Time Range Filter (nếu có)
    ↓
Smart Upsert:
  • Kiểm tra bản ghi tồn tại
  • UPDATE hoặc INSERT
    ↓
Import Progress Modal hiển thị
    ↓
Kết quả: X inserted, Y updated, Z failed
```

### Lấy & Hiển Thị Dữ Liệu

```
User truy cập trang (Dispatch, Analytics, Data Table)
    ↓
flightDataService fetch từ Supabase
    ↓
RLS Policy kiểm tra quyền
    ↓
Dữ liệu render trên UI
    ↓
User tương tác (filter, sort, export)
```

---

## 📊 Dependencies Chính

### Runtime
```
react: 18.2.0           // UI framework
react-dom: 18.2.0       // DOM rendering
react-router-dom: 6.22.0 // Routing
@supabase/supabase-js: 2.39.0 // Backend
chart.js: 4.4.1         // Chart library
recharts: 3.6.0         // React charts
xlsx: 0.18.5            // Excel reading/writing
html2canvas: 1.4.1      // Screenshot/PDF export
jspdf: 2.5.1            // PDF generation
lucide-react: 0.344.0   // Icons
```

### Development
```
typescript: 5.2.2       // Type checking
vite: 5.0.0             // Build tool
tailwindcss: 3.3.5      // CSS framework
@types/react: 18.2.37   // React types
```

---

## 💡 Convention & Best Practices

### 1. **Naming Convention**
- Components: PascalCase (e.g., `FlightDataTable.tsx`)
- Functions/Services: camelCase (e.g., `fetchFlightData()`)
- Constants: UPPER_SNAKE_CASE (e.g., `DEFAULT_PAGE_SIZE`)
- Types/Interfaces: PascalCase (e.g., `interface Flight`)

### 2. **Folder Organization**
- Components có tên khớp với file
- Services ở utils/ theo chức năng (data, import, analytics, permission)
- Pages ở pages/ và match route names

### 3. **Error Handling**
- Try-catch trong async functions
- Console.error với prefix `[Service Name]` để debug
- User-friendly error messages trong UI

### 4. **Security**
- RLS enabled trên tất cả bảng
- Input validation trước khi save DB
- Permission check với `permissionUtils.ts`
- Sanitize HTML output với DOMPurify

---

## 🔗 Liên Kết & Tài Liệu Thêm

- **FEATURES_LOGIC.md** - Chi tiết logic các tính năng
- **MAINTENANCE_GUIDE.md** - Hướng dẫn bảo trì & troubleshooting
- **DEPLOYMENT_GUIDE.md** - Hướng dẫn triển khai

---

## 📝 Ghi Chú Quan Trọng

1. **Supabase Config**: Cấu hình trong `.env.local` hoặc `supabaseConfig.ts`
2. **Time Zone**: Ứng dụng sử dụng UTC/ISO 8601 format
3. **Local Backup**: Dispatch Local & Analytics Local có thể hoạt động offline
4. **Database Migrations**: Chạy migrations theo thứ tự từ 12 đến 21
5. **RBAC Initialization**: Cần insert roles & permissions trước khi assign users

---

*Bản cập nhật cuối: 2026-02-03*
