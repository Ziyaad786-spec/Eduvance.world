import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Building,
  Mail,
  Phone,
  Globe,
  CreditCard,
  FileText,
  DollarSign,
  Save,
  Upload,
  X,
  Image,
} from 'lucide-react';
import { useSettingsStore, currencies } from '../store/settings';

const settingsSchema = z.object({
  companyDetails: z.object({
    name: z.string().min(1, 'Company name is required'),
    registrationNumber: z.string(),
    vatNumber: z.string(),
    address: z.string().min(1, 'Address is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string(),
    postalCode: z.string().min(1, 'Postal code is required'),
    country: z.string().min(1, 'Country is required'),
  }),
  contactDetails: z.object({
    email: z.string().email('Invalid email address'),
    phone: z.string().min(1, 'Phone number is required'),
    website: z.string().url('Invalid website URL').or(z.literal('')),
  }),
  bankDetails: z.object({
    bankName: z.string().min(1, 'Bank name is required'),
    accountName: z.string().min(1, 'Account name is required'),
    accountNumber: z.string().min(1, 'Account number is required'),
    sortCode: z.string(),
    swiftCode: z.string(),
    iban: z.string(),
  }),
  invoiceSettings: z.object({
    defaultDueDate: z.number().min(0, 'Must be 0 or greater'),
    defaultTaxRate: z.number().min(0, 'Must be 0 or greater'),
    defaultNotes: z.string(),
    defaultTerms: z.string(),
  }),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function Settings() {
  const {
    currency,
    setCurrency,
    companyDetails,
    setCompanyDetails,
    contactDetails,
    setContactDetails,
    bankDetails,
    setBankDetails,
    invoiceSettings,
    setInvoiceSettings,
    setLogo,
    removeLogo,
    setSchoolLogo,
    removeSchoolLogo,
  } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<
    'company' | 'contact' | 'bank' | 'invoice'
  >('company');
  const [success, setSuccess] = useState(false);
  const companyLogoInputRef = useRef<HTMLInputElement>(null);
  const schoolLogoInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      companyDetails,
      contactDetails,
      bankDetails,
      invoiceSettings,
    },
  });

  const handleCompanyLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('File size should be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setLogo(base64String);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    };
    reader.readAsDataURL(file);
  };

  const handleSchoolLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('File size should be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setSchoolLogo(base64String);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = (data: SettingsFormData) => {
    setCompanyDetails(data.companyDetails);
    setContactDetails(data.contactDetails);
    setBankDetails(data.bankDetails);
    setInvoiceSettings(data.invoiceSettings);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const tabs = [
    { id: 'company', name: 'Company', icon: Building },
    { id: 'contact', name: 'Contact', icon: Mail },
    { id: 'bank', name: 'Banking', icon: CreditCard },
    { id: 'invoice', name: 'Invoice', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <button
          onClick={handleSubmit(onSubmit)}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </button>
      </div>

      {success && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                Settings saved successfully
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`
                    flex-1 px-4 py-4 text-center border-b-2 text-sm font-medium
                    ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="h-5 w-5 mx-auto mb-1" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          <form className="space-y-6">
            {activeTab === 'company' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex justify-center">
                    <div className="space-y-4 text-center">
                      <h3 className="text-sm font-medium text-gray-700">Company Logo</h3>
                      <div className="relative inline-block">
                        {companyDetails.logo ? (
                          <div className="relative">
                            <img
                              src={companyDetails.logo}
                              alt="Company Logo"
                              className="h-32 w-auto object-contain"
                            />
                            <button
                              type="button"
                              onClick={() => removeLogo()}
                              className="absolute -top-2 -right-2 p-1 bg-red-100 rounded-full text-red-600 hover:bg-red-200"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="h-32 w-32 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                            <Image className="h-12 w-12 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <input
                        type="file"
                        ref={companyLogoInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleCompanyLogoUpload}
                      />
                      <button
                        type="button"
                        onClick={() => companyLogoInputRef.current?.click()}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {companyDetails.logo ? 'Change Logo' : 'Upload Logo'}
                      </button>
                      <p className="text-xs text-gray-500">
                        Recommended size: 200x200px. Max file size: 2MB
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <div className="space-y-4 text-center">
                      <h3 className="text-sm font-medium text-gray-700">School Logo</h3>
                      <div className="relative inline-block">
                        {companyDetails.schoolLogo ? (
                          <div className="relative">
                            <img
                              src={companyDetails.schoolLogo}
                              alt="School Logo"
                              className="h-32 w-auto object-contain"
                            />
                            <button
                              type="button"
                              onClick={() => removeSchoolLogo()}
                              className="absolute -top-2 -right-2 p-1 bg-red-100 rounded-full text-red-600 hover:bg-red-200"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="h-32 w-32 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                            <Image className="h-12 w-12 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <input
                        type="file"
                        ref={schoolLogoInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleSchoolLogoUpload}
                      />
                      <button
                        type="button"
                        onClick={() => schoolLogoInputRef.current?.click()}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {companyDetails.schoolLogo ? 'Change Logo' : 'Upload Logo'}
                      </button>
                      <p className="text-xs text-gray-500">
                        Recommended size: 200x200px. Max file size: 2MB
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Currency
                  </label>
                  <select
                    value={currency.code}
                    onChange={(e) => {
                      const newCurrency = currencies.find(
                        (c) => c.code === e.target.value
                      );
                      if (newCurrency) {
                        setCurrency(newCurrency);
                      }
                    }}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  >
                    {currencies.map((curr) => (
                      <option key={curr.code} value={curr.code}>
                        {curr.name} ({curr.symbol})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Company Name
                  </label>
                  <input
                    type="text"
                    {...register('companyDetails.name')}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                  {errors.companyDetails?.name && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.companyDetails.name.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Registration Number
                    </label>
                    <input
                      type="text"
                      {...register('companyDetails.registrationNumber')}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      VAT Number
                    </label>
                    <input
                      type="text"
                      {...register('companyDetails.vatNumber')}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Address
                  </label>
                  <input
                    type="text"
                    {...register('companyDetails.address')}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                  {errors.companyDetails?.address && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.companyDetails.address.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      City
                    </label>
                    <input
                      type="text"
                      {...register('companyDetails.city')}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      State/Province
                    </label>
                    <input
                      type="text"
                      {...register('companyDetails.state')}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      {...register('companyDetails.postalCode')}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Country
                  </label>
                  <input
                    type="text"
                    {...register('companyDetails.country')}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>
            )}

            {activeTab === 'contact' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      {...register('contactDetails.email')}
                      className="block w-full pl-10 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                  {errors.contactDetails?.email && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.contactDetails.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Phone Number
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      {...register('contactDetails.phone')}
                      className="block w-full pl-10 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Website
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Globe className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="url"
                      {...register('contactDetails.website')}
                      className="block w-full pl-10 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'bank' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    {...register('bankDetails.bankName')}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Account Name
                  </label>
                  <input
                    type="text"
                    {...register('bankDetails.accountName')}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Account Number
                  </label>
                  <input
                    type="text"
                    {...register('bankDetails.accountNumber')}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Sort Code
                  </label>
                  <input
                    type="text"
                    {...register('bankDetails.sortCode')}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    SWIFT/BIC Code
                  </label>
                  <input
                    type="text"
                    {...register('bankDetails.swiftCode')}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    IBAN
                  </label>
                  <input
                    type="text"
                    {...register('bankDetails.iban')}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>
            )}

            {activeTab === 'invoice' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Default Due Date (days)
                  </label>
                  <input
                    type="number"
                    {...register('invoiceSettings.defaultDueDate', {
                      valueAsNumber: true,
                    })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Default Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    {...register('invoiceSettings.defaultTaxRate', {
                      valueAsNumber: true,
                    })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Default Invoice Notes
                  </label>
                  <textarea
                    {...register('invoiceSettings.defaultNotes')}
                    rows={3}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Default Terms & Conditions
                  </label>
                  <textarea
                    {...register('invoiceSettings.defaultTerms')}
                    rows={5}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}