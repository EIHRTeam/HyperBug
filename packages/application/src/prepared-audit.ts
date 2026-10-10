/** Neutral storage boundary; adapters validate with security's closed event catalog. */
export interface PreparedAuditEvent {
  readonly id: string;
  readonly projectId: string | null;
  readonly actorId: string | null;
  readonly systemActor: string | null;
  readonly action: string;
  readonly targetId: string;
  readonly result: 'success' | 'failure';
  readonly requestId: string;
  readonly createdAt: number;
  readonly metadata: Readonly<Record<string, string | number>>;
}
