-- Limpiar datos existentes (opcional, cuidado en producción)
-- truncate table public.tasks cascade;
-- truncate table public.patients cascade;

-- Insertar Pacientes (Camas 87-100)
INSERT INTO public.patients (bed_number, diagnosis, status, admission_date) VALUES
('87', 'Neumonía NAC III', 'stable', now() - interval '2 days'),
('88', 'ICC descompensada', 'critical', now() - interval '1 day'),
('89', 'ACV Isquémico', 'stable', now() - interval '5 days'),
('90', 'ITU complicada', 'stable', now() - interval '3 days'),
('91', 'EPOC exacerbado', 'stable', now() - interval '4 days'),
('92', 'Celulitis ID', 'discharge_ready', now() - interval '7 days'),
('93', 'Fibrilación Auricular', 'stable', now() - interval '1 day'),
('94', 'TEP probable', 'critical', now() - interval '12 hours'),
('95', 'Cetoacidosis Diabética', 'stable', now() - interval '2 days'),
('96', 'Insuficiencia Renal Aguda', 'stable', now() - interval '3 days'),
('97', 'Hemorragia Digestiva Alta', 'critical', now() - interval '6 hours'),
('98', 'Cirrosis descompensada', 'stable', now() - interval '10 days'),
('99', 'Pancreatitis Aguda', 'stable', now() - interval '4 days'),
('100', 'Sepsis foco urinario', 'stable', now() - interval '2 days');

-- Insertar Tareas para cada paciente

-- Cama 87: Neumonía
INSERT INTO public.tasks (patient_id, description, type, due_date)
SELECT id, 'Tomar Rx Tórax control', 'imaging', now() + interval '1 day'
FROM public.patients WHERE bed_number = '87';

INSERT INTO public.tasks (patient_id, description, type, due_date)
SELECT id, 'Controlar SatO2 c/4h', 'procedure', now() + interval '4 hours'
FROM public.patients WHERE bed_number = '87';

-- Cama 88: ICC
INSERT INTO public.tasks (patient_id, description, type, due_date)
SELECT id, 'Balance hídrico estricto', 'procedure', now() + interval '2 hours'
FROM public.patients WHERE bed_number = '88';

INSERT INTO public.tasks (patient_id, description, type, due_date)
SELECT id, 'Dosar Pro-BNP', 'lab', now() + interval '12 hours'
FROM public.patients WHERE bed_number = '88';

-- Cama 89: ACV
INSERT INTO public.tasks (patient_id, description, type, due_date)
SELECT id, 'Terapia física', 'procedure', now() + interval '1 day'
FROM public.patients WHERE bed_number = '89';

-- Cama 90: ITU
INSERT INTO public.tasks (patient_id, description, type, due_date)
SELECT id, 'Ver urocultivo', 'lab', now()
FROM public.patients WHERE bed_number = '90';

-- Cama 91: EPOC
INSERT INTO public.tasks (patient_id, description, type, due_date)
SELECT id, 'Nebulización c/fenoterol', 'procedure', now() + interval '6 hours'
FROM public.patients WHERE bed_number = '91';

-- Cama 92: Celulitis (Alta)
INSERT INTO public.tasks (patient_id, description, type, due_date)
SELECT id, 'Completar Epicrisis', 'admin', now()
FROM public.patients WHERE bed_number = '92';

INSERT INTO public.tasks (patient_id, description, type, due_date)
SELECT id, 'Receta de alta', 'admin', now()
FROM public.patients WHERE bed_number = '92';

-- Cama 93: FA
INSERT INTO public.tasks (patient_id, description, type, due_date)
SELECT id, 'EKG control', 'procedure', now() + interval '1 day'
FROM public.patients WHERE bed_number = '93';

-- Cama 94: TEP
INSERT INTO public.tasks (patient_id, description, type, due_date)
SELECT id, 'AngioTEM pulmonar', 'imaging', now() + interval '2 hours'
FROM public.patients WHERE bed_number = '94';

INSERT INTO public.tasks (patient_id, description, type, due_date)
SELECT id, 'Iniciar Anticoagulación', 'procedure', now()
FROM public.patients WHERE bed_number = '94';

-- Cama 95: CAD
INSERT INTO public.tasks (patient_id, description, type, due_date)
SELECT id, 'Control HGT horario', 'procedure', now() + interval '1 hour'
FROM public.patients WHERE bed_number = '95';

INSERT INTO public.tasks (patient_id, description, type, due_date)
SELECT id, 'AGA y electrolitos 6pm', 'lab', now() + interval '5 hours'
FROM public.patients WHERE bed_number = '95';

-- Cama 96: IRA
INSERT INTO public.tasks (patient_id, description, type, due_date)
SELECT id, 'Control Creatinina/Urea', 'lab', now() + interval '1 day'
FROM public.patients WHERE bed_number = '96';

-- Cama 97: HDA
INSERT INTO public.tasks (patient_id, description, type, due_date)
SELECT id, 'Endoscopía urgente', 'procedure', now() + interval '4 hours'
FROM public.patients WHERE bed_number = '97';

INSERT INTO public.tasks (patient_id, description, type, due_date)
SELECT id, 'Transfusión 2 PG', 'procedure', now() + interval '1 hour'
FROM public.patients WHERE bed_number = '97';

-- Cama 98: Cirrosis
INSERT INTO public.tasks (patient_id, description, type, due_date)
SELECT id, 'Paracentesis diagnóstica', 'procedure', now() + interval '1 day'
FROM public.patients WHERE bed_number = '98';

-- Cama 99: Pancreatitis
INSERT INTO public.tasks (patient_id, description, type, due_date)
SELECT id, 'Dieta NPO', 'admin', now()
FROM public.patients WHERE bed_number = '99';

INSERT INTO public.tasks (patient_id, description, type, due_date)
SELECT id, 'Ecografía biliar', 'imaging', now() + interval '1 day'
FROM public.patients WHERE bed_number = '99';

-- Cama 100: Sepsis
INSERT INTO public.tasks (patient_id, description, type, due_date)
SELECT id, 'Antibióticos EV', 'procedure', now()
FROM public.patients WHERE bed_number = '100';

INSERT INTO public.tasks (patient_id, description, type, due_date)
SELECT id, 'Repetir hemocultivos', 'lab', now() + interval '2 days'
FROM public.patients WHERE bed_number = '100';
