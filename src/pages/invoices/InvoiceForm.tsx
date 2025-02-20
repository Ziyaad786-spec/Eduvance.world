import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import {
  Plus,
  Trash2,
  Save,
  Send,
  Download,
  ArrowLeft,
  Calculator,
  UserPlus,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, InvoiceItem } from '../../types';
import { useSettingsStore, currencies } from '../../store/settings';
import { supabase } from '../../lib/supabase';
import AddClientModal from '../../components/clients/AddClientModal';

const invoiceSchema = z.object({
  clientId: z.string().uuid('Please select a client'),
  date: z.string().min(1, 'Date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  items: z.array(
    z.object({
      description: z.string().min(1, 'Description is required'),
      quantity: z.number().min(1, 'Quantity must be at least 1'),
      rate: z.number().min(0, 'Rate must be at least 0'),
      amount: z.number(),
    })
  ),
  tax: z.number().min(0, 'Tax must be at least 0'),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

type Client = {
  id: string;
  name: string;
  email: string;
  address: string;
};

export default function InvoiceForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { currency } = useSettingsStore();
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddClient, setShowAddClient] = useState(false);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, email, address');
      
      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error('Error fetching clients:', err);
      setError('Failed to load clients. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      dueDate: format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      items: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
      tax: 0,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const items = watch('items');
  const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const tax = watch('tax');
  const total = subtotal + (subtotal * tax) / 100;
  const selectedClientId = watch('clientId');
  const selectedClient = clients.find(c => c.id === selectedClientId);

  const generateInvoiceNumber = async () => {
    const { data, error } = await supabase
      .rpc('generate_invoice_number');
    
    if (error) throw error;
    return data;
  };

  const generatePDF = async (data: InvoiceFormData) => {
    const doc = new jsPDF();
    const client = clients.find(c => c.id === data.clientId);
    
    // Add company info
    doc.setFontSize(20);
    doc.text('INVOICE', 20, 20);
    
    doc.setFontSize(10);
    doc.text('Your Company Name', 20, 30);
    doc.text('123 Business Street', 20, 35);
    doc.text('Business City, 12345', 20, 40);
    
    // Add client info
    if (client) {
      doc.text('Bill To:', 20, 55);
      doc.text(client.name, 20, 60);
      doc.text(client.address, 20, 65);
      if (client.email) doc.text(client.email, 20, 70);
    }
    
    // Add invoice details
    doc.text(`Invoice Date: ${format(new Date(data.date), 'MMM dd, yyyy')}`, 120, 55);
    doc.text(`Due Date: ${format(new Date(data.dueDate), 'MMM dd, yyyy')}`, 120, 60);
    
    // Add items table
    const tableData = data.items.map(item => [
      item.description,
      item.quantity.toString(),
      `${currency.symbol}${item.rate.toFixed(2)}`,
      `${currency.symbol}${item.amount.toFixed(2)}`,
    ]);
    
    autoTable(doc, {
      startY: 80,
      head: [['Description', 'Quantity', 'Rate', 'Amount']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
    });
    
    // Add totals
    const finalY = (doc as any).lastAutoTable.finalY || 120;
    doc.text(`Subtotal: ${currency.symbol}${subtotal.toFixed(2)}`, 140, finalY + 10);
    doc.text(`Tax (${tax}%): ${currency.symbol}${(subtotal * tax / 100).toFixed(2)}`, 140, finalY + 15);
    doc.text(`Total: ${currency.symbol}${total.toFixed(2)}`, 140, finalY + 20);
    
    // Save the PDF
    doc.save('invoice.pdf');
  };

  const onSubmit = async (data: InvoiceFormData) => {
    try {
      setError(null);
      
      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setError('You must be logged in to create invoices');
        return;
      }

      // Start by inserting the invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          client_id: data.clientId,
          date: data.date,
          due_date: data.dueDate,
          tax_rate: data.tax,
          currency_code: currency.code,
          status: 'draft',
          number: await generateInvoiceNumber(),
          user_id: user.id
        })
        .select()
        .single();

      if (invoiceError) {
        console.error('Error saving invoice:', invoiceError);
        setError('Failed to create invoice. Please try again.');
        return;
      }

      // Then insert all invoice items
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(
          data.items.map(item => ({
            invoice_id: invoice.id,
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.quantity * item.rate
          }))
        );

      if (itemsError) {
        console.error('Error saving invoice items:', itemsError);
        setError('Failed to save invoice items. Please try again.');
        return;
      }

      navigate('/invoices');
    } catch (error) {
      console.error('Error saving invoice:', error);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  const calculateItemAmount = (index: number) => {
    const item = items[index];
    if (item) {
      const amount = item.quantity * item.rate;
      setValue(`items.${index}.amount`, amount);
    }
  };

  const handleClientAdded = (newClient: { id: string; name: string }) => {
    setClients(prev => [...prev, { ...newClient, email: '', address: '' }]);
    setValue('clientId', newClient.id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showAddClient && (
        <AddClientModal
          onClose={() => setShowAddClient(false)}
          onClientAdded={handleClientAdded}
        />
      )}

      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/invoices')}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">
            {isEditing ? 'Edit Invoice' : 'New Invoice'}
          </h1>
        </div>
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={handleSubmit((data) => generatePDF(data))}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </button>
          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Invoice
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

      <form className="space-y-8 divide-y divide-gray-200">
        <div className="space-y-6 sm:space-y-5">
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <div className="flex justify-between items-center">
                <label
                  htmlFor="clientId"
                  className="block text-sm font-medium text-gray-700"
                >
                  Client
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddClient(true)}
                  className="inline-flex items-center px-2 py-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Add New
                </button>
              </div>
              <select
                {...register('clientId')}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              {errors.clientId && (
                <p className="mt-2 text-sm text-red-600">
                  {errors.clientId.message}
                </p>
              )}
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="date"
                className="block text-sm font-medium text-gray-700"
              >
                Invoice Date
              </label>
              <input
                type="date"
                {...register('date')}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              {errors.date && (
                <p className="mt-2 text-sm text-red-600">{errors.date.message}</p>
              )}
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="dueDate"
                className="block text-sm font-medium text-gray-700"
              >
                Due Date
              </label>
              <input
                type="date"
                {...register('dueDate')}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              {errors.dueDate && (
                <p className="mt-2 text-sm text-red-600">
                  {errors.dueDate.message}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="pt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Invoice Items
            </h3>
            <button
              type="button"
              onClick={() =>
                append({ description: '', quantity: 1, rate: 0, amount: 0 })
              }
              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </button>
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex-grow grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor={`items.${index}.description`}
                      className="block text-sm font-medium text-gray-700"
                    >
                      Description
                    </label>
                    <input
                      type="text"
                      {...register(`items.${index}.description`)}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`items.${index}.quantity`}
                      className="block text-sm font-medium text-gray-700"
                    >
                      Quantity
                    </label>
                    <input
                      type="number"
                      {...register(`items.${index}.quantity`, {
                        valueAsNumber: true,
                        onChange: () => calculateItemAmount(index),
                      })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`items.${index}.rate`}
                      className="block text-sm font-medium text-gray-700"
                    >
                      Rate ({currency.symbol})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      {...register(`items.${index}.rate`, {
                        valueAsNumber: true,
                        onChange: () => calculateItemAmount(index),
                      })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-end pb-2">
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-8">
          <div className="flex justify-end">
            <div className="w-96 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-gray-700">Subtotal</span>
                <span className="text-gray-900">
                  {currency.symbol}{subtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="tax"
                  className="block text-sm font-medium text-gray-700"
                >
                  Tax Rate (%)
                </label>
                <div className="w-32">
                  <input
                    type="number"
                    step="0.1"
                    {...register('tax', { valueAsNumber: true })}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-between text-base font-medium">
                <span className="text-gray-900">Total</span>
                <span className="text-blue-600">
                  {currency.symbol}{total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}