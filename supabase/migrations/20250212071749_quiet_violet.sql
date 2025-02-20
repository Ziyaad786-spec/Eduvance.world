/*
  # Add recurring invoices support

  1. New Tables
    - `recurring_invoices`
      - `id` (uuid, primary key)
      - `client_id` (uuid, references clients)
      - `user_id` (uuid, references auth.users)
      - `frequency` (text: weekly, monthly, quarterly, yearly)
      - `start_date` (date)
      - `end_date` (date, nullable)
      - `description` (text)
      - `amount` (numeric)
      - `tax_rate` (numeric)
      - `currency_code` (text)
      - `status` (text: active, paused, completed)
      - `last_generated` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `recurring_invoices` table
    - Add policies for authenticated users to manage their recurring invoices

  3. Functions
    - Add function to generate recurring invoices
*/

-- Create recurring_invoices table
CREATE TABLE IF NOT EXISTS recurring_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES auth.users(id),
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  start_date date NOT NULL,
  end_date date,
  description text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  tax_rate numeric NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
  currency_code text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  last_generated timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT end_date_check CHECK (end_date IS NULL OR end_date > start_date)
);

-- Enable RLS
ALTER TABLE recurring_invoices ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can create their own recurring invoices"
  ON recurring_invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own recurring invoices"
  ON recurring_invoices
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring invoices"
  ON recurring_invoices
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring invoices"
  ON recurring_invoices
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to generate recurring invoices
CREATE OR REPLACE FUNCTION generate_recurring_invoices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  next_date date;
  invoice_id uuid;
BEGIN
  -- Loop through active recurring invoices
  FOR rec IN
    SELECT *
    FROM recurring_invoices
    WHERE status = 'active'
      AND (last_generated IS NULL OR (
        CASE frequency
          WHEN 'weekly' THEN last_generated + interval '1 week'
          WHEN 'monthly' THEN last_generated + interval '1 month'
          WHEN 'quarterly' THEN last_generated + interval '3 months'
          WHEN 'yearly' THEN last_generated + interval '1 year'
        END <= CURRENT_DATE
      ))
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  LOOP
    -- Calculate next invoice date
    next_date := COALESCE(rec.last_generated::date, rec.start_date) + 
      CASE rec.frequency
        WHEN 'weekly' THEN interval '1 week'
        WHEN 'monthly' THEN interval '1 month'
        WHEN 'quarterly' THEN interval '3 months'
        WHEN 'yearly' THEN interval '1 year'
      END;

    -- Create new invoice
    INSERT INTO invoices (
      client_id,
      user_id,
      date,
      due_date,
      tax_rate,
      currency_code,
      status,
      number
    ) VALUES (
      rec.client_id,
      rec.user_id,
      next_date,
      next_date + interval '30 days',
      rec.tax_rate,
      rec.currency_code,
      'draft',
      generate_invoice_number()
    )
    RETURNING id INTO invoice_id;

    -- Create invoice item
    INSERT INTO invoice_items (
      invoice_id,
      description,
      quantity,
      rate,
      amount
    ) VALUES (
      invoice_id,
      rec.description,
      1,
      rec.amount,
      rec.amount
    );

    -- Update last_generated timestamp
    UPDATE recurring_invoices
    SET 
      last_generated = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = rec.id;
  END LOOP;
END;
$$;