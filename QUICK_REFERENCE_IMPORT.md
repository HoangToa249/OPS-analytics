# 🚀 Quick Reference Card - Import & Mapping

## 📋 Quy Trình Nhanh (5 Bước)

```
1️⃣ Upload File     2️⃣ Auto-Detect    3️⃣ Validate    4️⃣ Preview    5️⃣ Launch
   Excel        ✓ Map columns      ✓ Check data  ✓ Review rows   ✓ Upload
```

---

## 🎯 Cheat Sheet

### Required Fields (PHẢI có)
```
✓ flight (Flight Number)  - e.g., VN001, VN002
✓ std (STD)              - e.g., 2024-12-25 08:00
```

### Optional Fields (CÓ THỂ có)
```
- sta, atd, ata          (Time fields)
- acType, gate, counters (Aircraft/Facility)
- from, to               (Route)
- depPax, arrPax         (Passenger count)
- depSts, arrSts         (Status)
```

---

## 🔤 Column Names Auto-Detected

| Field | Auto-Detected Names |
|-------|-------------------|
| **flight** | flight, flight_no, flt, dep_flight, mã chuyến, số hiệu, ... |
| **std** | std, departure_time, cất cánh, ... |
| **sta** | sta, arrival_time, hạ cánh, ... |
| **acType** | ac_type, aircraft, loại máy, ... |
| **from** | from, origin, flight_from, từ, ... |
| **to** | to, destination, flight_to, đến, ... |

---

## 📊 Confidence Scores

| Score | Meaning | Action |
|-------|---------|--------|
| 🟢 90%+ | Perfect match | Use as is |
| 🔵 70-89% | Good match | Verify if needed |
| 🟡 50-69% | Possible match | Manually adjust |
| ⚪ <50% | Weak match | Skip or manual map |

---

## ❌ Common Issues & Fixes

### Issue: "❌ Required field is not mapped"
**Fix**: Select correct column from dropdown for "Flight Number" or "STD"

### Issue: "X rows have missing required fields"
**Fix**: These rows will be skipped. Check your Excel file has data in flight & std columns.

### Issue: "Date appears incorrect"
**Fix**: Enable "Excel Timezone Fix" checkbox in Configuration

### Issue: "Column name not in dropdown"
**Fix**: File not read correctly. Try:
- Save Excel as .xlsx (not .xls)
- Check first row has headers
- Reload page and try again

---

## 💾 File Requirements

| Requirement | Details |
|-----------|---------|
| **Format** | .xlsx, .xls |
| **Headers** | Row 1 (required) |
| **Data** | Rows 2+ |
| **Max Size** | No limit (chunked upload) |
| **Date Format** | Auto-detected |

---

## 🎨 UI Guide

### Step 1: Upload
```
┌─────────────────────────────┐
│  Select Excel File          │  ← Click to upload
│  Secure Local Processing    │
└─────────────────────────────┘
```

### Step 2: Map Columns
```
Flight Number    [Select Column ▼]  90% ✓
STD              [Select Column ▼]  95% ✓
STA              [Select Column ▼]  87% ✓
Aircraft Type    [Select Column ▼]  92% ✓
```

### Step 3: Validate
```
✓ Data Valid
  245 of 250 rows valid
  ⚠ 5 rows have missing required fields
```

### Step 4: Preview
```
[Show Preview]  ← Click to see sample data
```

### Step 5: Launch
```
[Launch Dashboard →]  ← Click to upload
```

---

## 🧪 Test Commands

```javascript
// Browser console
testColumnMapping.runAll()           // All tests
testColumnMapping.testCase1()        // English names
testColumnMapping.testCase2()        // Vietnamese names
testColumnMapping.testCase3()        // Mixed names
testColumnMapping.testCase4()        // Valid data
testColumnMapping.testCase5()        // Missing data
testColumnMapping.testCase6()        // Preview
testColumnMapping.testCase7()        // Statistics
testColumnMapping.testCase8()        // Schema
```

---

## 📈 Performance Tips

| Tip | Benefit |
|-----|---------|
| Use simple column names | Faster detection |
| Pre-clean data in Excel | Fewer invalid rows |
| Max 10k rows per upload | Faster processing |
| Use consistent date format | Better validation |

---

## 🔍 What Gets Validated

```
✓ Required fields mapped (flight, std)
✓ Each row has flight number
✓ Each row has STD time
✓ Data types match (date = date, number = number)
✓ No critical null values in required fields
```

---

## 📱 Mobile Support

- ✓ Desktop: Full featured
- ✓ Tablet: Responsive layout
- ⚠ Mobile: File upload limited (browser dependent)

---

## 🔐 Security

- ✓ Local processing only
- ✓ No data leaves browser until upload
- ✓ HTTPS encrypted upload
- ✓ Supabase auth required

---

## 📞 Quick Troubleshoot Tree

```
Issue Uploading?
│
├─ File won't open?
│  └─ → Save as .xlsx
│
├─ Columns not detected?
│  └─ → Check row 1 has headers
│
├─ Validation errors?
│  └─ → Use "Show Preview" to check data
│
└─ Upload failed?
   └─ → Check browser console (F12)
      → Try smaller file first
      → Refresh page and retry
```

---

## 🎓 Example Excel File

### ✓ Good Format
```
Mã Chuyến | Cất Cánh DT | Hạ Cánh DT | Loại Máy | Từ  | Đến
---------|-------------|-----------|---------|-----|-----
VN001    | 2024-12-25  | 2024-12-25 | A320    | HAN | SGN
VN002    | 2024-12-25  | 2024-12-25 | A321    | HAN | BKK
```

### ✗ Bad Format
```
VN001,2024-12-25,2024-12-25,A320,HAN,SGN  ← CSV not Excel
Mã chuyến: VN001; Cất cánh: 2024-12-25     ← Text not structured
[No headers]                                ← Missing row 1
```

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Move to next field |
| `Enter` | Select dropdown option |
| `Escape` | Close preview modal |

---

## 🌍 Multi-Language Support

| Language | Status |
|----------|--------|
| 🇬🇧 English | ✓ Supported |
| 🇻🇳 Vietnamese | ✓ Supported |
| 🇹🇭 Thai | Aliases available |
| 🇯🇵 Japanese | Aliases available |

---

## 📚 Full Documentation

For detailed information, see:
- **IMPORT_MAPPING_GUIDE.md** - Complete user guide
- **CHANGELOG_IMPORT_MAPPING.md** - Technical details
- **columnMappingService.ts** - Source code

---

**Last Updated**: December 25, 2025  
**Version**: 2.0
