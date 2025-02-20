import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Currency = {
  code: string;
  symbol: string;
  name: string;
};

type CompanyDetails = {
  name: string;
  registrationNumber: string;
  vatNumber: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  logo?: string;
  schoolLogo?: string; // Add school logo field
};

type ContactDetails = {
  email: string;
  phone: string;
  website: string;
};

type BankDetails = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  sortCode: string;
  swiftCode: string;
  iban: string;
};

type InvoiceSettings = {
  defaultDueDate: number;
  defaultTaxRate: number;
  defaultNotes: string;
  defaultTerms: string;
};

type SettingsState = {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  companyDetails: CompanyDetails;
  setCompanyDetails: (details: CompanyDetails) => void;
  contactDetails: ContactDetails;
  setContactDetails: (details: ContactDetails) => void;
  bankDetails: BankDetails;
  setBankDetails: (details: BankDetails) => void;
  invoiceSettings: InvoiceSettings;
  setInvoiceSettings: (settings: InvoiceSettings) => void;
  setLogo: (logo: string) => void;
  removeLogo: () => void;
  setSchoolLogo: (logo: string) => void; // Add school logo setter
  removeSchoolLogo: () => void; // Add school logo remover
};

const currencies: Currency[] = [
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
];

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      currency: currencies[0], // ZAR as default
      setCurrency: (currency) => set({ currency }),
      companyDetails: {
        name: '',
        registrationNumber: '',
        vatNumber: '',
        address: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
        logo: undefined,
        schoolLogo: undefined,
      },
      setCompanyDetails: (details) => set({ companyDetails: details }),
      contactDetails: {
        email: '',
        phone: '',
        website: '',
      },
      setContactDetails: (details) => set({ contactDetails: details }),
      bankDetails: {
        bankName: '',
        accountName: '',
        accountNumber: '',
        sortCode: '',
        swiftCode: '',
        iban: '',
      },
      setBankDetails: (details) => set({ bankDetails: details }),
      invoiceSettings: {
        defaultDueDate: 14,
        defaultTaxRate: 15,
        defaultNotes: 'Thank you for your business!',
        defaultTerms: '1. Payment is due within the specified payment terms.\n2. Late payments may be subject to additional charges.\n3. Please include invoice number in payment reference.',
      },
      setInvoiceSettings: (settings) => set({ invoiceSettings: settings }),
      setLogo: (logo) => set((state) => ({
        companyDetails: { ...state.companyDetails, logo }
      })),
      removeLogo: () => set((state) => ({
        companyDetails: { ...state.companyDetails, logo: undefined }
      })),
      setSchoolLogo: (logo) => set((state) => ({
        companyDetails: { ...state.companyDetails, schoolLogo: logo }
      })),
      removeSchoolLogo: () => set((state) => ({
        companyDetails: { ...state.companyDetails, schoolLogo: undefined }
      })),
    }),
    {
      name: 'settings-storage',
      partialize: (state) => ({
        ...state,
        companyDetails: {
          ...state.companyDetails,
          logo: state.companyDetails.logo,
          schoolLogo: state.companyDetails.schoolLogo,
        }
      }),
    }
  )
);

export { currencies };