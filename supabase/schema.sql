-- Payout Calculator Database Schema
-- Run this in your Supabase SQL Editor

-- User profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projection settings
CREATE TABLE IF NOT EXISTS projections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  name TEXT DEFAULT 'My Projection',
  start_date DATE NOT NULL,
  payout_frequency_days INTEGER DEFAULT 14,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generated payout dates
CREATE TABLE IF NOT EXISTS payout_dates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  projection_id UUID REFERENCES projections(id) ON DELETE CASCADE,
  month_number INTEGER NOT NULL,
  payout_number INTEGER NOT NULL,
  payout_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Global income items (with effectivity date)
CREATE TABLE IF NOT EXISTS income_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  projection_id UUID REFERENCES projections(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  effective_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Global expense items (with effectivity date)
CREATE TABLE IF NOT EXISTS expense_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  projection_id UUID REFERENCES projections(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  effective_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-payout income items (overrides or custom items)
CREATE TABLE IF NOT EXISTS payout_income_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payout_date_id UUID REFERENCES payout_dates(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  is_custom BOOLEAN DEFAULT false,
  is_removed BOOLEAN DEFAULT false
);

-- Per-payout expense items (overrides or custom items)
CREATE TABLE IF NOT EXISTS payout_expense_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payout_date_id UUID REFERENCES payout_dates(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  is_custom BOOLEAN DEFAULT false,
  is_removed BOOLEAN DEFAULT false
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_income_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_expense_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users manage own projections" ON projections FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own payout_dates" ON payout_dates FOR ALL USING (
  EXISTS (SELECT 1 FROM projections WHERE projections.id = payout_dates.projection_id AND projections.user_id = auth.uid())
);

CREATE POLICY "Users manage own income_items" ON income_items FOR ALL USING (
  EXISTS (SELECT 1 FROM projections WHERE projections.id = income_items.projection_id AND projections.user_id = auth.uid())
);

CREATE POLICY "Users manage own expense_items" ON expense_items FOR ALL USING (
  EXISTS (SELECT 1 FROM projections WHERE projections.id = expense_items.projection_id AND projections.user_id = auth.uid())
);

CREATE POLICY "Users manage own payout_income_items" ON payout_income_items FOR ALL USING (
  EXISTS (
    SELECT 1 FROM payout_dates 
    JOIN projections ON payout_dates.projection_id = projections.id 
    WHERE payout_dates.id = payout_income_items.payout_date_id 
    AND projections.user_id = auth.uid()
  )
);

CREATE POLICY "Users manage own payout_expense_items" ON payout_expense_items FOR ALL USING (
  EXISTS (
    SELECT 1 FROM payout_dates 
    JOIN projections ON payout_dates.projection_id = projections.id 
    WHERE payout_dates.id = payout_expense_items.payout_date_id 
    AND projections.user_id = auth.uid()
  )
);

-- Enable Realtime for payout tables
ALTER PUBLICATION supabase_realtime ADD TABLE payout_dates;
ALTER PUBLICATION supabase_realtime ADD TABLE payout_income_items;
ALTER PUBLICATION supabase_realtime ADD TABLE payout_expense_items;

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
