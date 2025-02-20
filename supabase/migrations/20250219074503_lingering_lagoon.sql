/*
  # Add email tracking functionality

  1. New Tables
    - `email_logs` - Track all sent emails
      - `id` (uuid, primary key)
      - `invoice_id` (uuid, foreign key)
      - `to_email` (text)
      - `cc_email` (text)
      - `bcc_email` (text)
      - `subject` (text)
      - `sent_at` (timestamptz)
      - `status` (text)
      - `error` (text)
      - `metadata` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `email_events` - Track email events (delivery, opens, clicks)
      - `id` (uuid, primary key)
      - `email_log_id` (uuid, foreign key)
      - `event_type` (text)
      - `event_data` (jsonb)
      - `occurred_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Create email_logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  to_email text NOT NULL,
  cc_email text,
  bcc_email text,
  subject text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('queued', 'sent', 'delivered', 'failed')),
  error text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create email_events table
CREATE TABLE IF NOT EXISTS email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_log_id uuid REFERENCES email_logs(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed')),
  event_data jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

-- Create policies for email_logs
CREATE POLICY "Users can view their own email logs"
  ON email_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = email_logs.invoice_id
      AND invoices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own email logs"
  ON email_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = email_logs.invoice_id
      AND invoices.user_id = auth.uid()
    )
  );

-- Create policies for email_events
CREATE POLICY "Users can view their own email events"
  ON email_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM email_logs
      JOIN invoices ON email_logs.invoice_id = invoices.id
      WHERE email_logs.id = email_events.email_log_id
      AND invoices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own email events"
  ON email_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM email_logs
      JOIN invoices ON email_logs.invoice_id = invoices.id
      WHERE email_logs.id = email_events.email_log_id
      AND invoices.user_id = auth.uid()
    )
  );

-- Create function to update email status
CREATE OR REPLACE FUNCTION update_email_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE email_logs
  SET 
    status = NEW.event_type,
    updated_at = now()
  WHERE id = NEW.email_log_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update email status on event
CREATE TRIGGER update_email_status_trigger
AFTER INSERT ON email_events
FOR EACH ROW
EXECUTE FUNCTION update_email_status();

-- Create function to get email tracking stats
CREATE OR REPLACE FUNCTION get_email_tracking_stats(p_invoice_id uuid)
RETURNS TABLE (
  total_sent int,
  total_delivered int,
  total_opened int,
  total_clicked int,
  last_opened timestamptz,
  last_clicked timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT el.id)::int as total_sent,
    COUNT(DISTINCT CASE WHEN ee.event_type = 'delivered' THEN ee.id END)::int as total_delivered,
    COUNT(DISTINCT CASE WHEN ee.event_type = 'opened' THEN ee.id END)::int as total_opened,
    COUNT(DISTINCT CASE WHEN ee.event_type = 'clicked' THEN ee.id END)::int as total_clicked,
    MAX(CASE WHEN ee.event_type = 'opened' THEN ee.occurred_at END) as last_opened,
    MAX(CASE WHEN ee.event_type = 'clicked' THEN ee.occurred_at END) as last_clicked
  FROM email_logs el
  LEFT JOIN email_events ee ON el.id = ee.email_log_id
  WHERE el.invoice_id = p_invoice_id
  AND EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.id = el.invoice_id
    AND i.user_id = auth.uid()
  );
END;
$$;