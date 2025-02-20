/*
  # Add client statement function
  
  1. New Functions
    - get_client_statement(client_id UUID, start_date DATE, end_date DATE)
      Returns a statement of all invoices and payments for a client within a date range
      
  2. Return Fields
    - date: The transaction date
    - description: Invoice number or payment description
    - type: 'invoice' or 'payment'
    - amount: Transaction amount
    - running_balance: Cumulative balance
*/

-- Function to get client statement
CREATE OR REPLACE FUNCTION get_client_statement(
  p_client_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  date DATE,
  description TEXT,
  type TEXT,
  amount NUMERIC,
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
      'invoice' AS type,
      i.total AS amount
    FROM invoices i
    WHERE 
      i.client_id = p_client_id
      AND i.date BETWEEN p_start_date AND p_end_date
      AND i.user_id = auth.uid()
  )
  SELECT
    t.date,
    t.description,
    t.type,
    t.amount,
    SUM(
      CASE 
        WHEN t.type = 'invoice' THEN t.amount
        ELSE -t.amount
      END
    ) OVER (ORDER BY t.date, t.type) AS running_balance
  FROM transactions t
  ORDER BY t.date, t.type;
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION get_client_statement TO authenticated;