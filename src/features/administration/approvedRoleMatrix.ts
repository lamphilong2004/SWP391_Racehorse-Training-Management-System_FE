/** Read-only documentation transcribed from approved Figma 290:3537. Not an authorization engine. */
export const CORE_ROLE_MATRIX = [
  {
    "id": "MF-01",
    "feature": "Horse Profile, Ownership & Pedigree",
    "access": [
      "V C E D",
      "V",
      "V (assigned)",
      "—",
      "V",
      "V",
      "V (own)"
    ]
  },
  {
    "id": "MF-02",
    "feature": "Health Status & Medical Records",
    "access": [
      "V",
      "V (summary)",
      "V (summary, assigned)",
      "—",
      "V C E",
      "V + X (assigned tasks)",
      "V (own · status, weight, summary)"
    ]
  },
  {
    "id": "MF-03",
    "feature": "Injury Location & Recovery Tracking",
    "access": [
      "V",
      "V (summary)",
      "V (summary, assigned)",
      "—",
      "V C E",
      "—",
      "V (own · recovery status)"
    ]
  },
  {
    "id": "MF-04",
    "feature": "Training Program Management",
    "access": [
      "V",
      "V C E D · templates · approves adjustment requests",
      "V (assigned) · template read-only · C adjustment request",
      "—",
      "V",
      "V",
      "V (own)"
    ]
  },
  {
    "id": "MF-05",
    "feature": "Training Schedule & Staff Assignment",
    "access": [
      "V",
      "V (read)",
      "V C E D (assigned)",
      "V + X (assigned)",
      "V",
      "V + X (pre-check sessions)",
      "V (own)"
    ]
  },
  {
    "id": "MF-06",
    "feature": "Training Result & Performance Evaluation",
    "access": [
      "V",
      "V (read)",
      "V C E (assigned)",
      "V + C (assigned)",
      "V",
      "—",
      "V (own)"
    ]
  },
  {
    "id": "MF-07",
    "feature": "Realtime Training Monitoring & Alerts",
    "access": [
      "V",
      "V (read)",
      "V + X (assigned)",
      "C (assigned · data feed)",
      "V + X (acknowledge CRITICAL)",
      "—",
      "—"
    ]
  },
  {
    "id": "MF-08",
    "feature": "Medical Training Restriction / Training Lock",
    "access": [
      "V",
      "V (restriction + reason)",
      "V (restriction + reason, assigned)",
      "V (restriction + reason, assigned)",
      "V C E · sole writer",
      "V",
      "V (own · readiness only)"
    ]
  },
  {
    "id": "MF-12",
    "feature": "Stable Incident Reporting",
    "access": [
      "V",
      "V C",
      "V C (assigned)",
      "V C (assigned)",
      "V + E (handling status)",
      "V C",
      "—"
    ]
  },
  {
    "id": "MF-15",
    "feature": "Horse Owner Portal",
    "access": [
      "V (support)",
      "—",
      "—",
      "—",
      "—",
      "—",
      "V (own)"
    ]
  },
  {
    "id": "MF-17",
    "feature": "Staff & User Management",
    "access": [
      "V C E D",
      "—",
      "—",
      "—",
      "—",
      "—",
      "—"
    ]
  },
  {
    "id": "MF-18",
    "feature": "Role-Based Access Control",
    "access": [
      "V E (role assignment)",
      "—",
      "—",
      "—",
      "—",
      "—",
      "—"
    ]
  },
  {
    "id": "MF-19",
    "feature": "Dashboard & Management Reports",
    "access": [
      "V (management)",
      "V (training, club-wide)",
      "V (own sessions)",
      "—",
      "V (herd health)",
      "—",
      "—"
    ]
  },
  {
    "id": "MF-20",
    "feature": "Audit Log & Activity Tracking",
    "access": [
      "V",
      "—",
      "—",
      "—",
      "—",
      "—",
      "—"
    ]
  }
] as const;
