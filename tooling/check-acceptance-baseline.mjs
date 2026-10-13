import { readFileSync } from 'node:fs';
const candidatePath = process.argv[2];
if (!candidatePath)
  throw Error(
    'Pass an explicitly recorded candidate receipt; this command never records or overwrites a baseline.',
  );
const rules = JSON.parse(
  readFileSync(
    new URL(
      '../docs/plan/evidence/10-local-regression-thresholds.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'));
const profile = rules.profiles[candidate.profile];
if (
  !profile ||
  candidate.node !== profile.node ||
  JSON.stringify(candidate.fixture) !== JSON.stringify(profile.fixture)
)
  throw Error('Incomparable profile/runtime/fixture; no regression result.');
for (const [path, limit] of Object.entries(profile.paths)) {
  const actual = candidate.percentiles[path];
  if (
    !actual ||
    !Number.isInteger(actual.samples) ||
    actual.samples < limit.minimumSamples
  )
    throw Error('Missing required samples.');
  for (const metric of ['p95Ms', 'p99Ms', 'serverErrorRate'])
    if (
      !Number.isFinite(actual[metric]) ||
      actual[metric] < 0 ||
      actual[metric] > limit[metric]
    )
      throw Error(`Acceptance regression: ${path} ${metric}`);
}
console.log(
  'Comparable local receipt stays within recorded initial thresholds; no hosted/SLO acceptance inferred.',
);
