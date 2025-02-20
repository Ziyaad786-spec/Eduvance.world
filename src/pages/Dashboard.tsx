import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, Line } from 'react-chartjs-2';
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
} from 'chart.js';
import { DollarSign, FileText, AlertCircle, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, subMonths } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useSettingsStore } from '../store/settings';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

type DashboardStats = {
  totalRevenue: number;
  outstandingAmount: number;
  overdueAmount: number;
  monthlyRevenue: {
    month: string;
    amount: number;
  }[];
  topClients: {
    name: string;
    total: number;
  }[];
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { currency } = useSettingsStore();
  const queryClient = useQueryClient();

  // Fetch dashboard statistics
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = subMonths(endDate, 6);

      // Fetch monthly revenue
      const { data: monthlyData, error: monthlyError } = await supabase
        .rpc('get_monthly_revenue', {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        });

      if (monthlyError) throw monthlyError;

      // Fetch invoices for calculations
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('total, status, due_date')
        .gte('created_at', startDate.toISOString());

      if (invoicesError) throw invoicesError;

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

      // Fetch top clients
      const { data: topClients, error: clientsError } = await supabase
        .rpc('get_top_clients', {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          limit_count: 5,
        });

      if (clientsError) throw clientsError;

      return {
        totalRevenue,
        outstandingAmount,
        overdueAmount,
        monthlyRevenue: monthlyData || [],
        topClients: topClients || [],
      };
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Subscribe to real-time updates
  React.useEffect(() => {
    const invoicesSubscription = supabase
      .channel('invoices-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices',
        },
        () => {
          // Refetch dashboard stats when invoices change
          void queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(invoicesSubscription);
    };
  }, [queryClient]);

  const revenueChartData = {
    labels: stats?.monthlyRevenue.map((item) => item.month) || [],
    datasets: [
      {
        label: 'Revenue',
        data: stats?.monthlyRevenue.map((item) => item.amount) || [],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
      },
    ],
  };

  const clientChartData = {
    labels: stats?.topClients.map((client) => client.name) || [],
    datasets: [
      {
        label: 'Revenue',
        data: stats?.topClients.map((client) => client.total) || [],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
      },
    ],
  };

  const dashboardStats = [
    {
      name: 'Total Revenue',
      value: stats ? `${currency.symbol}${stats.totalRevenue.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}` : '-',
      icon: DollarSign,
      change: '+20.1%',
      changeType: 'positive' as const,
    },
    {
      name: 'Outstanding Invoices',
      value: stats ? `${currency.symbol}${stats.outstandingAmount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}` : '-',
      icon: FileText,
      change: stats ? `${stats.outstandingAmount > 0 ? 'Pending Payments' : 'No Outstanding'}` : '-',
      changeType: 'neutral' as const,
    },
    {
      name: 'Overdue Payments',
      value: stats ? `${currency.symbol}${stats.overdueAmount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}` : '-',
      icon: AlertCircle,
      change: stats ? `${stats.overdueAmount > 0 ? 'Action Required' : 'All Paid'}` : '-',
      changeType: 'negative' as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <button 
          onClick={() => navigate('/invoices/new')}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Invoice
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {dashboardStats.map((item) => (
          <div
            key={item.name}
            className="bg-white overflow-hidden shadow rounded-lg"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <item.icon
                    className="h-6 w-6 text-gray-400"
                    aria-hidden="true"
                  />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {item.name}
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {item.value}
                      </div>
                      <div
                        className={`ml-2 flex items-baseline text-sm font-semibold ${
                          item.changeType === 'positive'
                            ? 'text-green-600'
                            : item.changeType === 'negative'
                            ? 'text-red-600'
                            : 'text-gray-500'
                        }`}
                      >
                        {item.change}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Revenue Overview
          </h2>
          <div className="h-80">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <Line
                data={revenueChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                    },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          let label = context.dataset.label || '';
                          if (label) {
                            label += ': ';
                          }
                          if (context.parsed.y !== null) {
                            label += currency.symbol + context.parsed.y.toFixed(2);
                          }
                          return label;
                        }
                      }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: function(value) {
                          return currency.symbol + value.toFixed(0);
                        }
                      }
                    }
                  }
                }}
              />
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Top Clients
          </h2>
          <div className="h-80">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <Bar
                data={clientChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                    },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          let label = context.dataset.label || '';
                          if (label) {
                            label += ': ';
                          }
                          if (context.parsed.y !== null) {
                            label += currency.symbol + context.parsed.y.toFixed(2);
                          }
                          return label;
                        }
                      }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: function(value) {
                          return currency.symbol + value.toFixed(0);
                        }
                      }
                    }
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}