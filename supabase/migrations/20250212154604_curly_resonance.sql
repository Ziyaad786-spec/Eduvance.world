/*
  # Add South African compulsory school subjects

  1. New Subjects
    - Adds all compulsory subjects for grades R-12
    - Includes both English and Afrikaans names
    - Sets appropriate categories (core/fundamental)

  2. Changes
    - Adds Home Language subjects
    - Adds First Additional Language subjects
    - Adds Mathematics/Mathematical Literacy
    - Adds Life Orientation/Life Skills
    - Adds Natural Sciences
    - Adds Social Sciences
    - Adds Technology
    - Adds Creative Arts
    - Adds Economic Management Sciences
*/

-- Insert compulsory subjects
INSERT INTO subjects (code, name_en, name_af, grade, category)
SELECT 
  s.code || CASE 
    WHEN s.grade = 0 THEN 'R'
    WHEN s.grade < 10 THEN LPAD(s.grade::text, 2, '0')
    ELSE s.grade::text
  END,
  s.name_en,
  s.name_af,
  s.grade,
  'core'
FROM (
  -- Cross join between subjects and grades
  SELECT 
    code, name_en, name_af, grade
  FROM 
    (VALUES
      -- Languages (Home Language and First Additional Language)
      ('ENHL', 'English Home Language', 'Engels Huistaal'),
      ('AFHL', 'Afrikaans Home Language', 'Afrikaans Huistaal'),
      ('ENFA', 'English First Additional Language', 'Engels Eerste Addisionele Taal'),
      ('AFFA', 'Afrikaans First Additional Language', 'Afrikaans Eerste Addisionele Taal'),
      
      -- Mathematics
      ('MATH', 'Mathematics', 'Wiskunde'),
      ('MLIT', 'Mathematical Literacy', 'Wiskundige Geletterdheid'),
      
      -- Life Skills/Orientation
      ('LIFE', 'Life Skills', 'Lewensvaardighede'),
      ('LORI', 'Life Orientation', 'Lewensoriëntering'),
      
      -- Natural Sciences
      ('NSCI', 'Natural Sciences', 'Natuurwetenskappe'),
      ('NSTECH', 'Natural Sciences and Technology', 'Natuurwetenskappe en Tegnologie'),
      
      -- Social Sciences
      ('SSCI', 'Social Sciences', 'Sosiale Wetenskappe'),
      ('HIST', 'History', 'Geskiedenis'),
      ('GEOG', 'Geography', 'Geografie'),
      
      -- Technology and Arts
      ('TECH', 'Technology', 'Tegnologie'),
      ('CART', 'Creative Arts', 'Skeppende Kunste'),
      
      -- Economic and Management Sciences
      ('EMS', 'Economic and Management Sciences', 'Ekonomiese en Bestuurswetenskappe')
    ) AS subjects(code, name_en, name_af)
  CROSS JOIN
    -- Generate for grades 1-12 (no grade R for these subjects)
    (VALUES (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (11), (12)) AS grades(grade)
  WHERE
    -- Apply grade-specific filters
    (
      -- Life Skills only for Foundation Phase (1-3)
      (code = 'LIFE' AND grade <= 3) OR
      -- Life Orientation from Grade 4-12
      (code = 'LORI' AND grade >= 4) OR
      -- Mathematical Literacy only for FET Phase (10-12)
      (code = 'MLIT' AND grade >= 10) OR
      -- Natural Sciences and Technology for Intermediate Phase (4-6)
      (code = 'NSTECH' AND grade BETWEEN 4 AND 6) OR
      -- Natural Sciences for Senior Phase (7-9)
      (code = 'NSCI' AND grade BETWEEN 7 AND 9) OR
      -- Technology for Senior Phase (7-9)
      (code = 'TECH' AND grade BETWEEN 7 AND 9) OR
      -- Creative Arts for Intermediate and Senior Phase (4-9)
      (code = 'CART' AND grade BETWEEN 4 AND 9) OR
      -- EMS for Senior Phase (7-9)
      (code = 'EMS' AND grade BETWEEN 7 AND 9) OR
      -- Languages and Mathematics for all grades
      (code IN ('ENHL', 'AFHL', 'ENFA', 'AFFA', 'MATH') AND grade >= 1)
    )
) s
ON CONFLICT (code) DO NOTHING;