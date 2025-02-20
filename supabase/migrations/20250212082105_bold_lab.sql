-- Drop existing function first
DROP FUNCTION IF EXISTS get_client_statement(uuid, date, date);

-- Create enhanced client statement function
CREATE OR REPLACE FUNCTION get_client_statement(
  p_client_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  date DATE,
  description TEXT,
  reference TEXT,
  type TEXT,
  debit NUMERIC,
  credit NUMERIC,
  running_balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH transactions AS (
    -- Get invoices
    SELECT
      i.date AS date,
      'Invoice #' || i.number AS description,
      i.number AS reference,
      'invoice' AS type,
      i.total AS debit,
      0 AS credit
    FROM invoices i
    WHERE 
      i.client_id = p_client_id
      AND i.date BETWEEN p_start_date AND p_end_date
      AND i.user_id = auth.uid()

    UNION ALL

    -- Get payments
    SELECT
      i.date AS date,
      'Payment for Invoice #' || i.number AS description,
      i.number AS reference,
      'payment' AS type,
      0 AS debit,
      i.total AS credit
    FROM invoices i
    WHERE 
      i.client_id = p_client_id
      AND i.date BETWEEN p_start_date AND p_end_date
      AND i.status = 'paid'
      AND i.user_id = auth.uid()
  )
  SELECT
    t.date,
    t.description,
    t.reference,
    t.type,
    t.debit,
    t.credit,
    SUM(t.debit - t.credit) OVER (
      ORDER BY t.date, 
      -- Show invoices before payments on the same date
      CASE WHEN t.type = 'invoice' THEN 0 ELSE 1 END
    ) AS running_balance
  FROM transactions t
  ORDER BY 
    t.date,
    CASE WHEN t.type = 'invoice' THEN 0 ELSE 1 END;
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION get_client_statement TO authenticated;

-- Create a secure view for client statements that includes RLS in the view definition
CREATE OR REPLACE VIEW client_statement_summary AS
SELECT
  c.id AS client_id,
  c.name AS client_name,
  COUNT(DISTINCT i.id) AS total_invoices,
  SUM(CASE WHEN i.status = 'paid' THEN i.total ELSE 0 END) AS total_paid,
  SUM(CASE WHEN i.status IN ('sent', 'overdue') THEN i.total ELSE 0 END) AS total_outstanding,
  MIN(i.date) AS first_invoice_date,
  MAX(i.date) AS last_invoice_date
FROM clients c
LEFT JOIN invoices i ON c.id = i.client_id
WHERE c.user_id = auth.uid()
GROUP BY c.id, c.name;

-- Grant access to the view
GRANT SELECT ON client_statement_summary TO authenticated;