// HANDOFF-11 user decision, 2026-10-13: positively account for sent requests.
// This does not change the 10 ms bound or exempt any harness path.
export function attributeNativeEvents(events, sent) {
  const matched = [];
  const observations = [];
  const pending = [];
  for (const event of events) {
    const request = sent.find(
      (item) =>
        item.label === event.label &&
        item.method === event.method &&
        item.path === event.path,
    );
    if (!request) {
      observations.push(event);
    } else if (request.status == null) {
      pending.push(event);
    } else if (request.status === event.status) {
      matched.push(event);
    } else {
      pending.push(event);
    }
  }
  const failure = matched.find(
    (event) =>
      !Number.isFinite(event.cpuTime) ||
      event.cpuTime < 0 ||
      event.cpuTime > 10 ||
      event.outcome !== 'ok' ||
      event.exceptions?.length,
  );
  return { matched, observations, pending, failure };
}

export function requestAttribution(events, request) {
  const { matched, failure } = attributeNativeEvents(events, [request]);
  const complete = ['api', 'ingress'].every(
    (worker) => matched.filter((event) => event.worker === worker).length === 1,
  );
  const duplicate = ['api', 'ingress'].some(
    (worker) => matched.filter((event) => event.worker === worker).length > 1,
  );
  return { matched, failure, complete, duplicate };
}
