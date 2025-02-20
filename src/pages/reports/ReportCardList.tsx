import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Send,
  GraduationCap,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import type { ReportCard, Student } from '../../types/supabase';

type ReportCardWithStudent = ReportCard & {
  student: Student;
};

const statusStyles = {
  draft: 'bg-gray-100 text-gray-800',
  published: 'bg-green-100 text-green-800',
  archived: 'bg-blue-100 text-blue-800',
};

export default function ReportCardList() {
  const navigate = useNavigate();
  const [reportCards, setReportCards] = useState<ReportCardWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showActions, setShowActions] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    term: '',
    year: new Date().getFullYear(),
    grade: '',
    status: '',
    showFilters: false,
  });
  const { user } = useAuthStore();

  const fetchReportCards = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('report_cards')
        .select(`
          *,
          student:students(*)
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setReportCards(data || []);
    } catch (err) {
      console.error('Error fetching report cards:', err);
      setError('Failed to load report cards. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchReportCards();
    }
  }, [user]);

  const handleDeleteReportCard = async (reportCardId: string) => {
    if (!confirm('Are you sure you want to delete this report card?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('report_cards')
        .delete()
        .eq('id', reportCardId);

      if (deleteError) throw deleteError;
      
      setReportCards(reportCards.filter(rc => rc.id !== reportCardId));
      setShowActions(null);
    } catch (err) {
      console.error('Error deleting report card:', err);
      alert('Failed to delete report card. Please try again.');
    }
  };

  const handlePublishReportCard = async (reportCardId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('report_cards')
        .update({ status: 'published', updated_at: new Date().toISOString() })
        .eq('id', reportCardId);

      if (updateError) throw updateError;
      
      setReportCards(reportCards.map(rc => 
        rc.id === reportCardId 
          ? { ...rc, status: 'published', updated_at: new Date().toISOString() }
          : rc
      ));
      setShowActions(null);
    } catch (err) {
      console.error('Error publishing report card:', err);
      alert('Failed to publish report card. Please try again.');
    }
  };

  const filteredReportCards = reportCards.filter((rc) => {
    const matchesSearch = 
      `${rc.student.first_name} ${rc.student.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTerm = !filters.term || rc.term.toString() === filters.term;
    const matchesYear = !filters.year || rc.year === filters.year;
    const matchesGrade = !filters.grade || rc.student.grade.toString() === filters.grade;
    const matchesStatus = !filters.status || rc.status === filters.status;

    return matchesSearch && matchesTerm && matchesYear && matchesGrade && matchesStatus;
  });

  if (!user) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">
          Please sign in to view report cards
        </h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Report Cards</h1>
        <button
          onClick={() => navigate('/report-cards/new')}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Report Card
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
                  placeholder="Search report cards..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <button
              onClick={() => setFilters(prev => ({ ...prev, showFilters: !prev.showFilters }))}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <Filter className="h-4 w-4 mr-2" />
              {filters.showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>

          {filters.showFilters && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Term</label>
                <select
                  value={filters.term}
                  onChange={(e) => setFilters(prev => ({ ...prev, term: e.target.value }))}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  <option value="">All Terms</option>
                  {[1, 2, 3, 4].map(term => (
                    <option key={term} value={term}>Term {term}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Year</label>
                <select
                  value={filters.year}
                  onChange={(e) => setFilters(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  {[...Array(5)].map((_, i) => {
                    const year = new Date().getFullYear() - i;
                    return (
                      <option key={year} value={year}>{year}</option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Grade</label>
                <select
                  value={filters.grade}
                  onChange={(e) => setFilters(prev => ({ ...prev, grade: e.target.value }))}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  <option value="">All Grades</option>
                  {[...Array(12)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>Grade {i + 1}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  <option value="">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-600"></div>
              <p className="mt-2 text-sm text-gray-500">Loading report cards...</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Term
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Updated
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReportCards.map((reportCard) => (
                  <tr key={reportCard.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <GraduationCap className="h-5 w-5 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {reportCard.student.first_name} {reportCard.student.last_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            Grade {reportCard.student.grade}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="h-5 w-5 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">
                          Term {reportCard.term}, {reportCard.year}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          statusStyles[reportCard.status]
                        }`}
                      >
                        {reportCard.status.charAt(0).toUpperCase() + reportCard.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(reportCard.updated_at || reportCard.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="relative">
                        <button
                          onClick={() => setShowActions(showActions === reportCard.id ? null : reportCard.id)}
                          className="text-gray-400 hover:text-gray-500"
                        >
                          <MoreHorizontal className="h-5 w-5" />
                        </button>
                        {showActions === reportCard.id && (
                          <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                            <div className="py-1" role="menu">
                              <button
                                onClick={() => navigate(`/report-cards/${reportCard.id}`)}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </button>
                              {reportCard.status === 'draft' && (
                                <>
                                  <button
                                    onClick={() => navigate(`/report-cards/${reportCard.id}/edit`)}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handlePublishReportCard(reportCard.id)}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                  >
                                    <Send className="h-4 w-4 mr-2" />
                                    Publish
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => {/* TODO: Implement PDF download */}}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download PDF
                              </button>
                              {reportCard.status === 'draft' && (
                                <button
                                  onClick={() => handleDeleteReportCard(reportCard.id)}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredReportCards.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                      No report cards found
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