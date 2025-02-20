export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'accountant' | 'employee';
}

export interface Invoice {
  id: string;
  number: string;
  clientId: string;
  date: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  currency: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address: string;
  currency: string;
  paymentTerms?: number;
}

export interface DashboardStats {
  totalRevenue: number;
  outstandingInvoices: number;
  overduePayments: number;
  monthlyRevenue: {
    month: string;
    amount: number;
  }[];
}