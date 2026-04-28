-- Creates the alert_log table to store all fired anomaly alerts.

CREATE TABLE IF NOT EXISTS alert_log (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  anomaly_type    text        NOT NULL,
  severity        text        NOT NULL CHECK (severity IN ('warning', 'critical')),
  message         text        NOT NULL,
  metadata        jsonb       NOT NULL DEFAULT '{}',
  fired_at        timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz
);

ALTER TABLE alert_log ENABLE ROW LEVEL SECURITY;

-- Service role has full access; no direct user access required.
CREATE POLICY "service_role_full_access" ON alert_log
  USING (true)
  WITH CHECK (true);
