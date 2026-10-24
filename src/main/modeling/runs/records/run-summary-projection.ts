// Reads only metadata and accepted conversation artifact receipts for history lists.
export const RUN_SUMMARY_SNAPSHOT_SQL = `(select jsonb_build_object(
  'runId', snapshot->'runId', 'status', snapshot->'status', 'currentStage', snapshot->'currentStage',
  'error', snapshot->'error', 'operationType', snapshot->'operationType', 'outputManifest', snapshot->'outputManifest',
  'standardRun', (snapshot->'standardRun') || jsonb_build_object('baseline', '{}'::jsonb, 'artifacts',
    coalesce((select jsonb_agg(item - 'svg') from jsonb_array_elements(snapshot->'standardRun'->'artifacts') item), '[]'::jsonb))
))`;
