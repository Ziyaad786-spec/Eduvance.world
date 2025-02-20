/*
  # Add user_id to report_cards table

  1. Changes
    - Adds user_id column to report_cards table
    - Links user_id to auth.users table
    - Updates RLS policies to use user_id

  2. Security
    - Maintains RLS policies for proper access control
    - Ensures users can only access their own report cards
*/

-- Add user_id column to report_cards table
ALTER TABLE report_cards 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Update RLS policies for report_cards
DROP POLICY IF EXISTS "Users can view and manage report cards for their students" ON report_cards;

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