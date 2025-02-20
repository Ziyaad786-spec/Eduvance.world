/*
  # Invoice Management Schema

  1. New Tables
    - `invoices`
      - `id` (uuid, primary key)
      - `number` (text, unique) - Invoice number (e.g., INV-2024-001)
      - `client_id` (text) - Reference to client
      - `date` (date) - Invoice date
      - `due_date` (date) - Due date
      - `subtotal` (numeric) - Sum of all items before tax
      - `tax_rate` (numeric) - Tax percentage
      - `tax_amount` (numeric) - Calculated tax amount
      - `total` (numeric) - Final total including tax
      - `status` (text) - Invoice status (draft, sent, paid, overdue)
      - `currency_code` (text) - Currency code (e.g., ZAR, USD)
      - `user_id` (uuid) - Reference to auth.users
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `invoice_items`
      - `id` (uuid, primary key)
      - `invoice_id` (uuid) - Reference to invoices
      - `description` (text)
      - `quantity` (numeric)
      - `rate` (numeric)
      - `amount` (numeric)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own invoices
*/

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  client_id text NOT NULL,
  date date NOT NULL,
  due_date date NOT NULL,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  currency_code text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT status_check CHECK (status IN ('draft', 'sent', 'paid', 'overdue'))
);

-- Create invoice items table
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL,
  rate numeric NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- Create policies for invoices
CREATE POLICY "Users can create their own invoices"
  ON invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own invoices"
  ON invoices
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own invoices"
  ON invoices
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policies for invoice items
CREATE POLICY "Users can manage invoice items for their invoices"
  ON invoice_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND invoices.user_id = auth.uid()
    )
  );

-- Create function to update invoice totals
CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the invoice totals
  UPDATE invoices
  SET 
    subtotal = (
      SELECT COALESCE(SUM(amount), 0)
      FROM invoice_items
      WHERE invoice_id = NEW.invoice_id
    ),
    updated_at = now()
  WHERE id = NEW.invoice_id;
  
  -- Recalculate tax and total
  UPDATE invoices
  SET 
    tax_amount = subtotal * (tax_rate / 100),
    total = subtotal + (subtotal * (tax_rate / 100))
  WHERE id = NEW.invoice_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update totals when items change
CREATE TRIGGER update_invoice_totals_trigger
AFTER INSERT OR UPDATE OR DELETE ON invoice_items
FOR EACH ROW
EXECUTE FUNCTION update_invoice_totals();

-- Create function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text AS $$
DECLARE
  year text;
  next_number integer;
  invoice_number text;
BEGIN
  year := to_char(current_date, 'YYYY');
  
  SELECT COALESCE(
    (SELECT MAX(CAST(SUBSTRING(number FROM 'INV-\d{4}-(\d+)') AS integer))
     FROM invoices
     WHERE number LIKE 'INV-' || year || '-%'
    ), 0) + 1
  INTO next_number;
  
  invoice_number := 'INV-' || year || '-' || LPAD(next_number::text, 3, '0');
  
  RETURN invoice_number;
END;
$$ LANGUAGE plpgsql;