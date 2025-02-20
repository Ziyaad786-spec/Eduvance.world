/*
  # Add Reports Functions

  This migration adds database functions for generating report data:
  
  1. New Functions:
    - get_monthly_revenue: Calculates revenue by month
    - get_top_clients: Returns top clients by revenue
  
  2. Security:
    - Functions are accessible only to authenticated users
    - Results are filtered by user_id for data isolation
*/

-- Function to get monthly revenue
CREATE OR REPLACE FUNCTION get_monthly_revenue(
  start_date timestamptz,
  end_date timestamptz
)
RETURNS TABLE (
  month text,
  amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_char(date_trunc('month', i.created_at), 'Mon YYYY') as month,
    COALESCE(SUM(i.total), 0) as amount
  FROM invoices i
  WHERE
    i.created_at >= start_date
    AND i.created_at <= end_date
    AND i.user_id = auth.uid()
    AND i.status = 'paid'
  GROUP BY date_trunc('month', i.created_at)
  ORDER BY date_trunc('month', i.created_at);
END;
$$;

-- Function to get top clients by revenue
CREATE OR REPLACE FUNCTION get_top_clients(
  start_date timestamptz,
  end_date timestamptz,
  limit_count integer DEFAULT 5
)
RETURNS TABLE (
  name text,
  total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.name,
    COALESCE(SUM(i.total), 0) as total
  FROM clients c
  LEFT JOIN invoices i ON c.id = i.client_id
  WHERE
    i.created_at >= start_date
    AND i.created_at <= end_date
    AND i.user_id = auth.uid()
    AND i.status = 'paid'
  GROUP BY c.id, c.name
  ORDER BY total DESC
  LIMIT limit_count;
END;
$$;