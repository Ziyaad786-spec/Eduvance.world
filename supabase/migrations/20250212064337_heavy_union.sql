/*
  # Create clients table and update relationships

  1. New Tables
    - `clients`
      - `id` (uuid, primary key)
      - `name` (text, not null)
      - `email` (text)
      - `phone` (text)
      - `address` (text)
      - `currency_code` (text)
      - `payment_terms` (integer)
      - `user_id` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes
    - Create temporary column for client_id transition
    - Safely update foreign key relationship
    - Add proper constraints

  3. Security
    - Enable RLS on clients table
    - Add policies for authenticated users to manage their own clients
*/

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  address text,
  currency_code text,
  payment_terms integer,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add temporary UUID column to invoices
DO $$ 
BEGIN
  ALTER TABLE invoices ADD COLUMN new_client_id uuid;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Create policies for clients
CREATE POLICY "Users can create their own clients"
  ON clients
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own clients"
  ON clients
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add sample clients and update relationships
DO $$ 
DECLARE
  acme_id uuid := '550e8400-e29b-41d4-a716-446655440000';
  wayne_id uuid := '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  stark_id uuid := '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
BEGIN
  -- Insert sample clients if they don't exist
  INSERT INTO clients (id, name, email, address, currency_code, user_id)
  VALUES 
    (acme_id, 'Acme Corp', 'contact@acme.com', '123 Business Ave', 'USD', auth.uid()),
    (wayne_id, 'Wayne Enterprises', 'bruce@wayne.com', '1007 Mountain Drive', 'USD', auth.uid()),
    (stark_id, 'Stark Industries', 'tony@stark.com', '10880 Malibu Point', 'USD', auth.uid())
  ON CONFLICT (id) DO NOTHING;

  -- Update existing invoices to use the new client IDs
  UPDATE invoices 
  SET new_client_id = CASE client_id
    WHEN 'client1' THEN acme_id
    WHEN 'client2' THEN wayne_id
    WHEN 'client3' THEN stark_id
    ELSE NULL
  END;
END $$;

-- Drop the old client_id column
ALTER TABLE invoices DROP COLUMN IF EXISTS client_id;

-- Make new_client_id not null
ALTER TABLE invoices ALTER COLUMN new_client_id SET NOT NULL;

-- Rename the column
ALTER TABLE invoices RENAME COLUMN new_client_id TO client_id;

-- Add foreign key constraint
ALTER TABLE invoices
  ADD CONSTRAINT fk_client
  FOREIGN KEY (client_id) 
  REFERENCES clients(id)
  ON DELETE RESTRICT;