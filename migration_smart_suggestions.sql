-- Create table for smart category suggestions
CREATE TABLE IF NOT EXISTS category_suggestions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    description_pattern TEXT NOT NULL,
    parent_category TEXT NOT NULL,
    subcategory TEXT,
    use_count INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, description_pattern)
);

-- Enable Row Level Security
ALTER TABLE category_suggestions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to manage their own suggestions
-- Note: Check if policy exists before creating to avoid errors in repeated runs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'category_suggestions'
        AND policyname = 'Users can manage own suggestions'
    ) THEN
        CREATE POLICY "Users can manage own suggestions" ON category_suggestions
            FOR ALL USING (auth.uid() = user_id);
    END IF;
END
$$;
