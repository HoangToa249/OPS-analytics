# 🔧 Check-in Gantt Fix - Counter Format Handling

**Date**: February 9, 2026  
**Issue**: Checkin Gantt không hiển thị được chuyến bay khi dữ liệu `counters` được import từ bên ngoài

---

## 📋 Vấn Đề

Khi cập nhật dữ liệu từ bên ngoài vào database, cột `counters` có 2 định dạng khác nhau:

### ❌ Format Bên Ngoài (External)
```
"C31,C32,C33,C34,C35"
```
- Đơn giản: chuỗi comma-separated
- Không có thông tin thời gian (`start`, `end`)

### ✅ Format Ứng Dụng (App Internal)
```json
[
  {
    "ctr": "01",
    "start": "2026-01-17T06:00:00.000Z",
    "end": "2026-01-17T08:10:00.000Z"
  },
  {
    "ctr": "02",
    "start": "2026-01-17T06:00:00.000Z",
    "end": "2026-01-17T08:10:00.000Z"
  }
]
```

### 🔴 Kết Quả Bug
- Hàm `normalizeCounters` không sử dụng `targetDate` để tạo `start`/`end`
- Khi gặp format bên ngoài, nó trả về mảng chuỗi đơn: `["C31", "C32", ...]`
- Loại vòng lặp `rawCounters.forEach()` không xử lý được vì `c` không có `start`/`end`
- → `parsedCheckin` trở thành array rỗng
- → **Gantt view không có dữ liệu để hiển thị** ❌

---

## ✅ Cách Fix

### Bước 1: Cập nhật hàm `normalizeCounters`
**File**: `pages/Dispatch.tsx` (dòng ~280)

```typescript
const normalizeCounters = (raw: any, targetDate: Date): any[] => {
  // ... existing code ...
  
  // FIX: Khi gặp comma-separated string, tạo object với start/end
  } else {
    // Accept comma-separated values like "C31, C32, C33"
    const parts = s.split(',').map(x => x.trim()).filter(x => x.length > 0);
    if (parts.length > 0) {
      const defStart = new Date(targetDate.getTime() - 180 * 60000); // 3 hours before
      const defEnd = new Date(targetDate.getTime() - 50 * 60000);   // 50 min before
      return parts.map(ctr => ({
        ctr: ctr.trim().toUpperCase(),
        start: defStart.toISOString(),
        end: defEnd.toISOString()
      }));
    }
    // ...
  }
};
```

### Bước 2: Truyền `targetDate` vào hàm call
**File**: `pages/Dispatch.tsx` (dòng ~362)

```typescript
// Trước:
const rawCounters = normalizeCounters(row.counters);

// Sau:
const rawCounters = normalizeCounters(row.counters, targetDate);
```

---

## 🧪 Test Cases

### Test 1: Comma-Separated Format
```
Input: row.counters = "C31,C32,C33,C34,C35"
       targetDate = 2026-01-17T08:00:00Z

Output: [
  { ctr: "C31", start: "2026-01-17T05:00:00.000Z", end: "2026-01-17T07:10:00.000Z" },
  { ctr: "C32", start: "2026-01-17T05:00:00.000Z", end: "2026-01-17T07:10:00.000Z" },
  ...
]

Expected: ✅ parsedCheckin.length = 5
```

### Test 2: JSON Format (Already working)
```
Input: row.counters = [
  { "ctr": "01", "start": "2026-01-17T06:00:00.000Z", "end": "2026-01-17T08:10:00.000Z" },
  { "ctr": "02", "start": "2026-01-17T06:00:00.000Z", "end": "2026-01-17T08:10:00.000Z" }
]

Expected: ✅ parsedCheckin.length = 2
```

### Test 3: JSON String Format (Already working)
```
Input: row.counters = '[{"ctr":"01","start":"2026-01-17T06:00:00.000Z","end":"2026-01-17T08:10:00.000Z"}]'

Expected: ✅ parsedCheckin.length = 1
```

---

## 🎯 Impact

| Trước | Sau |
|-------|-----|
| ❌ Gantt Checkin rỗng khi import dữ liệu ngoài | ✅ Hiển thị chuyên bay với counters |
| ❌ Chỉ hỗ trợ JSON format | ✅ Hỗ trợ 3 format (JSON, JSON string, CSV) |
| ❌ Người dùng phải chỉnh sửa dữ liệu thủ công | ✅ Tự động mapping với default time window |

---

## 📝 Thay Đổi Chi Tiết

- **Function Modified**: `normalizeCounters` trong `mapDbToFlight`
- **Parameters Added**: `targetDate: Date`
- **Lines Changed**: ~30 lines
- **Backward Compatible**: ✅ Yes (existing JSON format still works)

---

## 🚀 Deployment

- [ ] Test với dữ liệu real từ external system
- [ ] Verify Gantt render đúng cho all 3 counter formats
- [ ] Check console log cho "[normalizeCounters] Validadas X entradas"
- [ ] Deploy to production

---

**Fix Date**: Feb 9, 2026  
**Status**: ✅ Ready for Testing
