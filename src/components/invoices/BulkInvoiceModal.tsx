import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Upload, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSettingsStore } from '../../store/settings';

const bulkInvoiceSchema = z.object({
  file: z.instanceof(File),
});

type BulkInvoiceFormData = z.infer<typeof bulkInvoiceSchema>;

interface BulkInvoiceModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkInvoiceModal({ onClose, onSuccess }: BulkInvoiceModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const { currency } = useSettingsStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BulkInvoiceFormData>({
    resolver: zodResolver(bulkInvoiceSchema),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const rows = text.split('\n').map(row => row.split(','));
      const headers = rows[0];
      const data = rows.slice(1).map(row => {
        const obj: any = {};
        headers.forEach((header, i) => {
          obj[header.trim()] = row[i]?.trim();
        });
        return obj;
      });
      setPreview(data);
    } catch (err) {
      console.error('Error parsing CSV:', err);
      setError('Failed to parse CSV file. Please check the format.');
    }
  };

  const onSubmit = async (data: BulkInvoiceFormData) => {
    try {
      setError(null);

      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setError('You must be logged in to create invoices');
        return;
      }

      // Process each row in the preview data
      for (const row of preview) {
        // Create invoice
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert({
            client_id: row.client_id,
            date: row.date,
            due_date: row.due_date,
            tax_rate: parseFloat(row.tax_rate) || 0,
            currency_code: currency.code,
            status: 'draft',
            number: await generateInvoiceNumber(),
            user_id: user.id
          })
          .select()
          .single();

        if (invoiceError) throw invoiceError;

        // Create invoice items
        const items = row.items.split(';').map((item: string) => {
          const [description, quantity, rate] = item.split('|');
          return {
            invoice_id: invoice.id,
            description,
            quantity: parseFloat(quantity),
            rate: parseFloat(rate),
            amount: parseFloat(quantity) * parseFloat(rate)
          };
        });

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(items);

        if (itemsError) throw itemsError;
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating bulk invoices:', error);
      setError('Failed to create invoices. Please check your CSV format and try again.');
    }
  };

  const generateInvoiceNumber = async () => {
    const { data, error } = await supabase
      .rpc('generate_invoice_number');
    
    if (error) throw error;
    return data;
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Bulk Create Invoices</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 rounded-md">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">CSV Format Requirements:</h3>
          <div className="bg-gray-50 rounded-md p-4">
            <p className="text-sm text-gray-600">
              Your CSV file should include the following columns:
            </p>
            <ul className="mt-2 text-sm text-gray-600 list-disc list-inside">
              <li>client_id (UUID of the client)</li>
              <li>date (YYYY-MM-DD)</li>
              <li>due_date (YYYY-MM-DD)</li>
              <li>tax_rate (number)</li>
              <li>items (format: description|quantity|rate;description|quantity|rate)</li>
            </ul>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Upload CSV File
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                  >
                    <span>Upload a file</span>
                    <input
                      id="file-upload"
                      type="file"
                      accept=".csv"
                      className="sr-only"
                      {...register('file')}
                      onChange={handleFileChange}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">CSV files only</p>
              </div>
            </div>
          </div>

          {preview.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Preview:</h3>
              <div className="max-h-60 overflow-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {Object.keys(preview[0]).map((header) => (
                        <th
                          key={header}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {preview.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((value: any, j) => (
                          <td
                            key={j}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >
                            {value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || preview.length === 0}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Invoices'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}