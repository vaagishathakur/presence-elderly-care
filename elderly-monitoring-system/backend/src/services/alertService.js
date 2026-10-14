import { query } from "../database/pool.js";

export async function listUserAlerts(caregiverId, userId, { status = null } = {}) {
  const cId = Number(caregiverId);
  const uId = Number(userId);

  // Validate caregiver assignment
  const linkRes = await query(
    `SELECT 1 FROM caregiver_assignments
     WHERE caregiver_id = $1 AND user_id = $2 AND is_active = TRUE`,
    [cId, uId]
  );

  if (linkRes.rowCount === 0) {
    const error = new Error("Not found.");
    error.statusCode = 404;
    throw error;
  }

  let sql = `
    SELECT
      a.alert_id,
      a.user_id,
      a.source_interaction_id,
      a.alert_type,
      a.severity,
      a.triggering_phrase,
      a.confidence_score,
      a.status,
      a.escalation_level,
      a.acknowledgement_note,
      a.created_at,
      a.acknowledged_at,
      a.resolved_by
    FROM alerts a
    WHERE a.user_id = $1
  `;
  const params = [uId];

  if (status) {
    sql += ` AND a.status = $2`;
    params.push(status);
  }

  sql += ` ORDER BY a.created_at DESC`;

  const result = await query(sql, params);

  return result.rows.map((row) => ({
    alertId: Number(row.alert_id),
    userId: Number(row.user_id),
    sourceInteractionId: row.source_interaction_id ? Number(row.source_interaction_id) : null,
    alertType: row.alert_type,
    severity: row.severity,
    triggeringPhrase: row.triggering_phrase,
    confidenceScore: row.confidence_score !== null ? Number(row.confidence_score) : null,
    status: row.status,
    escalationLevel: row.escalation_level,
    acknowledgementNote: row.acknowledgement_note,
    createdAt: row.created_at,
    acknowledgedAt: row.acknowledged_at,
    resolvedBy: row.resolved_by ? Number(row.resolved_by) : null,
  }));
}

export async function acknowledgeAlert(caregiverId, alertId, note = "") {
  const cId = Number(caregiverId);
  const aId = Number(alertId);

  const alertRes = await query(
    `SELECT a.alert_id, a.user_id, a.status
     FROM alerts a
     JOIN caregiver_assignments ca ON ca.user_id = a.user_id
     WHERE a.alert_id = $1 AND ca.caregiver_id = $2 AND ca.is_active = TRUE`,
    [aId, cId]
  );

  if (alertRes.rowCount === 0) {
    const error = new Error("Alert not found or unauthorized.");
    error.statusCode = 404;
    throw error;
  }

  const updatedRes = await query(
    `UPDATE alerts
     SET status = 'acknowledged',
         acknowledged_at = NOW(),
         acknowledgement_note = $2,
         resolved_by = $3
     WHERE alert_id = $1
     RETURNING *`,
    [aId, note || "Caregiver acknowledged alert.", cId]
  );

  // Write to audit_events
  await query(
    `INSERT INTO audit_events (actor_id, actor_type, action, target_type, target_id, details)
     VALUES ($1, 'caregiver', 'acknowledge_alert', 'alert', $2, $3)`,
    [cId, aId, JSON.stringify({ note })]
  );

  return updatedRes.rows[0];
}

export async function resolveAlert(caregiverId, alertId, note = "") {
  const cId = Number(caregiverId);
  const aId = Number(alertId);

  const alertRes = await query(
    `SELECT a.alert_id, a.user_id, a.status
     FROM alerts a
     JOIN caregiver_assignments ca ON ca.user_id = a.user_id
     WHERE a.alert_id = $1 AND ca.caregiver_id = $2 AND ca.is_active = TRUE`,
    [aId, cId]
  );

  if (alertRes.rowCount === 0) {
    const error = new Error("Alert not found or unauthorized.");
    error.statusCode = 404;
    throw error;
  }

  const updatedRes = await query(
    `UPDATE alerts
     SET status = 'resolved',
         resolved_by = $2
     WHERE alert_id = $1
     RETURNING *`,
    [aId, cId]
  );

  // Write to audit_events
  await query(
    `INSERT INTO audit_events (actor_id, actor_type, action, target_type, target_id, details)
     VALUES ($1, 'caregiver', 'resolve_alert', 'alert', $2, $3)`,
    [cId, aId, JSON.stringify({ note })]
  );

  return updatedRes.rows[0];
}
