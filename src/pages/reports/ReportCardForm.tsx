import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Save,
  ArrowLeft,
  Plus,
  Trash2,
  GraduationCap,
  Book,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Student, Subject, ReportCard } from '../../types/supabase';

const reportCardSchema = z.object({
  student_id: z.string().uuid('Please select a student'),
  term: z.number().min(1, 'Term must be between 1 and 4').max(4),
  year: z.number().min(2020, 'Invalid year'),
  teacher_comment: z.string().optional(),
  principal_comment: z.string().optional(),
  attendance_days: z.number().min(0, 'Must be 0 or greater'),
  absent_days: z.number().min(0, 'Must be 0 or greater'),
  subjects: z.array(z.object({
    subject_id: z.string().uuid('Subject is required'),
    term_mark: z.number().min(0, 'Mark must be between 0 and 100').max(100),
    year_to_date: z.number().min(0, 'Mark must be between 0 and 100').max(100),
    subject_comment: z.string().optional(),
  })),
});

type ReportCardFormData = z.infer<typeof reportCardSchema>;

export default function ReportCardForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ReportCardFormData>({
    resolver: zodResolver(reportCardSchema),
    defaultValues: {
      term: Math.floor((new Date().getMonth() / 3)) + 1,
      year: new Date().getFullYear(),
      attendance_days: 0,
      absent_days: 0,
      subjects: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'subjects',
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

        if (isEditing && id) {
          const { data: reportCard, error: reportCardError } = await supabase
            .from('report_cards')
            .select(`
              *,
              subjects:report_card_subjects(*)
            `)
            .eq('id', id)
            .single();

          if (reportCardError) throw reportCardError;

          if (reportCard) {
            setValue('student_id', reportCard.student_id);
            setValue('term', reportCard.term);
            setValue('year', reportCard.year);
            setValue('teacher_comment', reportCard.teacher_comment || '');
            setValue('principal_comment', reportCard.principal_comment || '');
            setValue('attendance_days', reportCard.attendance_days);
            setValue('absent_days', reportCard.absent_days);
            setValue('subjects', reportCard.subjects);
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, setValue, isEditing]);

  const onSubmit = async (data: ReportCardFormData) => {
    try {
      setError(null);

      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setError('You must be logged in to create report cards');
        return;
      }

      if (isEditing) {
        // Update existing report card
        const { error: updateError } = await supabase
          .from('report_cards')
          .update({
            student_id: data.student_id,
            term: data.term,
            year: data.year,
            teacher_comment: data.teacher_comment,
            principal_comment: data.principal_comment,
            attendance_days: data.attendance_days,
            absent_days: data.absent_days,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (updateError) throw updateError;

        // Update subject marks
        const { error: subjectsError } = await supabase
          .from('report_card_subjects')
          .upsert(
            data.subjects.map(subject => ({
              report_card_id: id,
              ...subject,
            }))
          );

        if (subjectsError) throw subjectsError;
      } else {
        // Create new report card
        const { data: reportCard, error: insertError } = await supabase
          .from('report_cards')
          .insert({
            student_id: data.student_id,
            term: data.term,
            year: data.year,
            teacher_comment: data.teacher_comment,
            principal_comment: data.principal_comment,
            attendance_days: data.attendance_days,
            absent_days: data.absent_days,
            status: 'draft',
            user_id: user.id,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Create subject marks
        const { error: subjectsError } = await supabase
          .from('report_card_subjects')
          .insert(
            data.subjects.map(subject => ({
              report_card_id: reportCard.id,
              ...subject,
            }))
          );

        if (subjectsError) throw subjectsError;
      }

      navigate('/report-cards');
    } catch (error) {
      console.error('Error saving report card:', error);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  const handleAddSubject = () => {
    append({
      subject_id: '',
      term_mark: 0,
      year_to_date: 0,
      subject_comment: '',
    });
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
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/report-cards')}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">
            {isEditing ? 'Edit Report Card' : 'New Report Card'}
          </h1>
        </div>
        <button
          type="button"
          onClick={handleSubmit(onSubmit)}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <Save className="h-4 w-4 mr-2" />
          Save Report Card
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

      <form className="space-y-8">
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <label className="block text-sm font-medium text-gray-700">
                Student
              </label>
              <select
                {...register('student_id')}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                disabled={isEditing}
              >
                <option value="">Select a student</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.first_name} {student.last_name} (Grade {student.grade})
                  </option>
                ))}
              </select>
              {errors.student_id && (
                <p className="mt-2 text-sm text-red-600">
                  {errors.student_id.message}
                </p>
              )}
            </div>

            <div className="sm:col-span-3">
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
                <p className="mt-2 text-sm text-red-600">{errors.term.message}</p>
              )}
            </div>

            <div className="sm:col-span-3">
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
                <p className="mt-2 text-sm text-red-600">{errors.year.message}</p>
              )}
            </div>

            <div className="sm:col-span-3">
              <label className="block text-sm font-medium text-gray-700">
                Attendance
              </label>
              <div className="mt-1 flex space-x-4">
                <div>
                  <label className="block text-xs text-gray-500">
                    Total Days
                  </label>
                  <input
                    type="number"
                    {...register('attendance_days', { valueAsNumber: true })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500">
                    Days Absent
                  </label>
                  <input
                    type="number"
                    {...register('absent_days', { valueAsNumber: true })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Teacher's Comment
            </label>
            <textarea
              {...register('teacher_comment')}
              rows={3}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Principal's Comment
            </label>
            <textarea
              {...register('principal_comment')}
              rows={3}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900">Subject Marks</h3>
            <button
              type="button"
              onClick={handleAddSubject}
              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Subject
            </button>
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex-grow grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Subject
                    </label>
                    <select
                      {...register(`subjects.${index}.subject_id`)}
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
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Term Mark (%)
                    </label>
                    <input
                      type="number"
                      {...register(`subjects.${index}.term_mark`, { valueAsNumber: true })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Year to Date (%)
                    </label>
                    <input
                      type="number"
                      {...register(`subjects.${index}.year_to_date`, { valueAsNumber: true })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Comment
                    </label>
                    <input
                      type="text"
                      {...register(`subjects.${index}.subject_comment`)}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}

            {fields.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No subjects added yet. Click "Add Subject" to add one.
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}