alter table public.timber_materials
  add constraint timber_materials_height_normalized check (height = btrim(height)),
  add constraint timber_materials_width_normalized check (width = btrim(width)),
  add constraint timber_materials_length_normalized check (length = btrim(length)),
  add constraint timber_materials_grade_normalized check (grade = btrim(grade)),
  add constraint timber_materials_treatment_normalized check (treatment = btrim(treatment));
