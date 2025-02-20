export interface Database {
  public: {
    Tables: {
      students: {
        Row: Student;
        Insert: Omit<Student, 'id' | 'created_at' | 'updated_at' | 'student_number'>;
        Update: Partial<Omit<Student, 'id' | 'created_at' | 'updated_at' | 'student_number'>>;
      };
      subjects: {
        Row: Subject;
        Insert: Omit<Subject, 'id' | 'created_at'>;
        Update: Partial<Omit<Subject, 'id' | 'created_at'>>;
      };
      assessments: {
        Row: Assessment;
        Insert: Omit<Assessment, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Assessment, 'id' | 'created_at' | 'updated_at'>>;
      };
      report_cards: {
        Row: ReportCard;
        Insert: Omit<ReportCard, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ReportCard, 'id' | 'created_at' | 'updated_at'>>;
      };
      report_card_subjects: {
        Row: ReportCardSubject;
        Insert: Omit<ReportCardSubject, 'id' | 'created_at'>;
        Update: Partial<Omit<ReportCardSubject, 'id' | 'created_at'>>;
      };
      comments_library: {
        Row: CommentLibrary;
        Insert: Omit<CommentLibrary, 'id' | 'created_at'>;
        Update: Partial<Omit<CommentLibrary, 'id' | 'created_at'>>;
      };
    };
    Functions: {
      calculate_subject_average: {
        Args: {
          p_student_id: string;
          p_subject_id: string;
          p_term: number;
          p_year: number;
        };
        Returns: number;
      };
      generate_subject_comment: {
        Args: {
          p_subject_id: string;
          p_score: number;
          p_language: string;
        };
        Returns: string;
      };
      generate_student_number: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
  };
}

export interface Student {
  id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  grade: number;
  language: 'english' | 'afrikaans';
  parent_name: string;
  parent_email: string;
  parent_phone?: string;
  address?: string;
  created_at?: string;
  updated_at?: string;
  user_id: string;
}

export interface Subject {
  id: string;
  code: string;
  name_en: string;
  name_af: string;
  grade: number;
  category: 'core' | 'elective' | 'additional';
  created_at?: string;
}

export interface Assessment {
  id: string;
  student_id: string;
  subject_id: string;
  term: number;
  year: number;
  assessment_type: 'exam' | 'assignment' | 'practical' | 'project' | 'test';
  weight: number;
  score: number;
  comment?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ReportCard {
  id: string;
  student_id: string;
  term: number;
  year: number;
  status: 'draft' | 'published' | 'archived';
  teacher_comment?: string;
  principal_comment?: string;
  attendance_days: number;
  absent_days: number;
  generated_pdf?: string;
  created_at?: string;
  updated_at?: string;
  user_id: string;
}

export interface ReportCardSubject {
  id: string;
  report_card_id: string;
  subject_id: string;
  term_mark: number;
  year_to_date: number;
  subject_comment?: string;
  created_at?: string;
}

export interface CommentLibrary {
  id: string;
  category: 'positive' | 'constructive' | 'general' | 'subject_specific';
  language: 'english' | 'afrikaans';
  comment_text: string;
  subject_id?: string;
  performance_level?: 'excellent' | 'good' | 'average' | 'needs_improvement';
  created_at?: string;
}