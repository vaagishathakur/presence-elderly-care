import { query } from "../database/pool.js";

export async function getCaregiverAndAssignedElders(caregiverId) {
  const caregiverRes = await query(
    `SELECT caregiver_id, name, email, phone, cognito_sub
     FROM caregivers
     WHERE caregiver_id = $1`,
    [Number(caregiverId)]
  );

  if (caregiverRes.rowCount === 0) {
    const error = new Error("Caregiver not found.");
    error.statusCode = 404;
    throw error;
  }

  const eldersRes = await query(
    `SELECT u.user_id, u.name, u.amazon_user_id, u.timezone, ca.relationship
     FROM elderly_users u
     JOIN caregiver_assignments ca ON ca.user_id = u.user_id
     WHERE ca.caregiver_id = $1 AND ca.is_active = TRUE
     ORDER BY u.user_id`,
    [Number(caregiverId)]
  );

  const caregiver = caregiverRes.rows[0];

  return {
    caregiver: {
      caregiverId: Number(caregiver.caregiver_id),
      name: caregiver.name,
      email: caregiver.email,
      phone: caregiver.phone,
    },
    assignedElders: eldersRes.rows.map((row) => ({
      userId: Number(row.user_id),
      name: row.name,
      amazonUserId: row.amazon_user_id,
      timezone: row.timezone,
      relationship: row.relationship,
    })),
  };
}

export async function getElderlyUserProfile(userId) {
  const result = await query(
    `SELECT u.user_id, u.amazon_user_id, u.name, u.timezone, u.created_at,
            p.preferred_name, p.preferred_language, p.preferred_music, p.preferred_devotional,
            p.quiet_hours_start, p.quiet_hours_end
     FROM elderly_users u
     LEFT JOIN user_preferences p ON p.user_id = u.user_id
     WHERE u.user_id = $1`,
    [Number(userId)]
  );

  if (result.rowCount === 0) {
    const error = new Error("Not found.");
    error.statusCode = 404;
    throw error;
  }

  const row = result.rows[0];

  return {
    userId: Number(row.user_id),
    name: row.name,
    amazonUserId: row.amazon_user_id,
    timezone: row.timezone,
    createdAt: row.created_at,
    preferences: row.preferred_name
      ? {
          preferredName: row.preferred_name,
          preferredLanguage: row.preferred_language,
          preferredMusic: row.preferred_music,
          preferredDevotional: row.preferred_devotional,
          quietHoursStart: row.quiet_hours_start,
          quietHoursEnd: row.quiet_hours_end,
        }
      : null,
  };
}
