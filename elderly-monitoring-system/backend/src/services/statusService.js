import { query } from "../database/pool.js";

export async function getElderlyUserStatus(userId) {
  const userNum = Number(userId);

  const userRes = await query(
    `SELECT user_id, name, timezone
     FROM elderly_users
     WHERE user_id = $1`,
    [userNum]
  );

  if (userRes.rowCount === 0) {
    const error = new Error("Elderly user not found.");
    error.statusCode = 404;
    throw error;
  }

  const user = userRes.rows[0];
  const userTimezone = user.timezone || "Asia/Kolkata";

  // 1. Last active timestamp
  const lastActiveRes = await query(
    `SELECT interaction_at
     FROM interactions
     WHERE user_id = $1
     ORDER BY interaction_at DESC
     LIMIT 1`,
    [userNum]
  );
  const lastActiveAt = lastActiveRes.rows[0]?.interaction_at
    ? new Date(lastActiveRes.rows[0].interaction_at).toISOString()
    : null;

  // 2. Active alerts count (status in 'open', 'acknowledged')
  const alertRes = await query(
    `SELECT COUNT(*)::integer AS count
     FROM alerts
     WHERE user_id = $1 AND status IN ('open', 'acknowledged')`,
    [userNum]
  );
  const activeAlertCount = alertRes.rows[0]?.count ?? 0;

  // 3. Medication today in elder's timezone
  const medLogsRes = await query(
    `SELECT
       COUNT(*)::integer AS total,
       COUNT(CASE WHEN status = 'confirmed' THEN 1 END)::integer AS taken
     FROM medication_logs
     WHERE user_id = $1
       AND (reminder_time AT TIME ZONE $2)::date = (CURRENT_TIMESTAMP AT TIME ZONE $2)::date`,
    [userNum, userTimezone]
  );
  const medTaken = medLogsRes.rows[0]?.taken ?? 0;
  const medTotal = medLogsRes.rows[0]?.total ?? 0;

  // 4. Today's latest mood in elder's timezone (or latest overall)
  const moodRes = await query(
    `SELECT m.sentiment_label, m.mood_score, m.distress_phrase, i.transcript, i.interaction_at
     FROM mood_analyses m
     JOIN interactions i ON i.interaction_id = m.interaction_id
     WHERE i.user_id = $1
     ORDER BY i.interaction_at DESC
     LIMIT 1`,
    [userNum]
  );

  const moodRow = moodRes.rows[0];
  let specificMood = null;
  if (moodRow) {
    const text = (moodRow.distress_phrase || moodRow.transcript || "").toLowerCase();
    if (text.includes("happy")) specificMood = "happy";
    else if (text.includes("sad")) specificMood = "sad";
    else if (text.includes("lonely")) specificMood = "lonely";
    else if (text.includes("worried") || text.includes("worry")) specificMood = "worried";
    else if (text.includes("unwell") || text.includes("not well")) specificMood = "not well";
    else specificMood = moodRow.distress_phrase || moodRow.sentiment_label;
  }

  const todayMood = moodRow
    ? {
        label: moodRow.sentiment_label,
        score: moodRow.mood_score !== null ? Number(moodRow.mood_score) : null,
        specificMood: specificMood || moodRow.sentiment_label,
        recordedAt: moodRow.interaction_at,
      }
    : null;

  // 5. Interactions today in elder's timezone
  const interactionsRes = await query(
    `SELECT COUNT(*)::integer AS count
     FROM interactions
     WHERE user_id = $1
       AND (interaction_at AT TIME ZONE $2)::date = (CURRENT_TIMESTAMP AT TIME ZONE $2)::date`,
    [userNum, userTimezone]
  );
  const interactionsToday = interactionsRes.rows[0]?.count ?? 0;

  // 6. Next medication schedule today after current local time
  const nextMedRes = await query(
    `SELECT schedule_id, medication_name, dosage, scheduled_time::text AS scheduled_time
     FROM medication_schedules
     WHERE user_id = $1
       AND is_active = TRUE
       AND scheduled_time > (CURRENT_TIMESTAMP AT TIME ZONE $2)::time
     ORDER BY scheduled_time ASC
     LIMIT 1`,
    [userNum, userTimezone]
  );

  const nextMedRow = nextMedRes.rows[0];
  const nextMedication = nextMedRow
    ? {
        scheduleId: Number(nextMedRow.schedule_id),
        medicationName: nextMedRow.medication_name,
        dosage: nextMedRow.dosage,
        scheduledTime: nextMedRow.scheduled_time,
      }
    : null;

  return {
    userId: Number(user.user_id),
    name: user.name,
    lastActiveAt,
    activeAlertCount,
    medicationToday: {
      taken: medTaken,
      total: medTotal,
    },
    todayMood,
    interactionsToday,
    nextMedication,
  };
}
