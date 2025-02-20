import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  GraduationCap,
  Book,
  Calendar,
  Percent,
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import AddAssessmentModal from '../../components/assessments/AddAssessmentModal';
import EditAssessmentModal from '../../components/assessments/EditAssessmentModal';
import type { Assessment, Student, Subject } from '../../types/supabase';

type AssessmentWithDetails = Assessment & {
  student: Student;
  subject: Subject;
};

export default function AssessmentList() {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState<AssessmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentWithDetails | null>(null);
  const [showActions, setShowActions] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    term: '',
    year: new Date().getFullYear(),
    subject: '',
    type: '',
    showFilters: false,
  });
  const { user } = useAuthStore();

  const fetchAssessments = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('assessments')
        .select(`
          *,
          student:students(*),
          subject:subjects(*)
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setAssessments(data || []);
    } catch (err) {
      console.error('Error fetching assessments:', err);
      setError('Failed to load assessments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAssessments();
    }
  }, [user]);

  const handleDeleteAssessment = async (assessmentId: string) => {
    if (!confirm('Are you sure you want to delete this assessment?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('assessments')
        .delete()
        .eq('id', assessmentId);

      if (deleteError) throw deleteError;
      
      setAssessments(assessments.filter(assessment => assessment.id !== assessmentId));
      setShowActions(null);
    } catch (err) {
      console.error('Error deleting assessment:', err);
      alert('Failed to delete assessment. Please try again.');
    }
  };

  const filteredAssessments = assessments.filter(assessment => {
    const matchesSearch = 
      assessment.student.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assessment.student.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assessment.subject.name_en.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTerm = !filters.term || assessment.term.toString() === filters.term;
    const matchesYear = !filters.year || assessment.year === filters.year;
    const matchesSubject = !filters.subject || assessment.subject_id === filters.subject;
    const matchesType = !filters.type || assessment.assessment_type === filters.type;

    return matchesSearch && matchesTerm && matchesYear && matchesSubject && matchesType;
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAssessmentTypeColor = (type: string) => {
    switch (type) {
      case 'exam':
        return 'bg-purple-100 text-purple-800';
      case 'assignment':
        return 'bg-blue-100 text-blue-800';
      case 'practical':
        return 'bg-green-100 text-green-800';
      case 'project':
        return 'bg-yellow-100 text-yellow-800';
      case 'test':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!user) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">
          Please sign in to view assessments
        </h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showAddModal && (
        <AddAssessmentModal
          onClose={() => setShowAddModal(false)}
          onAssessmentAdded={(newAssessment) => {
            setAssessments(prev => [newAssessment as AssessmentWithDetails, ...prev]);
            setShowAddModal(false);
          }}
        />
      )}

      {showEditModal && selectedAssessment && (
        <EditAssessmentModal
          assessment={selectedAssessment}
          onClose={() => {
            setShowEditModal(false);
            setSelectedAssessment(null);
          }}
          onAssessmentUpdated={(updatedAssessment) => {
            setAssessments(prev =>
              prev.map(a => a.id === updatedAssessment.id ? updatedAssessment as AssessmentWithDetails : a)
            );
            setShowEditModal(false);
            setSelectedAssessment(null);
          }}
        />
      )}

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Assessments</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Assessment
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
                  placeholder="Search assessments..."
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
                <label className="block text-sm font-medium text-gray-700">Assessment Type</label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  <option value="">All Types</option>
                  <option value="exam">Exam</option>
                  <option value="assignment">Assignment</option>
                  <option value="practical">Practical</option>
                  <option value="project">Project</option>
                  <option value="test">Test</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-600"></div>
              <p className="mt-2 text-sm text-gray-500">Loading assessments...</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Term
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAssessments.map((assessment) => (
                  <tr key={assessment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <GraduationCap className="h-5 w-5 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {assessment.student.first_name} {assessment.student.last_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            Grade {assessment.student.grade}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Book className="h-5 w-5 text-gray-400 mr-2" />
                        <div className="text-sm text-gray-900">
                          {assessment.subject.name_en}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          getAssessmentTypeColor(assessment.assessment_type)
                        }`}
                      >
                        {assessment.assessment_type.charAt(0).toUpperCase() + assessment.assessment_type.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="h-5 w-5 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">
                          Term {assessment.term}, {assessment.year}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Percent className="h-5 w-5 text-gray-400 mr-2" />
                        <span className={`text-sm font-medium ${getScoreColor(assessment.score)}`}>
                          {assessment.score}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="relative">
                        <button
                          onClick={() => setShowActions(showActions === assessment.id ? null : assessment.id)}
                          className="text-gray-400 hover:text-gray-500"
                        >
                          <MoreHorizontal className="h-5 w-5" />
                        </button>
                        {showActions === assessment.id && (
                          <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                            <div className="py-1" role="menu">
                              <button
                                onClick={() => {
                                  setSelectedAssessment(assessment);
                                  setShowEditModal(true);
                                  setShowActions(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteAssessment(assessment.id)}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredAssessments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                      No assessments found
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