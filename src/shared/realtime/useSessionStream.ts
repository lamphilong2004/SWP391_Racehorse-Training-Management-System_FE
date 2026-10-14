import { useEffect, useState } from 'react';
import { useAuth } from '../auth/authState';
import { connectStomp } from './stomp';

export interface MetricFrame {
  sessionId: number;
  sampleId: number;
  recordedAt: string;
  heartRate: number | null;
  speedKmh: number | null;
  distanceM: number | null;
  source: 'MANUAL' | 'SIMULATOR';
  simulated: boolean;
  realtimeState: 'NORMAL' | 'WARNING' | 'CRITICAL';
  thresholds: { warning: number; critical: number; overridden: boolean };
}

export interface AlertFrame {
  type: 'WARNING' | 'CRITICAL_RAISED' | 'CRITICAL_ACKNOWLEDGED' | 'CRITICAL_ESCALATED';
  sessionId: number;
  alertId: number | null;
  severity: 'WARNING' | 'CRITICAL';
  metricValue: number;
  thresholdApplied: number;
  raisedAt: string;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  actionTaken?: string | null;
  escalatedToVetAt?: string | null;
  simulated: boolean;
}

export interface StateFrame {
  sessionId: number;
  status: string;
  previousStatus: string;
  intensity?: string | null;
  interruptionReason?: string | null;
}

/** Live overlay for one session: metrics, alerts and state frames (subscription RBAC is enforced by the server). */
export function useSessionStream(sessionId: number | undefined, topics: ('metrics' | 'alerts' | 'state')[], onState?: () => void) {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState<MetricFrame[]>([]);
  const [alerts, setAlerts] = useState<AlertFrame[]>([]);
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const key = topics.join(',');

  useEffect(() => {
    if (!sessionId || !token) return;
    const conn = connectStomp(token);
    const offStatus = conn.onStatus((s) => setConnection(s));
    const offs: (() => void)[] = [];
    if (key.includes('metrics'))
      offs.push(conn.subscribe(`/topic/sessions/${sessionId}/metrics`, (b) =>
        setMetrics((m) => [...m.slice(-299), b as MetricFrame])));
    if (key.includes('alerts'))
      offs.push(conn.subscribe(`/topic/sessions/${sessionId}/alerts`, (b) => setAlerts((a) => [b as AlertFrame, ...a].slice(0, 50))));
    if (key.includes('state')) offs.push(conn.subscribe(`/topic/sessions/${sessionId}/state`, () => onState?.()));
    return () => {
      offs.forEach((off) => off());
      offStatus();
      conn.close();
    };
    // onState is intentionally read at subscription time; callers pass a stable reload function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, token, key]);

  return { metrics, alerts, connection, setMetrics };
}
