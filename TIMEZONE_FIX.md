# 🕐 Timezone Bug Fix - Flight Data Display

## ❌ Problema: Dados Hiện Thị -7 Hours

Khi lọc dữ liệu chuyến bay từ database, thời gian được hiển thị sai -7 hours (hoặc khác tùy timezone của browser).

### Nguyên Nhân Root Cause

```
Database (Supabase):
Lưu trữ: 2025-01-08 10:00 (naive datetime, không có timezone mark)

Supabase trả về:
"2025-01-08T10:00:00" (chuỗi ISO, nhưng KHÔNG có Z suffix)

JavaScript Browser (UTC-7):
- new Date("2025-01-08T10:00:00")
- Interpret as UTC → 10:00 UTC
- Display in browser timezone (UTC-7) → 10:00 - 7 = 03:00 ❌
```

### Ví Dụ Chi Tiết

```
✈️ Chuyến VN100
DB: std = "2025-01-08 10:00:00" (lưu giờ địa phương)

❌ SAI (Trước fix):
1. Supabase return: "2025-01-08T10:00:00"
2. new Date("2025-01-08T10:00:00") → JavaScript interpret as UTC
3. Browser (UTC-7): 10:00 UTC → 03:00 (displayed)
✗ User thấy: 03:00 (SAI!)

✅ ĐÚNG (Sau fix):
1. Supabase return: "2025-01-08T10:00:00"
2. parseDbDate("2025-01-08T10:00:00")
   - Detect: No Z, không có timezone
   - Add Z → "2025-01-08T10:00:00Z" (explicitly mark as UTC)
3. new Date("2025-01-08T10:00:00Z") → 10:00 UTC (correct)
4. Display with fmtTimeUTC() → 10:00 (ĐÚNG!)
✓ User thấy: 10:00 (ĐÚNG!)
```

---

## ✅ Cách Fix

### 1️⃣ Thêm Hàm `parseDbDate()` - [dateUtils.ts](utils/dateUtils.ts#L60)

```typescript
/**
 * Parse database date string - treats naive timestamps as UTC
 */
export const parseDbDate = (dateString: string | null | undefined): Date | null => {
  if (!dateString) return null;
  
  try {
    const str = String(dateString).trim();
    
    // If it ends with Z, it's already UTC-marked - return as-is
    if (str.endsWith('Z')) {
      const dt = new Date(str);
      return !isNaN(dt.getTime()) ? dt : null;
    }
    
    // If ISO format without Z or timezone offset, add Z to force UTC
    if (str.includes('T') && !str.includes('+') && !str.includes('-', 10)) {
      const dt = new Date(str + 'Z');
      return !isNaN(dt.getTime()) ? dt : null;
    }
    
    const dt = new Date(str);
    return !isNaN(dt.getTime()) ? dt : null;
  } catch (e) {
    console.warn('DB date parse error:', dateString);
    return null;
  }
};
```

**Cách hoạt động:**
- Detect ISO string không có Z suffix (naive datetime)
- **Thêm Z suffix** → Bắt buộc JavaScript parse as UTC
- Khi display, sử dụng `getUTC*()` functions (fmtTimeUTC) → hiển thị đúng

### 2️⃣ Thực Hiện `fixTz` Parameter - [dateUtils.ts](utils/dateUtils.ts#L1-L53)

Để `parseExcelDate()` **thực sự sử dụng** tham số `fixTz`:

```typescript
// Apply timezone fix if enabled (add timezone offset to compensate)
if (fixTz && dt && !isNaN(dt.getTime())) {
  const offsetMs = getTimezoneOffsetMs();
  dt = new Date(dt.getTime() + offsetMs);
}
```

**Lợi ích:** Nếu người dùng enable "Excel Timezone Fix" khi import, thời gian sẽ được điều chỉnh.

### 3️⃣ Update FlightDataTable - [FlightDataTable.tsx](pages/FlightDataTable.tsx#L125)

```typescript
// Trước (SAI):
const date = new Date(stringValue);

// Sau (ĐÚNG):
const date = parseDbDate(stringValue);
```

### 4️⃣ Update Flight Data Service - [flightDataService.ts](utils/flightDataService.ts#L188)

```typescript
// Trước (SAI):
const rowDate = new Date(dateStr);

// Sau (ĐÚNG):
const rowDate = parseDbDate(dateStr);
```

---

## 📊 Áp Dụng Ở Đâu

| File | Hàm | Lý Do |
|------|-----|------|
| [dateUtils.ts](utils/dateUtils.ts) | `parseDbDate()` | Parse dates từ Supabase correctly |
| [dateUtils.ts](utils/dateUtils.ts) | `parseExcelDate()` | **Thực sử dụng** `fixTz` parameter |
| [FlightDataTable.tsx](pages/FlightDataTable.tsx) | `formatCellValue()` | Display DB dates với timezone awareness |
| [flightDataService.ts](utils/flightDataService.ts) | Fallback filter | Parse dates khi filtering |

---

## 🧪 Test Cases

### Test 1: Database Date Display
```
Input DB: "2025-01-08T10:00:00" (no Z)
Browser: UTC-7
BEFORE: Shows 03:00 ❌
AFTER: Shows 10:00 ✅
```

### Test 2: Time Range Filter
```
Filter: From 2025-01-08 09:00, To 2025-01-08 11:00
Flight: std="2025-01-08T10:00:00"

BEFORE: Might skip (wrong timezone calc) ❌
AFTER: Correctly includes flight ✅
```

### Test 3: Excel Import with fixTz
```
Excel: "08/01/2025 10:00"
fixTz: true (enabled)
Browser: UTC-7
AFTER: Apply +7h offset → Stored correctly in DB ✅
```

---

## 🎯 Summary

| Vấn Đề | Nguyên Nhân | Giải Pháp |
|--------|-----------|----------|
| Times hiển thị -7 hours | Naive timestamps treated as client TZ | Add Z suffix → Force UTC |
| fixTz parameter không work | Không implement logic | Add offset calculation |
| Filter sai timezone | Using browser timezone | Use parseDbDate() everywhere |

**Result:** 🎉 Tất cả thời gian hiện tại sẽ đúng timezone!

---

**Cập nhật:** 8/2/2026  
**Status:** ✅ COMPLETE - All timezone parsing fixed
