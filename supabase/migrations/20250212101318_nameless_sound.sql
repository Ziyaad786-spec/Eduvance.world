/*
  # Add Credit Notes Schema

  1. New Tables
    - `credit_notes`
      - `id` (uuid, primary key)
      - `number` (text, unique)
      - `invoice_id` (uuid, references invoices)
      - `client_id` (uuid, references clients)
      - `date` (date)
      - `reason` (text)
      - `subtotal` (numeric)
      - `tax_rate` (numeric)
      - `tax_amount` (numeric)
      - `total` (numeric)
      - `status` (text: draft/issued)
      - `currency_code` (text)
      - `user_id` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `credit_note_items`
      - `id` (uuid, primary key)
      - `credit_note_id` (uuid, references credit_notes)
      - `description` (text)
      - `quantity` (numeric)
      - `rate` (numeric)
      - `amount` (numeric)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users

  3. Functions
    - Add function to generate credit note numbers
*/

-- Create credit notes table
CREATE TABLE IF NOT EXISTS credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  invoice_id uuid REFERENCES invoices(id),
  client_id uuid REFERENCES clients(id) NOT NULL,
  date date NOT NULL,
  reason text NOT NULL,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  currency_code text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT status_check CHECK (status IN ('draft', 'issued'))
);

-- Create credit note items table
CREATE TABLE IF NOT EXISTS credit_note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id uuid REFERENCES credit_notes(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL,
  rate numeric NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_note_items ENABLE ROW LEVEL SECURITY;

-- Create policies for credit notes
CREATE POLICY "Users can create their own credit notes"
  ON credit_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own credit notes"
  ON credit_notes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own credit notes"
  ON credit_notes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own credit notes"
  ON credit_notes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for credit note items
CREATE POLICY "Users can manage credit note items for their credit notes"
  ON credit_note_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM credit_notes
      WHERE credit_notes.id = credit_note_items.credit_note_id
      AND credit_notes.user_id = auth.uid()
    )
  );

-- Create function to update credit note totals
CREATE OR REPLACE FUNCTION update_credit_note_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the credit note totals
  UPDATE credit_notes
  SET 
    subtotal = (
      SELECT COALESCE(SUM(amount), 0)
      FROM credit_note_items
      WHERE credit_note_id = NEW.credit_note_id
    ),
    updated_at = now()
  WHERE id = NEW.credit_note_id;
  
  -- Recalculate tax and total
  UPDATE credit_notes
  SET 
    tax_amount = subtotal * (tax_rate / 100),
    total = subtotal + (subtotal * (tax_rate / 100))
  WHERE id = NEW.credit_note_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update totals when items change
CREATE TRIGGER update_credit_note_totals_trigger
AFTER INSERT OR UPDATE OR DELETE ON credit_note_items
FOR EACH ROW
EXECUTE FUNCTION update_credit_note_totals();

-- Create function to generate credit note numbers
CREATE OR REPLACE FUNCTION generate_credit_note_number()
RETURNS text AS $$
DECLARE
  year text;
  next_number integer;
  credit_note_number text;
BEGIN
  year := to_char(current_date, 'YYYY');
  
  SELECT COALESCE(
    (SELECT MAX(CAST(SUBSTRING(number FROM 'CN-\d{4}-(\d+)') AS integer))
     FROM credit_notes
     WHERE number LIKE 'CN-' || year || '-%'
    ), 0) + 1
  INTO next_number;
  
  credit_note_number := 'CN-' || year || '-' || LPAD(next_number::text, 3, '0');
  
  RETURN credit_note_number;
END;
$$ LANGUAGE plpgsql;