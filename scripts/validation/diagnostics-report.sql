-- Read-only. UTC date range [from_day, until_day); daily buckets cannot isolate a sub-day pilot.
-- psql -v from_day=2026-11-01 -v until_day=2026-11-15 -f scripts/validation/diagnostics-report.sql
SELECT day, event, total
FROM validation_diagnostic_daily
WHERE day >= CAST(:'from_day' AS date) AND day < CAST(:'until_day' AS date)
ORDER BY day, event;
