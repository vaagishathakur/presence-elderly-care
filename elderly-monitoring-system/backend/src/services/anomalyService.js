import { getClient, query } from "../database/pool.js";

/**
 * Calculates rolling 30-day baseline stats (mean and stddev) and evaluates
 * whether the given user's daily interaction count represents an anomaly
 * using the SRS 3.1.4.5 & 3.1.6.5 formula:
 *
 *   Threshold = µ - (k * σ)
 *
 * where:
 *   µ = 30-day rolling mean interaction count
 *   σ = 30-day rolling standard deviation
 *   k = anomaly_sensitivity_k from escalation_policies (default 1.50)
 */
export async function evaluateUserDailyActivity(userId, targetDate = null) {
  const userNum = Number(userId);
  const client = await getClient();

  try {
    await client.query("BEGIN");

    // 1. Fetch policy for sensitivity k
    const policyRes = await client.query(
      `SELECT anomaly_sensitivity_k, primary_assignment_id
       FROM escalation_policies
       WHERE user_id = $1`,
      [userNum]
    );

    const sensitivityK = policyRes.rows[0]?.anomaly_sensitivity_k !== undefined && policyRes.rows[0]?.anomaly_sensitivity_k !== null
      ? Number(policyRes.rows[0].anomaly_sensitivity_k)
      : 1.50;

    // 2. Determine target date (default today)
    const dateSql = targetDate ? "$2::date" : "CURRENT_DATE";
    const dateParams = targetDate ? [userNum, targetDate] : [userNum];

    // Count today's interactions
    const countRes = await client.query(
      `SELECT
         COUNT(*)::integer AS count,
         MIN(interaction_at) AS first_interaction
       FROM interactions
       WHERE user_id = $1
         AND (interaction_at AT TIME ZONE 'Asia/Kolkata')::date = ${dateSql}`,
      dateParams
    );

    const currentInteractionCount = countRes.rows[0]?.count ?? 0;
    const firstInteractionAt = countRes.rows[0]?.first_interaction ?? null;

    // 3. Compute 30-day rolling mean and standard deviation from prior daily_activity
    const statsRes = await client.query(
      `SELECT
         COALESCE(AVG(interaction_count), 0)::numeric(6, 2) AS rolling_mean,
         COALESCE(STDDEV_POP(interaction_count), 0)::numeric(6, 2) AS rolling_stddev,
         COUNT(*)::integer AS sample_days
       FROM daily_activity
       WHERE user_id = $1
         AND activity_date < ${dateSql}
         AND activity_date >= (${dateSql} - INTERVAL '30 days')`,
      dateParams
    );

    let rollingMean = Number(statsRes.rows[0]?.rolling_mean ?? 0);
    let rollingStddev = Number(statsRes.rows[0]?.rolling_stddev ?? 0);

    // If no prior history, use current count as mean with unit stddev baseline
    if (Number(statsRes.rows[0]?.sample_days ?? 0) === 0) {
      rollingMean = currentInteractionCount;
      rollingStddev = 1.0;
    }

    // 4. Calculate µ - k*σ threshold
    const thresholdValue = Number((rollingMean - (sensitivityK * rollingStddev)).toFixed(2));
    const isAnomalous = currentInteractionCount < thresholdValue;
    const deviationScore = rollingStddev > 0
      ? Number(((rollingMean - currentInteractionCount) / rollingStddev).toFixed(2))
      : Number((rollingMean - currentInteractionCount).toFixed(2));

    // 5. Upsert into daily_activity
    const upsertRes = await client.query(
      `INSERT INTO daily_activity (
         user_id, activity_date, interaction_count,
         rolling_mean_30d, rolling_stddev_30d, first_interaction_at
       )
       VALUES ($1, ${dateSql}, $${dateParams.length + 1}, $${dateParams.length + 2}, $${dateParams.length + 3}, $${dateParams.length + 4})
       ON CONFLICT (user_id, activity_date)
       DO UPDATE SET
         interaction_count = EXCLUDED.interaction_count,
         rolling_mean_30d = EXCLUDED.rolling_mean_30d,
         rolling_stddev_30d = EXCLUDED.rolling_stddev_30d,
         first_interaction_at = COALESCE(daily_activity.first_interaction_at, EXCLUDED.first_interaction_at)
       RETURNING activity_id, user_id, activity_date, interaction_count, rolling_mean_30d, rolling_stddev_30d`,
      [...dateParams, currentInteractionCount, rollingMean, rollingStddev, firstInteractionAt]
    );

    const activityRow = upsertRes.rows[0];
    const activityId = activityRow.activity_id;

    // 6. Record anomaly evaluation in anomaly_records (update existing record if activity_id already evaluated)
    const existingAnomaly = await client.query(
      `SELECT anomaly_id FROM anomaly_records WHERE activity_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [activityId]
    );

    let anomalyRecord;
    if (existingAnomaly.rowCount > 0) {
      const updateRes = await client.query(
        `UPDATE anomaly_records
         SET sensitivity_k = $2, threshold_value = $3, deviation_score = $4, is_anomalous = $5
         WHERE anomaly_id = $1
         RETURNING anomaly_id, activity_id, user_id, sensitivity_k, threshold_value, deviation_score, is_anomalous, created_at`,
        [existingAnomaly.rows[0].anomaly_id, sensitivityK, thresholdValue, deviationScore, isAnomalous]
      );
      anomalyRecord = updateRes.rows[0];
    } else {
      const anomalyRes = await client.query(
        `INSERT INTO anomaly_records (
           activity_id, user_id, sensitivity_k,
           threshold_value, deviation_score, is_anomalous
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING anomaly_id, activity_id, user_id, sensitivity_k, threshold_value, deviation_score, is_anomalous, created_at`,
        [activityId, userNum, sensitivityK, thresholdValue, deviationScore, isAnomalous]
      );
      anomalyRecord = anomalyRes.rows[0];
    }

    // 7. If anomalous, trigger a low_interaction alert if not already open today
    let alertCreated = null;
    if (isAnomalous) {
      const existingAlert = await client.query(
        `SELECT alert_id
         FROM alerts
         WHERE user_id = $1
           AND alert_type = 'low_interaction'
           AND status IN ('open', 'acknowledged')
           AND created_at >= CURRENT_DATE
         LIMIT 1`,
        [userNum]
      );

      if (existingAlert.rowCount === 0) {
        const triggerPhrase = `Low interaction detected: ${currentInteractionCount} interactions (threshold: ${thresholdValue}, µ=${rollingMean}, σ=${rollingStddev}, k=${sensitivityK})`;
        const alertRes = await client.query(
          `INSERT INTO alerts (
             user_id, alert_type, severity,
             triggering_phrase, confidence_score, status, escalation_level
           )
           VALUES ($1, 'low_interaction', 'medium', $2, 0.900, 'open', 0)
           RETURNING alert_id, user_id, alert_type, severity, triggering_phrase, status`,
          [userNum, triggerPhrase]
        );

        alertCreated = alertRes.rows[0];

        // Deliveries to caregiver stubs
        const caregiverRes = await client.query(
          `SELECT ca.caregiver_id
           FROM caregiver_assignments ca
           WHERE ca.user_id = $1 AND ca.is_active = TRUE
           ORDER BY ca.created_at ASC
           LIMIT 1`,
          [userNum]
        );

        if (caregiverRes.rowCount > 0) {
          const cId = caregiverRes.rows[0].caregiver_id;
          await client.query(
            `INSERT INTO alert_deliveries (alert_id, target_caregiver_id, channel, delivery_status)
             VALUES ($1, $2, 'push', 'simulated'),
                    ($1, $2, 'sms', 'simulated')`,
            [alertCreated.alert_id, cId]
          );
        }
      }
    }

    await client.query("COMMIT");

    return {
      activity: activityRow,
      anomaly: anomalyRecord,
      alert: alertCreated,
      metrics: {
        interactionCount: currentInteractionCount,
        rollingMean,
        rollingStddev,
        sensitivityK,
        thresholdValue,
        deviationScore,
        isAnomalous,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Iterates through all active elderly users and evaluates daily anomalies.
 * Evaluates yesterday's completed day once shortly after midnight by default.
 */
export async function checkDailyAnomalies(targetDate = null) {
  let evalDate = targetDate;
  if (!evalDate) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    evalDate = yesterday.toISOString().split("T")[0];
  }

  const usersRes = await query(
    `SELECT user_id FROM elderly_users WHERE is_active = TRUE`
  );

  const results = [];
  for (const user of usersRes.rows) {
    try {
      const result = await evaluateUserDailyActivity(user.user_id, evalDate);
      results.push(result);
    } catch (err) {
      console.error(`[AnomalyService] Error evaluating user ${user.user_id}:`, err.message);
    }
  }

  return results;
}
