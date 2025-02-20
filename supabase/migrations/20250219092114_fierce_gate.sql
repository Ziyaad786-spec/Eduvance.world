-- Update email_events table constraint
ALTER TABLE email_events DROP CONSTRAINT IF EXISTS email_events_event_type_check;
ALTER TABLE email_events ADD CONSTRAINT email_events_event_type_check 
  CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed'));