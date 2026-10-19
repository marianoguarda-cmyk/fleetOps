alter table public.liquidaciones
  add column if not exists forma_pago text not null default 'efectivo_transferencia',
  add column if not exists cuenta_corriente_monto numeric;
