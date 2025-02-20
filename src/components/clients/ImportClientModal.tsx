import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Upload, AlertCircle, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSettingsStore } from '../../store/settings';

const importSchema = z.object({
  file: z.any()
});

type ImportFormData = z.infer<typeof importSchema>;

interface ImportClientModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportClientModal({ onClose, onSuccess }: ImportClientModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const { currency } = useSettingsStore();

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ImportFormData>({
    resolver: zodResolver(importSchema),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const rows = text.split('\n')
        .filter(row => row.trim())
        .map(row => row.split(','));
      
      const headers = rows[0].map(header => header.trim());
      const requiredHeaders = ['name', 'email', 'address'];
      
      if (!requiredHeaders.every(h => headers.includes(h))) {
        setError('CSV file must contain required columns: name, email, address');
        setPreview([]);
        return;
      }

      const data = rows.slice(1).map(row => {
        const obj: any = {};
        headers.forEach((header, i) => {
          obj[header] = row[i]?.trim() || '';
        });
        return obj;
      });

      setPreview(data);
      setError(null);
    } catch (err) {
      console.error('Error parsing CSV:', err);
      setError('Failed to parse CSV file. Please check the format.');
      setPreview([]);
    }
  };

  const downloadTemplate = () => {
    const headers = ['name', 'email', 'phone', 'address', 'payment_terms'];
    const template = [
      headers.join(','),
      'Acme Corp,contact@acme.com,+1234567890,"123 Business St, City",30'
    ].join('\n');

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'client-import-template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const onSubmit = async () => {
    if (preview.length === 0) {
      setError('Please upload a valid CSV file first');
      return;
    }

    try {
      setError(null);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setError('You must be logged in to import clients');
        return;
      }

      const { error: importError } = await supabase
        .from('clients')
        .insert(
          preview.map(row => ({
            name: row.name,
            email: row.email,
            phone: row.phone || null,
            address: row.address,
            payment_terms: parseInt(row.payment_terms) || null,
            currency_code: currency.code,
            user_id: user.id
          }))
        );

      if (importError) throw importError;

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error importing clients:', error);
      setError('Failed to import clients. Please check your CSV format and try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Import Clients</h2>
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
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-gray-700">CSV Format Requirements:</h3>
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </button>
          </div>
          <div className="bg-gray-50 rounded-md p-4">
            <p className="text-sm text-gray-600">Required columns:</p>
            <ul className="mt-2 text-sm text-gray-600 list-disc list-inside">
              <li>name</li>
              <li>email</li>
              <li>address</li>
              <li>phone (optional)</li>
              <li>payment_terms (optional)</li>
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
              {isSubmitting ? 'Importing...' : 'Import Clients'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}