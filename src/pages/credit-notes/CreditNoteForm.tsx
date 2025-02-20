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
  ArrowLeft,
  Calculator,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSettingsStore } from '../../store/settings';

const creditNoteSchema = z.object({
  invoiceId: z.string().uuid('Please select an invoice'),
  clientId: z.string().uuid('Please select a client'),
  date: z.string().min(1, 'Date is required'),
  reason: z.string().min(1, 'Reason is required'),
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

type CreditNoteFormData = z.infer<typeof creditNoteSchema>;

type Client = {
  id: string;
  name: string;
  email: string;
  address: string;
};

type Invoice = {
  id: string;
  number: string;
  total: number;
  client_id: string;
};

export default function CreditNoteForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { currency } = useSettingsStore();
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreditNoteFormData>({
    resolver: zodResolver(creditNoteSchema),
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
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
  const selectedInvoiceId = watch('invoiceId');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch clients
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('id, name, email, address')
          .order('name');

        if (clientsError) throw clientsError;

        // Fetch invoices
        const { data: invoicesData, error: invoicesError } = await supabase
          .from('invoices')
          .select('id, number, total, client_id')
          .in('status', ['sent', 'paid'])
          .order('created_at', { ascending: false });

        if (invoicesError) throw invoicesError;

        setClients(clientsData || []);
        setInvoices(invoicesData || []);

        if (isEditing && id) {
          const { data: creditNote, error: creditNoteError } = await supabase
            .from('credit_notes')
            .select(`
              *,
              items:credit_note_items(*)
            `)
            .eq('id', id)
            .single();

          if (creditNoteError) throw creditNoteError;

          if (creditNote) {
            setValue('invoiceId', creditNote.invoice_id);
            setValue('clientId', creditNote.client_id);
            setValue('date', creditNote.date);
            setValue('reason', creditNote.reason);
            setValue('tax', creditNote.tax_rate);
            setValue('items', creditNote.items);
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, setValue, isEditing]);

  const onSubmit = async (data: CreditNoteFormData) => {
    try {
      setError(null);
      
      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setError('You must be logged in to create credit notes');
        return;
      }

      // Start by inserting the credit note
      const { data: creditNote, error: creditNoteError } = await supabase
        .from('credit_notes')
        .insert({
          invoice_id: data.invoiceId,
          client_id: data.clientId,
          date: data.date,
          reason: data.reason,
          tax_rate: data.tax,
          currency_code: currency.code,
          status: 'draft',
          number: await generateCreditNoteNumber(),
          user_id: user.id
        })
        .select()
        .single();

      if (creditNoteError) {
        console.error('Error saving credit note:', creditNoteError);
        setError('Failed to create credit note. Please try again.');
        return;
      }

      // Then insert all credit note items
      const { error: itemsError } = await supabase
        .from('credit_note_items')
        .insert(
          data.items.map(item => ({
            credit_note_id: creditNote.id,
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.quantity * item.rate
          }))
        );

      if (itemsError) {
        console.error('Error saving credit note items:', itemsError);
        setError('Failed to save credit note items. Please try again.');
        return;
      }

      navigate('/credit-notes');
    } catch (error) {
      console.error('Error saving credit note:', error);
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

  const generateCreditNoteNumber = async () => {
    const { data, error } = await supabase
      .rpc('generate_credit_note_number');
    
    if (error) throw error;
    return data;
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
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/credit-notes')}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">
            {isEditing ? 'Edit Credit Note' : 'New Credit Note'}
          </h1>
        </div>
        <button
          type="button"
          onClick={handleSubmit(onSubmit)}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <Save className="h-4 w-4 mr-2" />
          Save Credit Note
        </button>
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
              <label
                htmlFor="invoiceId"
                className="block text-sm font-medium text-gray-700"
              >
                Original Invoice
              </label>
              <select
                {...register('invoiceId')}
                onChange={(e) => {
                  const invoice = invoices.find(i => i.id === e.target.value);
                  if (invoice) {
                    setValue('clientId', invoice.client_id);
                  }
                }}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="">Select an invoice</option>
                {invoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.number} ({currency.symbol}{invoice.total.toFixed(2)})
                  </option>
                ))}
              </select>
              {errors.invoiceId && (
                <p className="mt-2 text-sm text-red-600">
                  {errors.invoiceId.message}
                </p>
              )}
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="clientId"
                className="block text-sm font-medium text-gray-700"
              >
                Client
              </label>
              <select
                {...register('clientId')}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                disabled={Boolean(selectedInvoiceId)}
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
                Date
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

            <div className="sm:col-span-6">
              <label
                htmlFor="reason"
                className="block text-sm font-medium text-gray-700"
              >
                Reason for Credit Note
              </label>
              <textarea
                {...register('reason')}
                rows={3}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter the reason for issuing this credit note..."
              />
              {errors.reason && (
                <p className="mt-2 text-sm text-red-600">
                  {errors.reason.message}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="pt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Credit Note Items
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