alter table public.checks_diarios
  add column if not exists check_latitud double precision,
  add column if not exists check_longitud double precision,
  add column if not exists check_precision_m double precision;
