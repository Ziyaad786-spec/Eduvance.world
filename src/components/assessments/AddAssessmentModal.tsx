import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Student, Subject } from '../../types/supabase';

const assessmentSchema = z.object({
  student_id: z.string().uuid('Please select a student'),
  subject_id: z.string().uuid('Please select a subject'),
  term: z.number().min(1, 'Term must be between 1 and 4').max(4),
  year: z.number().min(2020, 'Invalid year'),
  assessment_type: z.enum(['exam', 'assignment', 'practical', 'project', 'test']),
  weight: z.number().min(0, 'Weight must be between 0 and 100').max(100),
  score: z.number().min(0, 'Score must be between 0 and 100').max(100),
  comment: z.string().optional(),
});

type AssessmentFormData = z.infer<typeof assessmentSchema>;

interface AddAssessmentModalProps {
  onClose: () => void;
  onAssessmentAdded: (assessment: AssessmentFormData & { id: string }) => void;
}

export default function AddAssessmentModal({
  onClose,
  onAssessmentAdded,
}: AddAssessmentModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AssessmentFormData>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: {
      term: new Date().getMonth() < 3 ? 1 : 
            new Date().getMonth() < 6 ? 2 :
            new Date().getMonth() < 9 ? 3 : 4,
      year: new Date().getFullYear(),
      assessment_type: 'test',
      weight: 100,
    },
  });

  const selectedStudentId = watch('student_id');
  const selectedStudent = students.find(s => s.id === selectedStudentId);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch students
        const { data: studentsData, error: studentsError } = await supabase
          .from('students')
          .select('*')
          .order('grade', { ascending: true })
          .order('last_name', { ascending: true });

        if (studentsError) throw studentsError;

        // Fetch subjects
        const { data: subjectsData, error: subjectsError } = await supabase
          .from('subjects')
          .select('*')
          .order('name_en', { ascending: true });

        if (subjectsError) throw subjectsError;

        setStudents(studentsData || []);
        setSubjects(subjectsData || []);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load required data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const onSubmit = async (data: AssessmentFormData) => {
    try {
      setError(null);

      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setError('You must be logged in to add assessments');
        return;
      }

      const { data: assessment, error: insertError } = await supabase
        .from('assessments')
        .insert({
          ...data,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      if (assessment) {
        onAssessmentAdded(assessment);
      }
    } catch (err) {
      console.error('Error adding assessment:', err);
      setError('Failed to add assessment. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Add Assessment</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Student
            </label>
            <select
              {...register('student_id')}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="">Select a student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.first_name} {student.last_name} (Grade {student.grade})
                </option>
              ))}
            </select>
            {errors.student_id && (
              <p className="mt-1 text-sm text-red-600">
                {errors.student_id.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Subject
            </label>
            <select
              {...register('subject_id')}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="">Select a subject</option>
              {subjects
                .filter(subject => !selectedStudent || subject.grade === selectedStudent.grade)
                .map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name_en}
                  </option>
                ))}
            </select>
            {errors.subject_id && (
              <p className="mt-1 text-sm text-red-600">
                {errors.subject_id.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Term
              </label>
              <select
                {...register('term', { valueAsNumber: true })}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                {[1, 2, 3, 4].map(term => (
                  <option key={term} value={term}>Term {term}</option>
                ))}
              </select>
              {errors.term && (
                <p className="mt-1 text-sm text-red-600">{errors.term.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Year
              </label>
              <select
                {...register('year', { valueAsNumber: true })}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                {[...Array(5)].map((_, i) => {
                  const year = new Date().getFullYear() - i;
                  return (
                    <option key={year} value={year}>{year}</option>
                  );
                })}
              </select>
              {errors.year && (
                <p className="mt-1 text-sm text-red-600">{errors.year.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Assessment Type
            </label>
            <select
              {...register('assessment_type')}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="exam">Exam</option>
              <option value="assignment">Assignment</option>
              <option value="practical">Practical</option>
              <option value="project">Project</option>
              <option value="test">Test</option>
            </select>
            {errors.assessment_type && (
              <p className="mt-1 text-sm text-red-600">
                {errors.assessment_type.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Weight (%)
              </label>
              <input
                type="number"
                {...register('weight', { valueAsNumber: true })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              {errors.weight && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.weight.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Score (%)
              </label>
              <input
                type="number"
                {...register('score', { valueAsNumber: true })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              {errors.score && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.score.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Comment (Optional)
            </label>
            <textarea
              {...register('comment')}
              rows={3}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
            {errors.comment && (
              <p className="mt-1 text-sm text-red-600">
                {errors.comment.message}
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Add Assessment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}