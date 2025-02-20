import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  Clock,
  AlertCircle,
  Calendar,
  Download,
  ExternalLink,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { supabase } from '../lib/supabase';
import { useSettingsStore } from '../store/settings';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

type ReportData = {
  totalRevenue: number;
  outstandingAmount: number;
  overdueAmount: number;
  averageInvoiceValue: number;
  monthlyRevenue: {
    month: string;
    amount: number;
  }[];
  statusDistribution: {
    status: string;
    count: number;
  }[];
  topClients: {
    name: string;
    total: number;
  }[];
};

export default function Reports() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [dateRange, setDateRange] = useState<'30' | '90' | '180' | '365'>('30');
  const { currency } = useSettingsStore();

  const fetchReportData = async () => {
    try {
      setLoading(true);
      setError(null);

      const endDate = new Date();
      const startDate = subMonths(endDate, parseInt(dateRange) / 30);

      // Fetch all required data in parallel
      const [
        { data: invoices, error: invoicesError },
        { data: monthlyData, error: monthlyError },
        { data: clientData, error: clientError },
      ] = await Promise.all([
        // Get overall invoice statistics
        supabase
          .from('invoices')
          .select('total, status, created_at')
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString()),

        // Get monthly revenue
        supabase.rpc('get_monthly_revenue', {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        }),

        // Get top clients
        supabase.rpc('get_top_clients', {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          limit_count: 5,
        }),
      ]);

      if (invoicesError) throw invoicesError;
      if (monthlyError) throw monthlyError;
      if (clientError) throw clientError;

      // Calculate statistics
      const totalRevenue = invoices
        ?.filter((inv) => inv.status === 'paid')
        .reduce((sum, inv) => sum + inv.total, 0) || 0;

      const outstandingAmount = invoices
        ?.filter((inv) => inv.status === 'sent')
        .reduce((sum, inv) => sum + inv.total, 0) || 0;

      const overdueAmount = invoices
        ?.filter((inv) => inv.status === 'overdue')
        .reduce((sum, inv) => sum + inv.total, 0) || 0;

      const averageInvoiceValue =
        totalRevenue / (invoices?.filter((inv) => inv.status === 'paid').length || 1);

      // Calculate status distribution
      const statusCounts = invoices?.reduce((acc, inv) => {
        acc[inv.status] = (acc[inv.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const statusDistribution = Object.entries(statusCounts || {}).map(
        ([status, count]) => ({
          status,
          count,
        })
      );

      setReportData({
        totalRevenue,
        outstandingAmount,
        overdueAmount,
        averageInvoiceValue,
        monthlyRevenue: monthlyData || [],
        statusDistribution,
        topClients: clientData || [],
      });
    } catch (err) {
      console.error('Error fetching report data:', err);
      setError('Failed to load report data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [dateRange]);

  const navigateToInvoices = (status?: string) => {
    const searchParams = new URLSearchParams();
    if (status) {
      searchParams.set('status', status);
    }
    navigate(`/invoices?${searchParams.toString()}`);
  };

  const revenueChartData = {
    labels: reportData?.monthlyRevenue.map((item) => item.month) || [],
    datasets: [
      {
        label: 'Revenue',
        data: reportData?.monthlyRevenue.map((item) => item.amount) || [],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
      },
    ],
  };

  const statusChartData = {
    labels: reportData?.statusDistribution.map((item) => item.status) || [],
    datasets: [
      {
        data: reportData?.statusDistribution.map((item) => item.count) || [],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)', // blue
          'rgba(34, 197, 94, 0.8)',  // green
          'rgba(239, 68, 68, 0.8)',  // red
          'rgba(234, 179, 8, 0.8)',  // yellow
        ],
      },
    ],
  };

  const clientChartData = {
    labels: reportData?.topClients.map((client) => client.name) || [],
    datasets: [
      {
        label: 'Total Revenue',
        data: reportData?.topClients.map((client) => client.total) || [],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
      },
    ],
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
        <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
        <div className="flex items-center space-x-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as '30' | '90' | '180' | '365')}
            className="block w-40 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
          >
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="180">Last 180 Days</option>
            <option value="365">Last 365 Days</option>
          </select>
          <button className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
            <Download className="h-4 w-4 mr-2" />
            Export Report
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

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div 
          className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow duration-200"
          onClick={() => navigateToInvoices('paid')}
        >
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <DollarSign className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Revenue
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {currency.symbol}
                        {reportData?.totalRevenue.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>

        <div 
          className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow duration-200"
          onClick={() => navigateToInvoices('sent')}
        >
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Clock className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Outstanding Amount
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {currency.symbol}
                        {reportData?.outstandingAmount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>

        <div 
          className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow duration-200"
          onClick={() => navigateToInvoices('overdue')}
        >
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Overdue Amount
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {currency.symbol}
                        {reportData?.overdueAmount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>

        <div 
          className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow duration-200"
          onClick={() => navigateToInvoices()}
        >
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <TrendingUp className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Average Invoice Value
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {currency.symbol}
                        {reportData?.averageInvoiceValue.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Revenue Trend</h2>
          <div className="h-80">
            <Line
              data={revenueChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false,
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: (value) => `${currency.symbol}${value}`,
                    },
                  },
                },
                onClick: () => navigateToInvoices('paid'),
              }}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Invoice Status Distribution</h2>
          <div className="h-80">
            <Doughnut
              data={statusChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'right' as const,
                  },
                },
                onClick: (event, elements) => {
                  if (elements.length > 0) {
                    const status = statusChartData.labels?.[elements[0].index];
                    if (status) {
                      navigateToInvoices(status.toString());
                    }
                  }
                },
              }}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Top Clients by Revenue</h2>
          <div className="h-80">
            <Bar
              data={clientChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false,
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: (value) => `${currency.symbol}${value}`,
                    },
                  },
                },
                onClick: () => navigateToInvoices(),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}