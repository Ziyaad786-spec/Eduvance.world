-- Update email_logs table constraint
ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_status_check;
ALTER TABLE email_logs ADD CONSTRAINT email_logs_status_check 
  CHECK (status IN ('queued', 'sent', 'delivered', 'failed'));

-- Update email_events table constraint
ALTER TABLE email_events DROP CONSTRAINT IF EXISTS email_events_event_type_check;
ALTER TABLE email_events ADD CONSTRAINT email_events_event_type_check 
  CHECK (event_type IN ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed'));

-- Add function to handle email events
CREATE OR REPLACE FUNCTION handle_email_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Update email log status
  UPDATE email_logs
  SET 
    status = CASE
      WHEN NEW.event_type IN ('bounced', 'complained') THEN 'failed'
      WHEN NEW.event_type IN ('delivered', 'opened', 'clicked') THEN 'delivered'
      ELSE NEW.event_type
    END,
    updated_at = now()
  WHERE id = NEW.email_log_id;

  -- If the event indicates successful delivery, update the invoice status if it's in draft
  IF NEW.event_type IN ('sent', 'delivered', 'opened', 'clicked') THEN
    UPDATE invoices i
    SET 
      status = 'sent',
      updated_at = now()
    FROM email_logs e
    WHERE e.id = NEW.email_log_id
    AND e.invoice_id = i.id
    AND i.status = 'draft';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS email_event_trigger ON email_events;

-- Create new trigger for email events
CREATE TRIGGER email_event_trigger
AFTER INSERT ON email_events
FOR EACH ROW
EXECUTE FUNCTION handle_email_event();