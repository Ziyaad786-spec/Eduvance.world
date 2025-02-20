/*
  # Add High School Subjects

  1. New Data
    - Adds 10 new subjects to the subjects table:
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
    - Each subject is available for grades 10-12
    - Subjects are categorized as elective subjects
*/

-- Insert new subjects
INSERT INTO subjects (code, name_en, name_af, grade, category)
VALUES
  -- Grade 10
  ('ACC10', 'Accounting', 'Rekeningkunde', 10, 'elective'),
  ('AMP10', 'Agricultural Management Practices', 'Landboubestuurspraktyke', 10, 'elective'),
  ('AGS10', 'Agricultural Sciences', 'Landbouwetenskappe', 10, 'elective'),
  ('BUS10', 'Business Studies', 'Besigheidstudies', 10, 'elective'),
  ('CAT10', 'Computer Applications Technology', 'Rekenaartoepassingstegnologie', 10, 'elective'),
  ('CST10', 'Consumer Studies', 'Verbruikerstudies', 10, 'elective'),
  ('DRA10', 'Dramatic Arts', 'Dramatiese Kunste', 10, 'elective'),
  ('ECO10', 'Economics', 'Ekonomie', 10, 'elective'),
  ('EGD10', 'Engineering Graphics and Design', 'Ingenieursgrafika en -ontwerp', 10, 'elective'),
  ('GEO10', 'Geography', 'Geografie', 10, 'elective'),

  -- Grade 11
  ('ACC11', 'Accounting', 'Rekeningkunde', 11, 'elective'),
  ('AMP11', 'Agricultural Management Practices', 'Landboubestuurspraktyke', 11, 'elective'),
  ('AGS11', 'Agricultural Sciences', 'Landbouwetenskappe', 11, 'elective'),
  ('BUS11', 'Business Studies', 'Besigheidstudies', 11, 'elective'),
  ('CAT11', 'Computer Applications Technology', 'Rekenaartoepassingstegnologie', 11, 'elective'),
  ('CST11', 'Consumer Studies', 'Verbruikerstudies', 11, 'elective'),
  ('DRA11', 'Dramatic Arts', 'Dramatiese Kunste', 11, 'elective'),
  ('ECO11', 'Economics', 'Ekonomie', 11, 'elective'),
  ('EGD11', 'Engineering Graphics and Design', 'Ingenieursgrafika en -ontwerp', 11, 'elective'),
  ('GEO11', 'Geography', 'Geografie', 11, 'elective'),

  -- Grade 12
  ('ACC12', 'Accounting', 'Rekeningkunde', 12, 'elective'),
  ('AMP12', 'Agricultural Management Practices', 'Landboubestuurspraktyke', 12, 'elective'),
  ('AGS12', 'Agricultural Sciences', 'Landbouwetenskappe', 12, 'elective'),
  ('BUS12', 'Business Studies', 'Besigheidstudies', 12, 'elective'),
  ('CAT12', 'Computer Applications Technology', 'Rekenaartoepassingstegnologie', 12, 'elective'),
  ('CST12', 'Consumer Studies', 'Verbruikerstudies', 12, 'elective'),
  ('DRA12', 'Dramatic Arts', 'Dramatiese Kunste', 12, 'elective'),
  ('ECO12', 'Economics', 'Ekonomie', 12, 'elective'),
  ('EGD12', 'Engineering Graphics and Design', 'Ingenieursgrafika en -ontwerp', 12, 'elective'),
  ('GEO12', 'Geography', 'Geografie', 12, 'elective')
ON CONFLICT (code) DO NOTHING;