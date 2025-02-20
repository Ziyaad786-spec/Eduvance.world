import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Send,
  Edit,
  GraduationCap,
  Calendar,
  Clock,
  User,
} from 'lucide-react';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../../lib/supabase';
import { useSettingsStore } from '../../store/settings';
import type { ReportCard, Student, Subject } from '../../types/supabase';

type ReportCardWithDetails = ReportCard & {
  student: Student;
  subjects: Array<{
    subject: Subject;
    term_mark: number;
    year_to_date: number;
    subject_comment?: string;
  }>;
};

export default function ReportCardView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [reportCard, setReportCard] = useState<ReportCardWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const { companyDetails } = useSettingsStore();

  useEffect(() => {
    const fetchReportCard = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('report_cards')
          .select(`
            *,
            student:students(*),
            subjects:report_card_subjects(
              *,
              subject:subjects(*)
            )
          `)
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;
        setReportCard(data);
      } catch (err) {
        console.error('Error fetching report card:', err);
        setError('Failed to load report card. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchReportCard();
    }
  }, [id]);

  const handlePublish = async () => {
    if (!reportCard) return;

    try {
      const { error: updateError } = await supabase
        .from('report_cards')
        .update({
          status: 'published',
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportCard.id);

      if (updateError) throw updateError;

      setReportCard(prev => prev ? {
        ...prev,
        status: 'published',
        updated_at: new Date().toISOString(),
      } : null);
    } catch (err) {
      console.error('Error publishing report card:', err);
      alert('Failed to publish report card. Please try again.');
    }
  };

  const generatePDF = async () => {
    if (!reportCard) return;

    try {
      setDownloading(true);
      const doc = new jsPDF();

      // Add school logo if available
      if (companyDetails.schoolLogo) {
        try {
          // Add logo at the top center
          const logoWidth = 40;
          const logoHeight = 40;
          const pageWidth = doc.internal.pageSize.width;
          const xPosition = (pageWidth - logoWidth) / 2;
          
          doc.addImage(
            companyDetails.schoolLogo,
            'PNG',
            xPosition,
            15,
            logoWidth,
            logoHeight,
            undefined,
            'FAST'
          );

          // Adjust starting Y position for text to accommodate logo
          doc.setFontSize(24);
          doc.setTextColor(59, 130, 246);
          doc.text('EDUVANCE ACADEMY', pageWidth / 2, 70, { align: 'center' });

          doc.setFontSize(18);
          doc.text('STUDENT PROGRESS REPORT', pageWidth / 2, 80, { align: 'center' });

          doc.setFontSize(14);
          doc.setTextColor(0);
          doc.text(`Term ${reportCard.term} - ${reportCard.year}`, pageWidth / 2, 90, { align: 'center' });

          // Adjust student information position
          doc.setFontSize(12);
          doc.text('Student Information', 20, 110);
          doc.setFontSize(10);
          doc.text(`Name: ${reportCard.student.first_name} ${reportCard.student.last_name}`, 20, 120);
          doc.text(`Grade: ${reportCard.student.grade}`, 20, 125);
          doc.text(`Language: ${reportCard.student.language.charAt(0).toUpperCase() + reportCard.student.language.slice(1)}`, 20, 130);

          // Adjust attendance information position
          doc.setFontSize(12);
          doc.text('Attendance', 20, 145);
          doc.setFontSize(10);
          doc.text(`Days Present: ${reportCard.attendance_days - reportCard.absent_days}`, 20, 155);
          doc.text(`Days Absent: ${reportCard.absent_days}`, 20, 160);
          doc.text(`Total Days: ${reportCard.attendance_days}`, 20, 165);

          // Adjust subject results table position
          autoTable(doc, {
            startY: 180,
            head: [['Subject', 'Term Mark', 'Year to Date', 'Comment']],
            body: reportCard.subjects.map(subject => [
              subject.subject.name_en,
              `${subject.term_mark}%`,
              `${subject.year_to_date}%`,
              subject.subject_comment || ''
            ]),
            headStyles: { 
              fillColor: [59, 130, 246],
              textColor: [255, 255, 255]
            },
            styles: {
              fontSize: 10,
              cellPadding: 5
            },
            columnStyles: {
              0: { cellWidth: 60 },
              1: { cellWidth: 30, halign: 'center' },
              2: { cellWidth: 30, halign: 'center' },
              3: { cellWidth: 'auto' }
            }
          });
        } catch (logoError) {
          console.error('Error adding logo:', logoError);
          // Continue without logo if there's an error
          generatePDFWithoutLogo(doc, reportCard);
        }
      } else {
        // Generate PDF without logo
        generatePDFWithoutLogo(doc, reportCard);
      }

      // Add comments section
      const finalY = (doc as any).lastAutoTable.finalY + 20;
      
      if (reportCard.teacher_comment) {
        doc.setFontSize(12);
        doc.text("Teacher's Comment:", 20, finalY);
        doc.setFontSize(10);
        doc.text(reportCard.teacher_comment, 20, finalY + 10, {
          maxWidth: doc.internal.pageSize.width - 40
        });
      }

      if (reportCard.principal_comment) {
        const principalY = finalY + (reportCard.teacher_comment ? 30 : 0);
        doc.setFontSize(12);
        doc.text("Principal's Comment:", 20, principalY);
        doc.setFontSize(10);
        doc.text(reportCard.principal_comment, 20, principalY + 10, {
          maxWidth: doc.internal.pageSize.width - 40
        });
      }

      // Add signature lines
      const signatureY = doc.internal.pageSize.height - 40;
      doc.setFontSize(10);
      doc.text('_____________________', 30, signatureY);
      doc.text('_____________________', doc.internal.pageSize.width - 80, signatureY);
      doc.text('Class Teacher', 40, signatureY + 10);
      doc.text('Principal', doc.internal.pageSize.width - 65, signatureY + 10);

      // Add date
      doc.text(`Generated on: ${format(new Date(), 'MMMM d, yyyy')}`, 20, doc.internal.pageSize.height - 10);

      // Save the PDF
      doc.save(`report-card-${reportCard.student.first_name}-${reportCard.student.last_name}-term${reportCard.term}-${reportCard.year}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const generatePDFWithoutLogo = (doc: jsPDF, reportCard: ReportCardWithDetails) => {
    const pageWidth = doc.internal.pageSize.width;

    doc.setFontSize(24);
    doc.setTextColor(59, 130, 246);
    doc.text('EDUVANCE ACADEMY', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(18);
    doc.text('STUDENT PROGRESS REPORT', pageWidth / 2, 30, { align: 'center' });

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(`Term ${reportCard.term} - ${reportCard.year}`, pageWidth / 2, 40, { align: 'center' });

    doc.setFontSize(12);
    doc.text('Student Information', 20, 60);
    doc.setFontSize(10);
    doc.text(`Name: ${reportCard.student.first_name} ${reportCard.student.last_name}`, 20, 70);
    doc.text(`Grade: ${reportCard.student.grade}`, 20, 75);
    doc.text(`Language: ${reportCard.student.language.charAt(0).toUpperCase() + reportCard.student.language.slice(1)}`, 20, 80);

    doc.setFontSize(12);
    doc.text('Attendance', 20, 95);
    doc.setFontSize(10);
    doc.text(`Days Present: ${reportCard.attendance_days - reportCard.absent_days}`, 20, 105);
    doc.text(`Days Absent: ${reportCard.absent_days}`, 20, 110);
    doc.text(`Total Days: ${reportCard.attendance_days}`, 20, 115);

    autoTable(doc, {
      startY: 130,
      head: [['Subject', 'Term Mark', 'Year to Date', 'Comment']],
      body: reportCard.subjects.map(subject => [
        subject.subject.name_en,
        `${subject.term_mark}%`,
        `${subject.year_to_date}%`,
        subject.subject_comment || ''
      ]),
      headStyles: { 
        fillColor: [59, 130, 246],
        textColor: [255, 255, 255]
      },
      styles: {
        fontSize: 10,
        cellPadding: 5
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 'auto' }
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !reportCard) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-red-600">
          {error || 'Report card not found'}
        </h2>
        <button
          onClick={() => navigate('/report-cards')}
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Report Cards
        </button>
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
            Report Card
          </h1>
        </div>
        <div className="flex space-x-4">
          <button
            onClick={generatePDF}
            disabled={downloading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4 mr-2" />
            {downloading ? 'Generating PDF...' : 'Download PDF'}
          </button>
          {reportCard.status === 'draft' && (
            <>
              <button
                onClick={() => navigate(`/report-cards/${reportCard.id}/edit`)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </button>
              <button
                onClick={handlePublish}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Send className="h-4 w-4 mr-2" />
                Publish
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <div className="flex items-center space-x-2 text-gray-500 text-sm">
                <GraduationCap className="h-4 w-4" />
                <span>Student Information</span>
              </div>
              <div className="mt-2 space-y-2">
                <p className="text-lg font-medium">
                  {reportCard.student.first_name} {reportCard.student.last_name}
                </p>
                <p className="text-gray-600">
                  Grade {reportCard.student.grade}
                </p>
                <p className="text-gray-600">
                  {reportCard.student.language.charAt(0).toUpperCase() + reportCard.student.language.slice(1)}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-2 text-gray-500 text-sm">
                <Calendar className="h-4 w-4" />
                <span>Report Period</span>
              </div>
              <div className="mt-2 space-y-2">
                <p className="text-lg font-medium">
                  Term {reportCard.term}, {reportCard.year}
                </p>
                <p className="text-gray-600">
                  Last Updated: {format(new Date(reportCard.updated_at || reportCard.created_at), 'MMM d, yyyy')}
                </p>
                <p className="text-gray-600">
                  Status: <span className="capitalize">{reportCard.status}</span>
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-2 text-gray-500 text-sm">
                <Clock className="h-4 w-4" />
                <span>Attendance</span>
              </div>
              <div className="mt-2 space-y-2">
                <p className="text-lg font-medium">
                  {reportCard.attendance_days - reportCard.absent_days} / {reportCard.attendance_days} Days
                </p>
                <p className="text-gray-600">
                  {reportCard.absent_days} Days Absent
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Subject Results
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subject
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Term Mark
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year to Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Comment
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportCard.subjects.map((subject) => (
                    <tr key={subject.subject.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-gray-900">
                            {subject.subject.name_en}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm text-gray-900">
                          {subject.term_mark}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm text-gray-900">
                          {subject.year_to_date}%
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-500">
                          {subject.subject_comment || 'No comment'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 space-y-6">
            <div>
              <div className="flex items-center space-x-2 text-gray-500 text-sm mb-2">
                <User className="h-4 w-4" />
                <span>Teacher's Comment</span>
              </div>
              <p className="text-gray-900 bg-gray-50 rounded-lg p-4">
                {reportCard.teacher_comment || 'No comment'}
              </p>
            </div>

            <div>
              <div className="flex items-center space-x-2 text-gray-500 text-sm mb-2">
                <User className="h-4 w-4" />
                <span>Principal's Comment</span>
              </div>
              <p className="text-gray-900 bg-gray-50 rounded-lg p-4">
                {reportCard.principal_comment || 'No comment'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}