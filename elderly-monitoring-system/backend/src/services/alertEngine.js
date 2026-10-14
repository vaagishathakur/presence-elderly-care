import { getClient, query } from "../database/pool.js";

const DEDUPLICATION_WINDOW_MINUTES = 15;

export async function processInteractionForAlerts({
  userId,
  interactionId,
  transcript = "",
  moodScore = null,
  confidenceScore = null,
  distressDetected = false,
  distressPhrase = null,
}) {
  const userNum = Number(userId);

  // 1. Fetch user escalation policy to read configurable thresholds and caregiver links
  const policyRes = await query(
    `SELECT ep.primary_assignment_id, ca.caregiver_id, ep.backup_contact_id,
            ep.mood_distress_threshold, ep.distress_confidence_min
     FROM escalation_policies ep
     LEFT JOIN caregiver_assignments ca ON ca.assignment_id = ep.primary_assignment_id
     WHERE ep.user_id = $1`,
    [userNum]
  );

  const policy = policyRes.rows[0];
  const moodThreshold = policy?.mood_distress_threshold !== undefined && policy?.mood_distress_threshold !== null
    ? Number(policy.mood_distress_threshold)
    : -0.600;
  const minConfidence = policy?.distress_confidence_min !== undefined && policy?.distress_confidence_min !== null
    ? Number(policy.distress_confidence_min)
    : 0.700;

  const isDistress =
    distressDetected ||
    (moodScore !== null &&
      Number(moodScore) <= moodThreshold &&
      (confidenceScore === null || Number(confidenceScore) >= minConfidence));

  if (!isDistress) {
    return null;
  }

  const trigger = distressPhrase || transcript || "Severe negative mood signal";
  const confidence = confidenceScore !== null ? Number(confidenceScore) : 0.900;

  const client = await getClient();

  try {
    await client.query("BEGIN");

    // Prevent concurrent check-then-insert race condition with a transaction-scoped advisory lock per user
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('distress_alert_dedup_' || $1))",
      [userNum]
    );

    // 2. De-duplication check:
    // If an alert is still open/acknowledged (regardless of age), OR if any distress alert was created
    // within the configured deduplication window (e.g. 15 minutes), suppress creating a duplicate.
    const duplicateCheck = await client.query(
      `SELECT alert_id
       FROM alerts
       WHERE user_id = $1
         AND alert_type = 'distress'
         AND (
           status IN ('open', 'acknowledged')
           OR created_at >= NOW() - make_interval(mins => $2::integer)
         )
       ORDER BY created_at DESC
       LIMIT 1`,
      [userNum, DEDUPLICATION_WINDOW_MINUTES]
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("COMMIT");
      return null; // Suppress duplicate alert
    }

    // 3. Insert alert into alerts table
    const alertRes = await client.query(
      `INSERT INTO alerts (
         user_id, source_interaction_id, alert_type, severity,
         triggering_phrase, confidence_score, status, escalation_level
       )
       VALUES ($1, $2, 'distress', 'critical', $3, $4, 'open', 0)
       RETURNING alert_id, user_id, source_interaction_id, alert_type, severity, triggering_phrase, confidence_score, status, escalation_level, created_at`,
      [userNum, interactionId || null, trigger, confidence]
    );

    const alert = alertRes.rows[0];
    const alertId = Number(alert.alert_id);

    const primaryCaregiverId = policy?.caregiver_id;

    // 4. Dispatch initial deliveries to primary caregiver (marked 'simulated' to preserve audit integrity)
    if (primaryCaregiverId) {
      await client.query(
        `INSERT INTO alert_deliveries (alert_id, target_caregiver_id, channel, delivery_status)
         VALUES ($1, $2, 'push', 'simulated'),
                ($1, $2, 'sms', 'simulated')`,
        [alertId, primaryCaregiverId]
      );
    }

    await client.query("COMMIT");
    return alert;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function escalateUnacknowledgedAlerts() {
  const expiredAlerts = await query(
    `SELECT a.alert_id, a.user_id, ep.backup_contact_id
     FROM alerts a
     JOIN escalation_policies ep ON ep.user_id = a.user_id
     WHERE a.status = 'open'
       AND a.escalation_level = 0
       AND a.created_at <= NOW() - make_interval(mins => ep.escalation_delay_min::integer)`
  );

  const escalated = [];

  for (const row of expiredAlerts.rows) {
    await query(
      `UPDATE alerts
       SET escalation_level = 1
       WHERE alert_id = $1`,
      [row.alert_id]
    );

    if (row.backup_contact_id) {
      await query(
        `INSERT INTO alert_deliveries (alert_id, target_contact_id, channel, delivery_status)
         VALUES ($1, $2, 'voice', 'simulated')`,
        [row.alert_id, row.backup_contact_id]
      );
    }

    escalated.push(row.alert_id);
  }

  return escalated;
}
