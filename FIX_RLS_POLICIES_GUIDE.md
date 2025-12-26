# 🔧 FIX RLS Policies für Analytics Config

## ❌ Vấn Đề Phát Hiện

Khi kiểm tra RLS policies trên bảng `analytics_config`:

```
Authenticated users:
- SELECT: ✅ YES
- INSERT: ❌ NO (BLOCKED!)
- UPDATE: ❌ NO (BLOCKED!)
- DELETE: ❌ NO (BLOCKED!)
```

**Kết quả**: Config không thể được lưu vào Supabase vì INSERT/UPDATE bị chặn!

---

## 🔍 Root Cause

Policies **được định nghĩa** trong migration file nhưng **không hoạt động đúng**. 

Có thể do:
1. Migration chưa được run đầy đủ
2. RLS bị disable không đúng cách
3. Policies bị drop nhưng không tạo lại

---

## ✅ Cách Fix (4 Bước)

### **Bước 1: Vào Supabase SQL Editor**

1. Vào https://app.supabase.com
2. Chọn project
3. Click **SQL Editor**

### **Bước 2: Chạy Fix Script**

Copy-paste toàn bộ SQL này:

```sql
-- Fix RLS Policies for analytics_config table
-- This script fixes the issue where authenticated users cannot INSERT/UPDATE config

-- First, disable RLS to fix policies
ALTER TABLE analytics_config DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their own config" ON analytics_config;
DROP POLICY IF EXISTS "Users can insert their own config" ON analytics_config;
DROP POLICY IF EXISTS "Users can update their own config" ON analytics_config;
DROP POLICY IF EXISTS "Users can delete their own config" ON analytics_config;

-- Re-enable RLS
ALTER TABLE analytics_config ENABLE ROW LEVEL SECURITY;

-- CREATE POLICIES with proper permissions for authenticated users
-- POLICY 1: SELECT - Users can view their own config
CREATE POLICY "Users can view their own config" 
  ON analytics_config 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- POLICY 2: INSERT - Users can insert their own config
CREATE POLICY "Users can insert their own config" 
  ON analytics_config 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- POLICY 3: UPDATE - Users can update their own config
CREATE POLICY "Users can update their own config" 
  ON analytics_config 
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- POLICY 4: DELETE - Users can delete their own config
CREATE POLICY "Users can delete their own config" 
  ON analytics_config 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Verify policies were created
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'analytics_config'
ORDER BY policyname;
```

Click **Execute** 🟢

---

### **Bước 3: Verify Policies**

Chạy query verify:

```sql
-- Check RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'analytics_config';
-- Result: rowsecurity should be TRUE

-- Check all policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  qual
FROM pg_policies
WHERE tablename = 'analytics_config'
ORDER BY policyname;
```

**Expected Result**:
```
schemaname | tablename | policyname
----------|-----------|----------------------------------
public    | analytics_config | Users can view their own config
public    | analytics_config | Users can insert their own config
public    | analytics_config | Users can update their own config
public    | analytics_config | Users can delete their own config
```

---

### **Bước 4: Test in App**

1. **Close Analytics page** hoàn toàn
2. **Clear browser cache** (Ctrl+Shift+Delete)
3. **Reload Analytics page**
4. **Mở Console** (F12)
5. **Add 1 aircraft mới**

**Kiểm tra logs**:
```
✅ [Analytics] Config successfully saved to Supabase!
✅ [Config] Config updated in Supabase
```

---

## 🧪 Full Verification Query

Nếu muốn xem **toàn bộ RLS setup**:

```sql
-- 1. Check table RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('analytics_config', 'flight_schedule')
ORDER BY tablename;

-- 2. Check all policies on analytics_config
SELECT 
  schemaname,
  tablename, 
  policyname, 
  cmd, 
  permissive, 
  roles, 
  qual, 
  with_check
FROM pg_policies
WHERE tablename = 'analytics_config'
ORDER BY policyname;

-- 3. Check authenticated user can do what
SELECT 
  privilege_type,
  COUNT(*) as count
FROM information_schema.role_table_grants
WHERE table_name = 'analytics_config' 
  AND grantee = 'authenticated'
GROUP BY privilege_type
ORDER BY privilege_type;
```

---

## 🚨 Troubleshooting

### **Nếu vẫn BLOCKED sau fix**:

Check xem RLS bị disable chưa:

```sql
-- Force disable + re-enable
ALTER TABLE analytics_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_config ENABLE ROW LEVEL SECURITY;

-- Drop all policies
DROP POLICY IF EXISTS "Users can view their own config" ON analytics_config;
DROP POLICY IF EXISTS "Users can insert their own config" ON analytics_config;
DROP POLICY IF EXISTS "Users can update their own config" ON analytics_config;
DROP POLICY IF EXISTS "Users can delete their own config" ON analytics_config;

-- Check status
SELECT 
  tablename, 
  rowsecurity,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'analytics_config') as policy_count
FROM pg_tables
WHERE tablename = 'analytics_config';
```

### **Nếu trigger bị issue**:

```sql
-- Check if trigger exists
SELECT tgname, tgisinternal, tgenabled
FROM pg_trigger
WHERE tgrelid = 'analytics_config'::regclass;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS analytics_config_timestamp_trigger ON analytics_config;

CREATE OR REPLACE FUNCTION update_analytics_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER analytics_config_timestamp_trigger
  BEFORE UPDATE ON analytics_config
  FOR EACH ROW
  EXECUTE FUNCTION update_analytics_config_timestamp();
```

---

## ✅ After Fix Checklist

- [ ] RLS is ENABLED
- [ ] 4 Policies created (SELECT, INSERT, UPDATE, DELETE)
- [ ] Test add aircraft in Analytics Config → success
- [ ] Console shows "✅ Config successfully saved to Supabase!"
- [ ] Refresh page → aircraft config vẫn còn
- [ ] Test update aircraft → sync to Supabase

---

## 📋 Summary

| Before | After |
|--------|-------|
| ❌ INSERT blocked | ✅ INSERT allowed |
| ❌ UPDATE blocked | ✅ UPDATE allowed |
| ✅ SELECT allowed | ✅ SELECT allowed |
| ❌ Config không save | ✅ Config auto-save |

Sau fix → Config sẽ được lưu vào Supabase database! 🎉
