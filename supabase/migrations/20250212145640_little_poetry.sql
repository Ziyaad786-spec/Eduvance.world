/*
  # Student Report Card System Schema

  1. New Tables
    - `students`
      - Basic student information
      - Parent contact details
      - Academic history
    
    - `subjects`
      - IMPAQ curriculum subjects
      - Grade-specific subject mappings
    
    - `assessments`
      - Student assessment records
      - Weighted scoring system
      - Term-based evaluations
    
    - `report_cards`
      - Generated report cards
      - Term and final reports
      - Performance tracking
    
    - `comments_library`
      - Pre-defined teacher comments
      - Subject-specific feedback templates
    
  2. Security
    - Enable RLS on all tables
    - Policies for teachers and admin access
    - Parent/student view restrictions
*/

-- Create students table
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  student_number text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date NOT NULL,
  grade int NOT NULL CHECK (grade BETWEEN 1 AND 12),
  language text NOT NULL CHECK (language IN ('english', 'afrikaans')),
  parent_name text NOT NULL,
  parent_email text NOT NULL,
  parent_phone text,
  address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_en text NOT NULL,
  name_af text NOT NULL,
  grade int NOT NULL CHECK (grade BETWEEN 1 AND 12),
  category text NOT NULL CHECK (category IN ('core', 'elective', 'additional')),
  created_at timestamptz DEFAULT now()
);

-- Create assessments table
CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id),
  term int NOT NULL CHECK (term BETWEEN 1 AND 4),
  year int NOT NULL,
  assessment_type text NOT NULL CHECK (
    assessment_type IN ('exam', 'assignment', 'practical', 'project', 'test')
  ),
  weight numeric NOT NULL CHECK (weight BETWEEN 0 AND 100),
  score numeric NOT NULL CHECK (score BETWEEN 0 AND 100),
  comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create report_cards table
CREATE TABLE IF NOT EXISTS report_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  term int NOT NULL CHECK (term BETWEEN 1 AND 4),
  year int NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'published', 'archived')
  ),
  teacher_comment text,
  principal_comment text,
  attendance_days int NOT NULL DEFAULT 0,
  absent_days int NOT NULL DEFAULT 0,
  generated_pdf text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, term, year)
);

-- Create report_card_subjects table for subject-specific results
CREATE TABLE IF NOT EXISTS report_card_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_card_id uuid REFERENCES report_cards(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id),
  term_mark numeric NOT NULL CHECK (term_mark BETWEEN 0 AND 100),
  year_to_date numeric NOT NULL CHECK (year_to_date BETWEEN 0 AND 100),
  subject_comment text,
  created_at timestamptz DEFAULT now()
);

-- Create comments_library table
CREATE TABLE IF NOT EXISTS comments_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (
    category IN ('positive', 'constructive', 'general', 'subject_specific')
  ),
  language text NOT NULL CHECK (language IN ('english', 'afrikaans')),
  comment_text text NOT NULL,
  subject_id uuid REFERENCES subjects(id),
  performance_level text CHECK (
    performance_level IN ('excellent', 'good', 'average', 'needs_improvement')
  ),
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_card_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments_library ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own students"
  ON students FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own students"
  ON students FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view subjects"
  ON subjects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can view and manage assessments for their students"
  ON assessments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = assessments.student_id
      AND students.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view and manage report cards for their students"
  ON report_cards FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = report_cards.student_id
      AND students.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view and manage report card subjects"
  ON report_card_subjects FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM report_cards
      JOIN students ON report_cards.student_id = students.id
      WHERE report_cards.id = report_card_subjects.report_card_id
      AND students.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view comments library"
  ON comments_library FOR SELECT
  TO authenticated
  USING (true);

-- Function to calculate subject averages
CREATE OR REPLACE FUNCTION calculate_subject_average(
  p_student_id UUID,
  p_subject_id UUID,
  p_term INT,
  p_year INT
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_average numeric;
BEGIN
  SELECT
    SUM(score * weight) / SUM(weight)
  INTO v_average
  FROM assessments
  WHERE
    student_id = p_student_id
    AND subject_id = p_subject_id
    AND term = p_term
    AND year = p_year;
    
  RETURN COALESCE(v_average, 0);
END;
$$;

-- Function to generate AI-based comments
CREATE OR REPLACE FUNCTION generate_subject_comment(
  p_subject_id UUID,
  p_score numeric,
  p_language text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_performance_level text;
  v_comment text;
BEGIN
  -- Determine performance level
  v_performance_level := CASE
    WHEN p_score >= 80 THEN 'excellent'
    WHEN p_score >= 70 THEN 'good'
    WHEN p_score >= 50 THEN 'average'
    ELSE 'needs_improvement'
  END;
  
  -- Select appropriate comment
  SELECT comment_text
  INTO v_comment
  FROM comments_library
  WHERE
    subject_id = p_subject_id
    AND language = p_language
    AND performance_level = v_performance_level
  ORDER BY random()
  LIMIT 1;
  
  RETURN COALESCE(v_comment, 'No comment available.');
END;
$$;

-- Function to generate student number
CREATE OR REPLACE FUNCTION generate_student_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  year text;
  next_number integer;
  student_number text;
BEGIN
  year := to_char(current_date, 'YYYY');
  
  SELECT COALESCE(
    (SELECT MAX(CAST(SUBSTRING(student_number FROM '\d{4}-(\d+)') AS integer))
     FROM students
     WHERE student_number LIKE year || '-%'
    ), 0) + 1
  INTO next_number;
  
  student_number := year || '-' || LPAD(next_number::text, 4, '0');
  
  RETURN student_number;
END;
$$;

-- Trigger to update student number before insert
CREATE OR REPLACE FUNCTION set_student_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.student_number IS NULL THEN
    NEW.student_number := generate_student_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_student_number_trigger
  BEFORE INSERT ON students
  FOR EACH ROW
  EXECUTE FUNCTION set_student_number();