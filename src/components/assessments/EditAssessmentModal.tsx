import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Assessment, Student, Subject } from '../../types/supabase';

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

interface EditAssessmentModalProps {
  assessment: Assessment & {
    student: Student;
    subject: Subject;
  };
  onClose: () => void;
  onAssessmentUpdated: (assessment: Assessment) => void;
}

export default function EditAssessmentModal({
  assessment,
  onClose,
  onAssessmentUpdated,
}: EditAssessmentModalProps) {
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AssessmentFormData>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: {
      student_id: assessment.student_id,
      subject_id: assessment.subject_id,
      term: assessment.term,
      year: assessment.year,
      assessment_type: assessment.assessment_type,
      weight: assessment.weight,
      score: assessment.score,
      comment: assessment.comment,
    },
  });

  const onSubmit = async (data: AssessmentFormData) => {
    try {
      setError(null);

      const { data: updatedAssessment, error: updateError } = await supabase
        .from('assessments')
        .update(data)
        .eq('id', assessment.id)
        .select()
        .single();

      if (updateError) throw updateError;
      if (updatedAssessment) {
        onAssessmentUpdated(updatedAssessment);
      }
    } catch (err) {
      console.error('Error updating assessment:', err);
      setError('Failed to update assessment. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Edit Assessment</h2>
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
            <input
              type="text"
              value={`${assessment.student.first_name} ${assessment.student.last_name}`}
              disabled
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-50 sm:text-sm"
            />
            <input type="hidden" {...register('student_id')} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Subject
            </label>
            <input
              type="text"
              value={assessment.subject.name_en}
              disabled
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-50 sm:text-sm"
            />
            <input type="hidden" {...register('subject_id')} />
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
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}