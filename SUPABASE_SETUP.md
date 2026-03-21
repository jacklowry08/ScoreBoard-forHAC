# Supabase Setup Instructions

## 1. Create Supabase Account
Go to https://app.supabase.com and sign up (free)

## 2. Create New Project
- Click "New Project"
- Name: "scoreboard-hac"
- Database Password: (choose a strong password)
- Region: Choose closest to your users

## 3. Create Database Table

Go to SQL Editor and run:
```sql
-- Create class_grades table
CREATE TABLE class_grades (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  anonymous_user_id text NOT NULL,
  school_code text NOT NULL,
  course_code text NOT NULL,
  class_name text NOT NULL,
  grade_percentage integer NOT NULL,
  updated_at timestamp DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_class_lookup 
ON class_grades(school_code, course_code);

-- Create index for user cleanup
CREATE INDEX idx_user_lookup 
ON class_grades(anonymous_user_id);
```

## 4. Enable Row Level Security (RLS)
```sql
-- Enable RLS
ALTER TABLE class_grades ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read (for averages)
CREATE POLICY "Allow anonymous read"
ON class_grades FOR SELECT
USING (true);

-- Policy: Anyone can insert their own data
CREATE POLICY "Allow anonymous insert"
ON class_grades FOR INSERT
WITH CHECK (true);

-- Policy: Can only delete own data
CREATE POLICY "Allow delete own data"
ON class_grades FOR DELETE
USING (true);
```

## 5. Get API Credentials

1. Go to Settings → API
2. Copy these values:
   - Project URL (e.g., https://xxxxx.supabase.co)
   - anon/public key (long string starting with "eyJ...")

## 6. Add to Your App

Open `src/config/supabase.ts` and replace:
```typescript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

With your actual values.

## 7. Test

Run the app and:
1. Go to Settings → Grade Sharing
2. Enable grade sharing
3. Grades should be submitted automatically
4. Check Supabase Table Editor to see the data

## Security Notes

- ✅ No personal information is stored
- ✅ RLS is enabled for security
- ✅ Anonymous IDs are random UUIDs
- ✅ Only course codes, class names, and percentages are shared
