/*
  # Add Primary School Subjects

  1. New Data
    - Adds 10 subjects for grades R through 9:
      - Accounting
      - Agricultural Management Practices
      - Agricultural Sciences
      - Business Studies
      - Computer Applications Technology (CAT)
      - Consumer Studies
      - Dramatic Arts
      - Economics
      - Engineering Graphics and Design (EGD)
      - Geography

  2. Changes
    - Inserts new subjects with both English and Afrikaans names
    - Each subject is added for grades R through 9
    - Subjects are categorized appropriately for each grade level
*/

-- Insert new subjects for grades R-9
INSERT INTO subjects (code, name_en, name_af, grade, category)
SELECT 
  -- Generate code by combining subject code and grade
  CASE 
    WHEN s.grade = 1 THEN s.code || '01'  -- Grade 1
    WHEN s.grade = 2 THEN s.code || '02'  -- Grade 2
    WHEN s.grade = 3 THEN s.code || '03'  -- Grade 3
    WHEN s.grade = 4 THEN s.code || '04'  -- Grade 4
    WHEN s.grade = 5 THEN s.code || '05'  -- Grade 5
    WHEN s.grade = 6 THEN s.code || '06'  -- Grade 6
    WHEN s.grade = 7 THEN s.code || '07'  -- Grade 7
    WHEN s.grade = 8 THEN s.code || '08'  -- Grade 8
    WHEN s.grade = 9 THEN s.code || '09'  -- Grade 9
  END,
  s.name_en,
  s.name_af,
  s.grade,
  -- Primary grades have different categories
  CASE 
    WHEN s.grade <= 3 THEN 'core'  -- Foundation phase: all subjects are core
    WHEN s.grade <= 7 THEN 'core'  -- Intermediate phase: all subjects are core
    ELSE 'elective'                -- Senior phase: subjects can be elective
  END
FROM (
  -- Cross join between subjects and grades
  SELECT 
    code, name_en, name_af, grade
  FROM 
    (VALUES
      ('ACC', 'Accounting', 'Rekeningkunde'),
      ('AMP', 'Agricultural Management Practices', 'Landboubestuurspraktyke'),
      ('AGS', 'Agricultural Sciences', 'Landbouwetenskappe'),
      ('BUS', 'Business Studies', 'Besigheidstudies'),
      ('CAT', 'Computer Applications Technology', 'Rekenaartoepassingstegnologie'),
      ('CST', 'Consumer Studies', 'Verbruikerstudies'),
      ('DRA', 'Dramatic Arts', 'Dramatiese Kunste'),
      ('ECO', 'Economics', 'Ekonomie'),
      ('EGD', 'Engineering Graphics and Design', 'Ingenieursgrafika en -ontwerp'),
      ('GEO', 'Geography', 'Geografie')
    ) AS subjects(code, name_en, name_af)
  CROSS JOIN
    (VALUES (1), (2), (3), (4), (5), (6), (7), (8), (9)) AS grades(grade)
) s
ON CONFLICT (code) DO NOTHING;