import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  MoreHorizontal,
  Building,
  Edit,
  Trash2,
  CreditCard,
  Upload,
  Repeat,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { useSettingsStore } from '../../store/settings';
import type { Database } from '../../types/supabase';

type Invoice = Database['public']['Tables']['invoices']['Row'] & {
  items: Database['public']['Tables']['invoice_items']['Row'][];
  client: Database['public']['Tables']['clients']['Row'];
};

const statusStyles = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
};

const statusIcons = {
  draft: FileText,
  sent: Upload,
  paid: CreditCard,
  overdue: MoreHorizontal,
};

type FilterState = {
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
  clientId: string;
  showFilters: boolean;
};

export default function InvoiceList() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();
  const { currency, companyDetails } = useSettingsStore();
  const [showActions, setShowActions] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [filters, setFilters] = useState<FilterState>({
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: '',
    clientId: '',
    showFilters: false,
  });

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error('Error fetching clients:', err);
    }
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          items:invoice_items(*),
          client:clients(*)
        `)
        .order('created_at', { ascending: false });

      if (invoicesError) throw invoicesError;

      setInvoices(data || []);
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError('Failed to load invoices. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchInvoices();
      fetchClients();
    }
  }, [user]);

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);

      if (deleteError) throw deleteError;
      
      setInvoices(invoices.filter(invoice => invoice.id !== invoiceId));
      setShowActions(null);
    } catch (err) {
      console.error('Error deleting invoice:', err);
      alert('Failed to delete invoice. Please try again.');
    }
  };

  const generatePDF = async (invoice: Invoice) => {
    try {
      // Only update status if it's currently a draft
      if (invoice.status === 'draft') {
        const { error: updateError } = await supabase
          .from('invoices')
          .update({
            status: 'sent',
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoice.id);

        if (updateError) throw updateError;

        // Update local state
        setInvoices(prevInvoices =>
          prevInvoices.map(inv =>
            inv.id === invoice.id
              ? { ...inv, status: 'sent', updated_at: new Date().toISOString() }
              : inv
          )
        );
      }

      const doc = new jsPDF();
      
      // Add company logo if exists
      if (companyDetails.logo) {
        try {
          // Create a new Image object
          const companyImg = new Image();
          companyImg.src = companyDetails.logo;
          
          // Wait for image to load
          await new Promise((resolve, reject) => {
            companyImg.onload = resolve;
            companyImg.onerror = reject;
          });

          // Position logo in top left
          doc.addImage(companyDetails.logo, 'PNG', 20, 20, 40, 40, undefined, 'FAST');
        } catch (logoError) {
          console.error('Error adding company logo:', logoError);
          // Continue without logo
        }
      }

      // Add school logo if exists
      if (companyDetails.schoolLogo) {
        try {
          // Create a new Image object
          const schoolImg = new Image();
          schoolImg.src = companyDetails.schoolLogo;
          
          // Wait for image to load
          await new Promise((resolve, reject) => {
            schoolImg.onload = resolve;
            schoolImg.onerror = reject;
          });

          // Position school logo in top right
          doc.addImage(companyDetails.schoolLogo, 'PNG', 150, 20, 40, 40, undefined, 'FAST');
        } catch (logoError) {
          console.error('Error adding school logo:', logoError);
          // Continue without logo
        }
      }

      // Add company info
      doc.setFontSize(10);
      doc.text(companyDetails.name || 'Your Company Name', 70, 30);
      doc.text(companyDetails.address || '', 70, 35);
      doc.text(`${companyDetails.city || ''}, ${companyDetails.state || ''} ${companyDetails.postalCode || ''}`, 70, 40);
      doc.text(companyDetails.country || '', 70, 45);

      // Add invoice title
      doc.setFontSize(24);
      doc.setTextColor(59, 130, 246); // Blue color
      doc.text('INVOICE', 150, 40);
      
      // Add invoice number and dates
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.text('Invoice Number:', 140, 60);
      doc.setFont('helvetica', 'bold');
      doc.text(invoice.number, 180, 60);
      
      doc.setFont('helvetica', 'normal');
      doc.text('Invoice Date:', 140, 70);
      doc.setFont('helvetica', 'bold');
      doc.text(format(new Date(invoice.date), 'MMM dd, yyyy'), 180, 70);
      
      doc.setFont('helvetica', 'normal');
      doc.text('Due Date:', 140, 80);
      doc.setFont('helvetica', 'bold');
      doc.text(format(new Date(invoice.due_date), 'MMM dd, yyyy'), 180, 80);
      
      // Add client info
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Bill To:', 20, 110);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      if (invoice.client) {
        doc.text(invoice.client.name, 20, 120);
        if (invoice.client.address) doc.text(invoice.client.address, 20, 125);
        if (invoice.client.email) doc.text(invoice.client.email, 20, 130);
      }
      
      // Add items table
      const tableData = invoice.items.map(item => [
        item.description,
        item.quantity.toString(),
        `${currency.symbol}${item.rate.toFixed(2)}`,
        `${currency.symbol}${item.amount.toFixed(2)}`,
      ]);
      
      autoTable(doc, {
        startY: 150,
        head: [['Description', 'Quantity', 'Rate', 'Amount']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
      });
      
      const finalY = (doc as any).lastAutoTable.finalY || 180;
      
      // Add totals
      doc.text(`Subtotal: ${currency.symbol}${invoice.subtotal.toFixed(2)}`, 140, finalY + 10);
      doc.text(`Tax (${invoice.tax_rate}%): ${currency.symbol}${invoice.tax_amount.toFixed(2)}`, 140, finalY + 15);
      doc.text(`Total: ${currency.symbol}${invoice.total.toFixed(2)}`, 140, finalY + 20);
      
      // Save the PDF
      doc.save(`invoice-${invoice.number}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const handleDownloadPDF = (invoice: Invoice) => {
    void generatePDF(invoice);
  };

  const filteredInvoices = invoices.filter((invoice) => {
    // Text search
    const matchesSearch =
      invoice.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.total.toString().includes(searchTerm) ||
      invoice.client?.name.toLowerCase().includes(searchTerm.toLowerCase());

    // Status filter
    const matchesStatus =
      selectedStatus === 'all' || invoice.status === selectedStatus;

    // Date range filter
    const matchesDateRange =
      (!filters.startDate || new Date(invoice.date) >= new Date(filters.startDate)) &&
      (!filters.endDate || new Date(invoice.date) <= new Date(filters.endDate));

    // Amount range filter
    const matchesAmountRange =
      (!filters.minAmount || invoice.total >= parseFloat(filters.minAmount)) &&
      (!filters.maxAmount || invoice.total <= parseFloat(filters.maxAmount));

    // Client filter
    const matchesClient =
      !filters.clientId || invoice.client_id === filters.clientId;

    return (
      matchesSearch &&
      matchesStatus &&
      matchesDateRange &&
      matchesAmountRange &&
      matchesClient
    );
  });

  const resetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      minAmount: '',
      maxAmount: '',
      clientId: '',
      showFilters: false,
    });
  };

  if (!user) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">
          Please sign in to view invoices
        </h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Invoices</h1>
        <div className="flex space-x-4">
          <button
            onClick={() => setShowBulkModal(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Upload className="h-4 w-4 mr-2" />
            Bulk Create
          </button>
          <button
            onClick={() => setShowRecurringModal(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Repeat className="h-4 w-4 mr-2" />
            Recurring
          </button>
          <button
            onClick={() => navigate('/invoices/new')}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{error}</h3>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-4">
              <div className="relative">
                <select
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
              <button
                onClick={() => setFilters(prev => ({ ...prev, showFilters: !prev.showFilters }))}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <Filter className="h-4 w-4 mr-2" />
                {filters.showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
              <button className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                <Download className="h-4 w-4 mr-2" />
                Export
              </button>
            </div>
          </div>

          {filters.showFilters && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-4 mt-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium text-gray-700">Advanced Filters</h3>
                <button
                  onClick={resetFilters}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  Reset Filters
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start Date</label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">End Date</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Min Amount</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">{currency.symbol}</span>
                    </div>
                    <input
                      type="number"
                      value={filters.minAmount}
                      onChange={(e) => setFilters(prev => ({ ...prev, minAmount: e.target.value }))}
                      className="block w-full pl-7 pr-12 border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Max Amount</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">{currency.symbol}</span>
                    </div>
                    <input
                      type="number"
                      value={filters.maxAmount}
                      onChange={(e) => setFilters(prev => ({ ...prev, maxAmount: e.target.value }))}
                      className="block w-full pl-7 pr-12 border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="md:col-span-2 lg:col-span-4">
                  <label className="block text-sm font-medium text-gray-700">Client</label>
                  <select
                    value={filters.clientId}
                    onChange={(e) => setFilters(prev => ({ ...prev, clientId: e.target.value }))}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  >
                    <option value="">All Clients</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-600"></div>
              <p className="mt-2 text-sm text-gray-500">Loading invoices...</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInvoices.map((invoice) => {
                  const StatusIcon = statusIcons[invoice.status];
                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 text-gray-400 mr-2" />
                          <div className="text-sm font-medium text-gray-900">
                            {invoice.number}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Building className="h-5 w-5 text-gray-400 mr-2" />
                          <div className="text-sm text-gray-900">
                            {invoice.client?.name || 'Unknown Client'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(invoice.date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(invoice.due_date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: invoice.currency_code,
                        }).format(invoice.total)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            statusStyles[invoice.status]
                          }`}
                        >
                          <StatusIcon className="h-4 w-4 mr-1" />
                          {invoice.status.charAt(0).toUpperCase() +
                            invoice.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="relative">
                          <button
                            onClick={() => setShowActions(showActions === invoice.id ? null : invoice.id)}
                            className="text-gray-400 hover:text-gray-500"
                          >
                            <MoreHorizontal className="h-5 w-5" />
                          </button>
                          {showActions === invoice.id && (
                            <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                              <div className="py-1" role="menu">
                                <button
                                  onClick={() => navigate(`/invoices/${invoice.id}/edit`)}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </button>
                                {invoice.status !== 'paid' && (
                                  <button
                                    onClick={() => {
                                      setSelectedInvoice(invoice);
                                      setShowPaymentModal(true);
                                      setShowActions(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                  >
                                    <CreditCard className="h-4 w-4 mr-2" />
                                    Record Payment
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDownloadPDF(invoice)}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Download PDF
                                </button>
                                <button
                                  onClick={() => handleDeleteInvoice(invoice.id)}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                      No invoices found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}