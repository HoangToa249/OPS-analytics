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
