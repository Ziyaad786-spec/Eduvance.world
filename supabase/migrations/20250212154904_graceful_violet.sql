/*
  # Fix report cards functionality

  1. Changes
    - Add user_id column to report_cards table
    - Update RLS policies for report_cards
    - Update report_card_subjects policy
    - Add function to generate PDF URL
*/

-- Add user_id column to report_cards table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'report_cards' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE report_cards 
    ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Update existing report cards to set user_id from student's user_id
UPDATE report_cards rc
SET user_id = s.user_id
FROM students s
WHERE rc.student_id = s.id
AND rc.user_id IS NULL;

-- Make user_id not null after updating existing records
ALTER TABLE report_cards 
ALTER COLUMN user_id SET NOT NULL;

-- Update RLS policies for report_cards
DROP POLICY IF EXISTS "Users can view and manage report cards for their students" ON report_cards;
DROP POLICY IF EXISTS "Users can view and manage report cards" ON report_cards;

CREATE POLICY "Users can view and manage report cards"
  ON report_cards FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Update report_card_subjects policy to use report_cards user_id
DROP POLICY IF EXISTS "Users can view and manage report card subjects" ON report_card_subjects;

CREATE POLICY "Users can view and manage report card subjects"
  ON report_card_subjects FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM report_cards
      WHERE report_cards.id = report_card_subjects.report_card_id
      AND report_cards.user_id = auth.uid()
    )
  );

-- Function to generate PDF URL for report cards
CREATE OR REPLACE FUNCTION generate_report_card_pdf_url(report_card_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url text;
BEGIN
  -- This is a placeholder function that would typically generate a PDF
  -- and return its URL. For now, it just returns a dummy URL
  v_url := 'https://storage.example.com/report-cards/' || report_card_id || '.pdf';
  
  -- Update the report card with the generated URL
  UPDATE report_cards
  SET generated_pdf = v_url,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = report_card_id
  AND user_id = auth.uid();
  
  RETURN v_url;
END;
$$;