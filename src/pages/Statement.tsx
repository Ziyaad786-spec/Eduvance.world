import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  FileSpreadsheet,
  Download,
  Search,
  Building,
  Calendar,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { useSettingsStore } from '../store/settings';

type Client = {
  id: string;
  name: string;
};

type StatementEntry = {
  date: string;
  description: string;
  reference: string;
  type: string;
  debit: number;
  credit: number;
  running_balance: number;
};

type StatementSummary = {
  client_id: string;
  client_name: string;
  total_invoices: number;
  total_paid: number;
  total_outstanding: number;
  first_invoice_date: string;
  last_invoice_date: string;
};

export default function Statement() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [startDate, setStartDate] = useState(
    format(new Date(new Date().setMonth(new Date().getMonth() - 1)), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [statement, setStatement] = useState<StatementEntry[]>([]);
  const [summary, setSummary] = useState<StatementSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();
  const { currency, companyDetails, contactDetails } = useSettingsStore();

  useEffect(() => {
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
        setError('Failed to load clients');
      }
    };

    if (user) {
      fetchClients();
    }
  }, [user]);

  const fetchStatement = async () => {
    if (!selectedClient) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch statement entries
      const { data: entries, error: entriesError } = await supabase
        .rpc('get_client_statement', {
          p_client_id: selectedClient,
          p_start_date: startDate,
          p_end_date: endDate,
        });

      if (entriesError) throw entriesError;

      // Fetch summary
      const { data: summaryData, error: summaryError } = await supabase
        .from('client_statement_summary')
        .select('*')
        .eq('client_id', selectedClient)
        .single();

      if (summaryError) throw summaryError;

      setStatement(entries || []);
      setSummary(summaryData);
    } catch (err) {
      console.error('Error fetching statement:', err);
      setError('Failed to load statement');
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    if (!statement.length || !summary) return;

    const doc = new jsPDF();
    const selectedClientName = clients.find(c => c.id === selectedClient)?.name || 'Unknown Client';

    // Add company logo
    if (companyDetails.logo) {
      doc.addImage(companyDetails.logo, 'PNG', 20, 20, 40, 40, undefined, 'FAST');
    }

    // Add company info
    doc.setFontSize(10);
    doc.text(companyDetails.name || 'Your Company Name', 70, 30);
    doc.text(companyDetails.address || '', 70, 35);
    doc.text(`${companyDetails.city || ''}, ${companyDetails.state || ''} ${companyDetails.postalCode || ''}`, 70, 40);
    doc.text(companyDetails.country || '', 70, 45);
    
    // Add contact info
    doc.text(contactDetails.email || '', 70, 50);
    doc.text(contactDetails.phone || '', 70, 55);
    doc.text(contactDetails.website || '', 70, 60);

    // Add statement title
    doc.setFontSize(24);
    doc.setTextColor(59, 130, 246); // Blue color
    doc.text('STATEMENT', 150, 40);

    // Add statement details
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Period: ${format(new Date(startDate), 'MMM d, yyyy')} - ${format(new Date(endDate), 'MMM d, yyyy')}`, 150, 50);
    doc.text(`Date Issued: ${format(new Date(), 'MMM d, yyyy')}`, 150, 55);

    // Add client info
    doc.setFontSize(12);
    doc.text('Statement For:', 20, 80);
    doc.setFontSize(10);
    doc.text(selectedClientName, 20, 90);

    // Add summary section
    doc.setFillColor(247, 250, 252);
    doc.rect(20, 100, doc.internal.pageSize.width - 40, 30, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', 25, 110);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Invoices: ${summary.total_invoices}`, 25, 120);
    doc.text(`Total Paid: ${currency.symbol}${summary.total_paid.toFixed(2)}`, 100, 120);
    doc.text(`Outstanding: ${currency.symbol}${summary.total_outstanding.toFixed(2)}`, 175, 120);

    // Add statement table
    autoTable(doc, {
      startY: 140,
      head: [['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Balance']],
      body: statement.map(entry => [
        format(new Date(entry.date), 'MMM d, yyyy'),
        entry.description,
        entry.reference,
        entry.debit > 0 ? `${currency.symbol}${entry.debit.toFixed(2)}` : '',
        entry.credit > 0 ? `${currency.symbol}${entry.credit.toFixed(2)}` : '',
        `${currency.symbol}${entry.running_balance.toFixed(2)}`,
      ]),
      headStyles: {
        fillColor: [59, 130, 246],
        fontSize: 10,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [247, 250, 252],
      },
    });

    // Add footer
    const finalY = (doc as any).lastAutoTable.finalY || 280;
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text('This statement includes all transactions within the specified date range.', 20, finalY + 10);
    doc.text('For any queries regarding this statement, please contact our accounts department.', 20, finalY + 15);

    // Add page numbers
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }

    // Save the PDF
    doc.save(`statement-${selectedClientName}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  if (!user) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">
          Please sign in to view statements
        </h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Statement</h1>
        {statement.length > 0 && (
          <button
            onClick={downloadPDF}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </button>
        )}
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
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Client
              </label>
              <div className="mt-1">
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Start Date
              </label>
              <div className="mt-1">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                End Date
              </label>
              <div className="mt-1">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchStatement}
                disabled={!selectedClient}
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Generate Statement
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-600"></div>
            <p className="mt-2 text-sm text-gray-500">Loading statement...</p>
          </div>
        ) : statement.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reference
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Debit
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credit
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {statement.map((entry, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(entry.date), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {entry.reference}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {entry.debit > 0 ? `${currency.symbol}${entry.debit.toFixed(2)}` : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {entry.credit > 0 ? `${currency.symbol}${entry.credit.toFixed(2)}` : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                      {currency.symbol}{entry.running_balance.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : selectedClient ? (
          <div className="text-center py-12 text-gray-500">
            No transactions found for the selected period
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            Select a client and date range to generate a statement
          </div>
        )}
      </div>
    </div>
  );
}