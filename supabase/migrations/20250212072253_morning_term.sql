/*
  # Add recurring invoice cron job

  1. Changes
    - Add cron extension if not exists
    - Create cron job to run generate_recurring_invoices() daily
*/

-- Enable the pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a daily cron job to generate recurring invoices
SELECT cron.schedule(
  'generate-recurring-invoices',  -- name of the cron job
  '0 0 * * *',                   -- run at midnight every day
  $$
    SELECT generate_recurring_invoices();
  $$
);