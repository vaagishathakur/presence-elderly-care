import { closePool, getClient } from "./pool.js";

export async function seedDatabase() {
  const client = await getClient();

  try {
    await client.query("BEGIN");

    // 1. Elderly users
    const shantiRes = await client.query(
      `INSERT INTO elderly_users (amazon_user_id, name, timezone)
       VALUES ('amzn1.ask.account.DEMO-SHANTI', 'Shanti Devi', 'Asia/Kolkata')
       ON CONFLICT (amazon_user_id) DO UPDATE SET name = EXCLUDED.name, timezone = EXCLUDED.timezone
       RETURNING user_id`
    );
    const shantiId = shantiRes.rows[0].user_id;

    const rameshRes = await client.query(
      `INSERT INTO elderly_users (amazon_user_id, name, timezone)
       VALUES ('amzn1.ask.account.DEMO-RAMESH', 'Ramesh Kumar', 'Asia/Kolkata')
       ON CONFLICT (amazon_user_id) DO UPDATE SET name = EXCLUDED.name, timezone = EXCLUDED.timezone
       RETURNING user_id`
    );
    const rameshId = rameshRes.rows[0].user_id;

    // 2. User Preferences
    await client.query(
      `INSERT INTO user_preferences (user_id, preferred_name, preferred_language, preferred_music, preferred_devotional, quiet_hours_start, quiet_hours_end)
       VALUES ($1, 'Shanti', 'Hindi', 'Classical Hindi', 'Bhajans', '22:00:00', '06:30:00')
       ON CONFLICT (user_id) DO UPDATE SET
         preferred_name = EXCLUDED.preferred_name,
         preferred_language = EXCLUDED.preferred_language,
         preferred_music = EXCLUDED.preferred_music,
         preferred_devotional = EXCLUDED.preferred_devotional,
         quiet_hours_start = EXCLUDED.quiet_hours_start,
         quiet_hours_end = EXCLUDED.quiet_hours_end`,
      [shantiId]
    );

    await client.query(
      `INSERT INTO user_preferences (user_id, preferred_name, preferred_language, preferred_music, preferred_devotional, quiet_hours_start, quiet_hours_end)
       VALUES ($1, 'Ramesh', 'Hindi', 'Ghazals', 'Kirtan', '21:30:00', '06:00:00')
       ON CONFLICT (user_id) DO UPDATE SET
         preferred_name = EXCLUDED.preferred_name,
         preferred_language = EXCLUDED.preferred_language,
         preferred_music = EXCLUDED.preferred_music,
         preferred_devotional = EXCLUDED.preferred_devotional,
         quiet_hours_start = EXCLUDED.quiet_hours_start,
         quiet_hours_end = EXCLUDED.quiet_hours_end`,
      [rameshId]
    );

    // 3. Caregivers (Cognito sub based)
    const subA = process.env.SEED_CAREGIVER_A_SUB || "cognito-sub-demo-a";
    const subB = process.env.SEED_CAREGIVER_B_SUB || "cognito-sub-demo-b";

    const caregiverARes = await client.query(
      `INSERT INTO caregivers (name, email, phone, cognito_sub, is_active)
       VALUES ('Samridhi Pandey', 'samridhi@example.com', '+919876543210', $1, TRUE)
       ON CONFLICT (email) DO UPDATE SET cognito_sub = EXCLUDED.cognito_sub, is_active = TRUE
       RETURNING caregiver_id`,
      [subA]
    );
    const caregiverAId = caregiverARes.rows[0].caregiver_id;

    const caregiverBRes = await client.query(
      `INSERT INTO caregivers (name, email, phone, cognito_sub, is_active)
       VALUES ('Arjun Sharma', 'arjun@example.com', '+919876543211', $1, TRUE)
       ON CONFLICT (email) DO UPDATE SET cognito_sub = EXCLUDED.cognito_sub, is_active = TRUE
       RETURNING caregiver_id`,
      [subB]
    );
    const caregiverBId = caregiverBRes.rows[0].caregiver_id;

    // 4. Caregiver Assignments
    const assignARes = await client.query(
      `INSERT INTO caregiver_assignments (user_id, caregiver_id, relationship, is_active)
       VALUES ($1, $2, 'daughter', TRUE)
       ON CONFLICT (user_id, caregiver_id) DO UPDATE SET is_active = TRUE
       RETURNING assignment_id`,
      [shantiId, caregiverAId]
    );
    const assignAId = assignARes.rows[0].assignment_id;

    const assignBRes = await client.query(
      `INSERT INTO caregiver_assignments (user_id, caregiver_id, relationship, is_active)
       VALUES ($1, $2, 'son', TRUE)
       ON CONFLICT (user_id, caregiver_id) DO UPDATE SET is_active = TRUE
       RETURNING assignment_id`,
      [rameshId, caregiverBId]
    );
    const assignBId = assignBRes.rows[0].assignment_id;

    // 4b. Dedicated Test Caregiver (Cognito user pool test account)
    const testSub = process.env.TEST_CAREGIVER_SUB || "b9ced498-d091-70d2-8457-c9d1b487c487";
    const testEmail = process.env.TEST_CAREGIVER_EMAIL || "vaagisha2006@gmail.com";
    const testName = process.env.TEST_CAREGIVER_NAME || "Vaagisha";

    const caregiverTestRes = await client.query(
      `INSERT INTO caregivers (name, email, phone, cognito_sub, is_active)
       VALUES ($1, $2, '+919876543212', $3, TRUE)
       ON CONFLICT (email) DO UPDATE SET cognito_sub = EXCLUDED.cognito_sub, is_active = TRUE
       RETURNING caregiver_id`,
      [testName, testEmail, testSub]
    );
    const caregiverTestId = caregiverTestRes.rows[0].caregiver_id;

    await client.query(
      `INSERT INTO caregiver_assignments (user_id, caregiver_id, relationship, is_active)
       VALUES ($1, $2, 'primary_caregiver', TRUE)
       ON CONFLICT (user_id, caregiver_id) DO UPDATE SET is_active = TRUE`,
      [shantiId, caregiverTestId]
    );

    // 5. Family Contacts
    const contactARes = await client.query(
      `INSERT INTO family_contacts (user_id, name, relationship, phone_number)
       SELECT $1::bigint, 'Samridhi Pandey', 'daughter', '+919876543210'
       WHERE NOT EXISTS (
         SELECT 1 FROM family_contacts WHERE user_id = $1::bigint AND phone_number = '+919876543210'
       )
       RETURNING contact_id`,
      [shantiId]
    );
    const contactAId =
      contactARes.rows[0]?.contact_id ??
      (
        await client.query(
          "SELECT contact_id FROM family_contacts WHERE user_id = $1 AND phone_number = '+919876543210'",
          [shantiId]
        )
      ).rows[0].contact_id;

    const contactBRes = await client.query(
      `INSERT INTO family_contacts (user_id, name, relationship, phone_number)
       SELECT $1::bigint, 'Arjun Sharma', 'son', '+919876543211'
       WHERE NOT EXISTS (
         SELECT 1 FROM family_contacts WHERE user_id = $1::bigint AND phone_number = '+919876543211'
       )
       RETURNING contact_id`,
      [rameshId]
    );
    const contactBId =
      contactBRes.rows[0]?.contact_id ??
      (
        await client.query(
          "SELECT contact_id FROM family_contacts WHERE user_id = $1 AND phone_number = '+919876543211'",
          [rameshId]
        )
      ).rows[0].contact_id;

    // 6. Escalation Policies
    await client.query(
      `INSERT INTO escalation_policies (
         user_id, primary_assignment_id, backup_contact_id, escalation_delay_min,
         override_quiet_hours, anomaly_sensitivity_k, mood_distress_threshold, distress_confidence_min
       )
       VALUES ($1, $2, $3, 10, FALSE, 1.50, -0.600, 0.700)
       ON CONFLICT (user_id) DO UPDATE SET
         primary_assignment_id = EXCLUDED.primary_assignment_id,
         backup_contact_id = EXCLUDED.backup_contact_id`,
      [shantiId, assignAId, contactAId]
    );

    await client.query(
      `INSERT INTO escalation_policies (
         user_id, primary_assignment_id, backup_contact_id, escalation_delay_min,
         override_quiet_hours, anomaly_sensitivity_k, mood_distress_threshold, distress_confidence_min
       )
       VALUES ($1, $2, $3, 10, FALSE, 1.50, -0.600, 0.700)
       ON CONFLICT (user_id) DO UPDATE SET
         primary_assignment_id = EXCLUDED.primary_assignment_id,
         backup_contact_id = EXCLUDED.backup_contact_id`,
      [rameshId, assignBId, contactBId]
    );

    // 7. Distress Keywords (aligned with Python NLP analyzer & Node fallback list)
    const keywords = [
      { phrase: "help", category: "emergency", severity: "critical" },
      { phrase: "i fell", category: "fall", severity: "critical" },
      { phrase: "i fell down", category: "fall", severity: "critical" },
      { phrase: "chest pain", category: "cardiac", severity: "critical" },
      { phrase: "cannot breathe", category: "respiratory", severity: "critical" },
      { phrase: "cant breathe", category: "respiratory", severity: "critical" },
      { phrase: "emergency", category: "emergency", severity: "critical" },
      { phrase: "i don't feel good", category: "health", severity: "high" },
      { phrase: "i dont feel good", category: "health", severity: "high" },
      { phrase: "not feeling well", category: "health", severity: "high" },
      { phrase: "not feeling good", category: "health", severity: "high" },
      { phrase: "very dizzy", category: "health", severity: "high" },
      { phrase: "bachao", category: "emergency", severity: "critical" },
      { phrase: "madad karo", category: "emergency", severity: "critical" },
      { phrase: "mujhe theek nahi lag raha", category: "health", severity: "high" },
      { phrase: "theek nahi lag raha", category: "health", severity: "high" },
      { phrase: "theek nahi hu", category: "health", severity: "high" },
      { phrase: "theek nahi", category: "health", severity: "high" },
      { phrase: "chot lag gayi", category: "injury", "severity": "critical" },
      { phrase: "dard ho raha hai", category: "pain", severity: "high" },
      { phrase: "gir gayi", category: "fall", severity: "critical" },
      { phrase: "gir gaya", category: "fall", severity: "critical" },
      { phrase: "chakkar aa rahe hai", category: "health", severity: "high" },
    ];

    for (const kw of keywords) {
      await client.query(
        `INSERT INTO distress_keywords (phrase, category, severity, is_active)
         VALUES ($1, $2, $3, TRUE)
         ON CONFLICT (phrase) DO NOTHING`,
        [kw.phrase, kw.category, kw.severity]
      );
    }

    // 8. Medication Schedules (2 schedules for Shanti Devi)
    const medSchedules = [
      {
        name: "Amlodipine",
        dosage: "5mg",
        time: "08:00:00",
        window: 20,
      },
      {
        name: "Metformin",
        dosage: "500mg",
        time: "20:00:00",
        window: 20,
      },
    ];

    const medScheduleMap = {};
    for (const med of medSchedules) {
      const mRes = await client.query(
        `INSERT INTO medication_schedules (user_id, medication_name, dosage, scheduled_time, reminder_window, is_active)
         SELECT $1::bigint, $2::varchar, $3::varchar, $4::text::time, $5::integer, TRUE
         WHERE NOT EXISTS (
           SELECT 1 FROM medication_schedules WHERE user_id = $1::bigint AND medication_name = $2::varchar
         )
         RETURNING schedule_id`,
        [shantiId, med.name, med.dosage, med.time, med.window]
      );

      const mId =
        mRes.rows[0]?.schedule_id ??
        (
          await client.query(
            "SELECT schedule_id FROM medication_schedules WHERE user_id = $1 AND medication_name = $2",
            [shantiId, med.name]
          )
        ).rows[0].schedule_id;

      medScheduleMap[med.name] = mId;
    }

    // 9. Today's Medication Logs (mix of confirmed and pending)
    const todayLogs = [
      {
        medName: "Amlodipine",
        timeStr: "08:00:00",
        status: "confirmed",
        confirmed: true,
      },
      {
        medName: "Metformin",
        timeStr: "20:00:00",
        status: "pending",
        confirmed: false,
      },
    ];

    for (const log of todayLogs) {
      const schedId = medScheduleMap[log.medName];
      if (schedId) {
        await client.query(
          `INSERT INTO medication_logs (schedule_id, user_id, reminder_time, confirmation_time, status)
           VALUES (
             $1,
             $2,
             ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + $3::text::time) AT TIME ZONE 'Asia/Kolkata',
             CASE WHEN $4::boolean THEN NOW() ELSE NULL END,
             $5
           )
           ON CONFLICT (schedule_id, reminder_time) DO NOTHING`,
          [schedId, shantiId, log.timeStr, log.confirmed, log.status]
        );
      }
    }

    // 10. 3 Days of Interactions with Mood Analyses for Shanti Devi
    const pastInteractions = [
      {
        daysAgo: 2,
        intent: "morning_check_in",
        transcript: "Namaste, had my tea and listened to bhajans.",
        response: "Namaste Shanti ji. Glad to hear that!",
        summary: "Morning routine started with devotion and tea.",
        moodScore: 0.700,
        confidence: 0.850,
        sentiment: "positive",
        distress: false,
        phrase: null,
      },
      {
        daysAgo: 1,
        intent: "evening_check_in",
        transcript: "Feeling a bit tired today after a walk.",
        response: "Please take rest and drink some water.",
        summary: "Elderly user reported tiredness after walking.",
        moodScore: 0.050,
        confidence: 0.800,
        sentiment: "neutral",
        distress: false,
        phrase: null,
      },
      {
        daysAgo: 0,
        intent: "morning_check_in",
        transcript: "Good morning! Slept well and took morning medicine.",
        response: "Great! Have a wonderful day ahead.",
        summary: "Morning check-in with confirmed medicine.",
        moodScore: 0.750,
        confidence: 0.900,
        sentiment: "positive",
        distress: false,
        phrase: null,
      },
    ];

    for (const item of pastInteractions) {
      const existing = await client.query(
        `SELECT interaction_id FROM interactions WHERE user_id = $1 AND summary = $2`,
        [shantiId, item.summary]
      );

      if (existing.rowCount === 0) {
        const intRes = await client.query(
          `INSERT INTO interactions (user_id, session_id, interaction_intent, transcript, response, summary, interaction_at)
           VALUES ($1, 'session-seed-' || $2, $3, $4, $5, $6, NOW() - make_interval(days => $2::integer))
           RETURNING interaction_id`,
          [shantiId, item.daysAgo, item.intent, item.transcript, item.response, item.summary]
        );

        await client.query(
          `INSERT INTO mood_analyses (interaction_id, mood_score, confidence_score, sentiment_label, distress_detected, distress_phrase)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [intRes.rows[0].interaction_id, item.moodScore, item.confidence, item.sentiment, item.distress, item.phrase]
        );
      }
    }

    // 11. 30 Days of Daily Activity for Shanti Devi
    for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
      await client.query(
        `INSERT INTO daily_activity (user_id, activity_date, interaction_count, rolling_mean_30d, rolling_stddev_30d, first_interaction_at)
         VALUES (
           $1,
           (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - make_interval(days => $2::integer),
           $3,
           7.50,
           1.20,
           ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - make_interval(days => $2::integer) + '08:30:00'::time) AT TIME ZONE 'Asia/Kolkata'
         )
         ON CONFLICT (user_id, activity_date) DO NOTHING`,
        [shantiId, dayOffset, 5 + (dayOffset % 5)]
      );
    }

    await client.query("COMMIT");
    console.log("Database seeded successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Database seeding failed:", error.message);
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith("seed.js")) {
  seedDatabase()
    .catch(() => {
      process.exitCode = 1;
    })
    .finally(async () => {
      await closePool();
    });
}
