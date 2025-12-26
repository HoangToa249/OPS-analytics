-- Create analytics_config table to store user configurations
CREATE TABLE IF NOT EXISTS analytics_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Configuration data stored as JSONB
  aircraftConfig JSONB DEFAULT '{}'::jsonb,
  airlineConfig JSONB DEFAULT '{}'::jsonb,
  airportConfig JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one config per user
  UNIQUE(user_id)
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_analytics_config_user_id ON analytics_config(user_id);

-- Enable RLS (Row Level Security)
ALTER TABLE analytics_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own config" ON analytics_config;
DROP POLICY IF EXISTS "Users can insert their own config" ON analytics_config;
DROP POLICY IF EXISTS "Users can update their own config" ON analytics_config;
DROP POLICY IF EXISTS "Users can delete their own config" ON analytics_config;

-- Create RLS Policies for authenticated users
CREATE POLICY "Users can view their own config" 
  ON analytics_config 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own config" 
  ON analytics_config 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own config" 
  ON analytics_config 
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own config" 
  ON analytics_config 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_analytics_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS analytics_config_timestamp_trigger ON analytics_config;

-- Create trigger for auto-update timestamp
CREATE TRIGGER analytics_config_timestamp_trigger
  BEFORE UPDATE ON analytics_config
  FOR EACH ROW
  EXECUTE FUNCTION update_analytics_config_timestamp();

-- Insert default configurations for reference (these will be used if user hasn't customized)
-- This is just sample data, users can override in UI
INSERT INTO analytics_config (
  user_id,
  aircraftConfig,
  airlineConfig,
  airportConfig
) VALUES (
  '00000000-0000-0000-0000-000000000000',  -- System/Default user ID
  '{
    "321": {"name": "A321", "seats": 230},
    "320": {"name": "A320", "seats": 180},
    "319": {"name": "A319", "seats": 144},
    "32N": {"name": "A320neo", "seats": 180},
    "32Q": {"name": "A321neo", "seats": 230},
    "32R": {"name": "A321XLR", "seats": 244},
    "738": {"name": "B737-800", "seats": 189},
    "739": {"name": "B737-900", "seats": 189},
    "7M8": {"name": "B737 MAX8", "seats": 210},
    "7M9": {"name": "B737 MAX9", "seats": 220},
    "789": {"name": "B787-9", "seats": 296},
    "788": {"name": "B787-8", "seats": 242},
    "777": {"name": "B777-300", "seats": 350},
    "77W": {"name": "B777-300ER", "seats": 350},
    "333": {"name": "A330-300", "seats": 295},
    "380": {"name": "A380-800", "seats": 555},
    "747": {"name": "B747-400", "seats": 416},
    "AT7": {"name": "ATR72-600", "seats": 70},
    "E90": {"name": "Embraer E90", "seats": 120}
  }',
  '{
    "VN": "Vietnam Airlines",
    "VJ": "Vietjet Air",
    "QH": "Bamboo Airways",
    "VU": "Vietravel Airlines",
    "EK": "Emirates",
    "KE": "Korean Air",
    "SQ": "Singapore Airlines",
    "BR": "Eva Air",
    "CI": "China Airlines",
    "VZ": "Thai Vietjet"
  }',
  '{
    "HAN": "Nội Bài",
    "SGN": "Tân Sơn Nhất",
    "DAD": "Đà Nẵng",
    "CXR": "Cam Ranh",
    "PQC": "Phú Quốc",
    "ICN": "Seoul",
    "PUS": "Busan",
    "BKK": "Bangkok",
    "SIN": "Singapore",
    "TPE": "Taipei",
    "HKG": "Hong Kong",
    "NRT": "Narita"
  }'
) ON CONFLICT (user_id) DO NOTHING;
