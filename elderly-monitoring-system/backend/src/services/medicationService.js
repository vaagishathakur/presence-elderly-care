import { getClient, query } from "../database/pool.js";
import { defaultReminderProvider } from "./reminderProvider.js";

/**
 * List active medication schedules and today's logs for a user.
 */
export async function listUserMedications(userId) {
  const userNum = Number(userId);

  const schedulesRes = await query(
    `SELECT
       schedule_id,
       user_id,
       medication_name,
       dosage,
       scheduled_time,
       reminder_window,
       is_active,
       alexa_reminder_id,
       created_at
     FROM medication_schedules
     WHERE user_id = $1
     ORDER BY scheduled_time ASC`,
    [userNum]
  );

  const todayLogsRes = await query(
    `SELECT
       ml.log_id,
       ml.schedule_id,
       ml.user_id,
       ml.reminder_time,
       ml.confirmation_time,
       ml.status,
       ms.medication_name,
       ms.dosage
     FROM medication_logs ml
     JOIN medication_schedules ms ON ms.schedule_id = ml.schedule_id
     WHERE ml.user_id = $1
       AND ml.reminder_time >= CURRENT_DATE
       AND ml.reminder_time < CURRENT_DATE + INTERVAL '1 day'
     ORDER BY ml.reminder_time ASC`,
    [userNum]
  );

  return {
    schedules: schedulesRes.rows.map((r) => ({
      scheduleId: Number(r.schedule_id),
      userId: Number(r.user_id),
      medicationName: r.medication_name,
      dosage: r.dosage,
      scheduledTime: r.scheduled_time,
      reminderWindow: r.reminder_window,
      isActive: r.is_active,
      alexaReminderId: r.alexa_reminder_id,
      createdAt: r.created_at,
    })),
    todayLogs: todayLogsRes.rows.map((r) => ({
      logId: Number(r.log_id),
      scheduleId: Number(r.schedule_id),
      userId: Number(r.user_id),
      medicationName: r.medication_name,
      dosage: r.dosage,
      reminderTime: r.reminder_time,
      confirmationTime: r.confirmation_time,
      status: r.status,
    })),
  };
}

/**
 * Create a new medication schedule.
 */
export async function createMedicationSchedule(
  userId,
  {
    medicationName,
    dosage = null,
    scheduledTime,
    timeOfDay, // backward-compat alias
    reminderWindow = 20,
    isActive = true,
  },
  reminderProvider = defaultReminderProvider
) {
  const userNum = Number(userId);

  if (!medicationName || typeof medicationName !== "string" || !medicationName.trim()) {
    const error = new Error("medicationName is required.");
    error.statusCode = 400;
    throw error;
  }

  const timeVal = scheduledTime || timeOfDay;
  if (!timeVal || typeof timeVal !== "string") {
    const error = new Error("scheduledTime is required (format: HH:MM or HH:MM:SS).");
    error.statusCode = 400;
    throw error;
  }

  let alexaReminderId = null;
  if (reminderProvider && isActive) {
    try {
      const scheduledResult = await reminderProvider.scheduleReminder({
        userId: userNum,
        medicationName: medicationName.trim(),
        dosage: dosage ? dosage.trim() : null,
        reminderTime: timeVal,
      });
      alexaReminderId = scheduledResult?.reminderId || null;
    } catch (err) {
      console.error("Reminder provider error:", err.message);
    }
  }

  const res = await query(
    `INSERT INTO medication_schedules (
       user_id, medication_name, dosage, scheduled_time, reminder_window, is_active, alexa_reminder_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING schedule_id, user_id, medication_name, dosage, scheduled_time, reminder_window, is_active, alexa_reminder_id, created_at`,
    [
      userNum,
      medicationName.trim(),
      dosage ? dosage.trim() : null,
      timeVal,
      Number(reminderWindow) || 20,
      Boolean(isActive),
      alexaReminderId,
    ]
  );

  const created = res.rows[0];

  return {
    scheduleId: Number(created.schedule_id),
    userId: Number(created.user_id),
    medicationName: created.medication_name,
    dosage: created.dosage,
    scheduledTime: created.scheduled_time,
    reminderWindow: created.reminder_window,
    isActive: created.is_active,
    alexaReminderId: created.alexa_reminder_id,
    createdAt: created.created_at,
  };
}

/**
 * Confirm a pending dose as confirmed/taken.
 */
export async function confirmMedicationDose({ userId, scheduleId = null, logId = null }) {
  const userNum = Number(userId);

  if (logId) {
    const updateRes = await query(
      `UPDATE medication_logs
       SET status = 'confirmed',
           confirmation_time = NOW()
       WHERE log_id = $1 AND user_id = $2 AND status IN ('pending', 'late')
       RETURNING log_id, schedule_id, user_id, reminder_time, confirmation_time, status`,
      [Number(logId), userNum]
    );

    if (updateRes.rowCount === 0) {
      const error = new Error("No pending medication dose found for this log.");
      error.statusCode = 404;
      throw error;
    }

    return updateRes.rows[0];
  }

  // Find most recent pending log for the user or specific schedule
  const queryParams = [userNum];
  let scheduleFilter = "";
  if (scheduleId) {
    queryParams.push(Number(scheduleId));
    scheduleFilter = `AND ml.schedule_id = $${queryParams.length}`;
  }

  const findPending = await query(
    `SELECT ml.log_id, ml.schedule_id, ml.user_id, ml.reminder_time
     FROM medication_logs ml
     WHERE ml.user_id = $1
       AND ml.status IN ('pending', 'late')
       ${scheduleFilter}
     ORDER BY ml.reminder_time ASC
     LIMIT 1`,
    queryParams
  );

  if (findPending.rowCount === 0) {
    return null;
  }

  const targetLogId = findPending.rows[0].log_id;
  const updateRes = await query(
    `UPDATE medication_logs
     SET status = 'confirmed',
         confirmation_time = NOW()
     WHERE log_id = $1
     RETURNING log_id, schedule_id, user_id, reminder_time, confirmation_time, status`,
    [targetLogId]
  );

  return updateRes.rows[0];
}

/**
 * Missed dose evaluation: marks expired pending doses as missed and generates alerts.
 */
export async function checkMissedMedications() {
  const client = await getClient();

  try {
    await client.query("BEGIN");

    // Select pending logs where reminder_time + reminder_window is in the past
    const missedLogsRes = await client.query(
      `SELECT
         ml.log_id,
         ml.schedule_id,
         ml.user_id,
         ml.reminder_time,
         ms.medication_name,
         ms.dosage,
         ms.reminder_window
       FROM medication_logs ml
       JOIN medication_schedules ms ON ms.schedule_id = ml.schedule_id
       WHERE ml.status IN ('pending', 'late')
         AND ml.reminder_time + (COALESCE(ms.reminder_window, 20) * INTERVAL '1 minute') < NOW()
       FOR UPDATE OF ml`
    );

    const generatedAlerts = [];

    for (const log of missedLogsRes.rows) {
      // 1. Update log status to missed
      await client.query(
        `UPDATE medication_logs
         SET status = 'missed'
         WHERE log_id = $1`,
        [log.log_id]
      );

      // 2. Insert alert if no open missed_medication alert for this dose exists
      const existingAlert = await client.query(
        `SELECT alert_id
         FROM alerts
         WHERE user_id = $1
           AND alert_type = 'missed_medication'
           AND triggering_phrase = $2
           AND status IN ('open', 'acknowledged')`,
        [log.user_id, `Missed medication: ${log.medication_name}`]
      );

      if (existingAlert.rowCount === 0) {
        const alertRes = await client.query(
          `INSERT INTO alerts (
             user_id, alert_type, severity, triggering_phrase, confidence_score, status, escalation_level
           )
           VALUES ($1, 'missed_medication', 'medium', $2, 1.000, 'open', 0)
           RETURNING alert_id, user_id, alert_type, severity, triggering_phrase, status`,
          [log.user_id, `Missed medication: ${log.medication_name}`]
        );

        const newAlert = alertRes.rows[0];
        generatedAlerts.push(newAlert);

        // 3. Dispatch deliveries to primary caregiver
        const policyRes = await client.query(
          `SELECT ep.primary_assignment_id, ca.caregiver_id
           FROM escalation_policies ep
           LEFT JOIN caregiver_assignments ca ON ca.assignment_id = ep.primary_assignment_id
           WHERE ep.user_id = $1`,
          [log.user_id]
        );

        const primaryCaregiverId = policyRes.rows[0]?.caregiver_id;
        if (primaryCaregiverId) {
          await client.query(
            `INSERT INTO alert_deliveries (alert_id, target_caregiver_id, channel, delivery_status)
             VALUES ($1, $2, 'push', 'simulated'),
                    ($1, $2, 'sms', 'simulated')`,
            [newAlert.alert_id, primaryCaregiverId]
          );
        }
      }
    }

    await client.query("COMMIT");
    return generatedAlerts;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
