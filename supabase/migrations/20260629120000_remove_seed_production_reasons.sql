-- Remove the built-in seed downtime/interruption reasons. They were seeded in
-- 20260421120000_phase1_production_foundation.sql as generic placeholders and do
-- not match real production operations; admins manage the actual reasons via
-- /production/reasons.
--
-- The production_entry_*_reasons foreign keys are ON DELETE RESTRICT, so any
-- dependent (test) reason rows are cleared first to allow the parent rows to be
-- deleted. This only affects the six seeded codes below.

delete from public.production_entry_downtime_reasons
where reason_id in (
  select id from public.production_downtime_reasons
  where code in ('maintenance', 'breakdown', 'setup')
);

delete from public.production_entry_interruption_reasons
where reason_id in (
  select id from public.production_interruption_reasons
  where code in ('power_outage', 'material_delay', 'operator_break')
);

delete from public.production_downtime_reasons
where code in ('maintenance', 'breakdown', 'setup');

delete from public.production_interruption_reasons
where code in ('power_outage', 'material_delay', 'operator_break');
