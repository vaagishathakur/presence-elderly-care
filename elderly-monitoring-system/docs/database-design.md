# Database Design Explanation

This schema follows the uploaded SRS and SDS. The system is non-clinical: it supports companionship, reminders, mood signals, alerts, and caregiver visibility, but it does not replace medical or emergency care.

## Key entities

| Table | Why it exists |
| --- | --- |
| `elderly_users` | Stores the primary elderly user profile and consent context. |
| `caregivers` | Stores authorized caregiver accounts. |
| `caregiver_links` | Connects caregivers to elderly users and controls permissions/escalation priority. |
| `family_contacts` | Stores backup contacts and escalation channels. |
| `reminder_schedules` | Defines medication, hydration, meal, sleep, and appointment reminders. |
| `reminder_events` | Stores each due reminder instance and whether it was confirmed, late, missed, skipped, etc. |
| `interactions` | Stores summarized voice/input interactions. This avoids storing routine raw audio. |
| `mood_analyses` | Stores derived mood labels and confidence scores from an interaction. |
| `daily_activities` | Stores daily summaries for dashboard/trend views. |
| `alerts` | Stores safety/routine incidents before later notification delivery. |
| `alert_acknowledgements` | Stores caregiver acknowledgement and optional response notes. |
| `alert_deliveries` | Stores notification delivery attempts through SMS, email, push, or phone. |
| `audit_events` | Stores security-sensitive and safety-sensitive history. |

## Important database ideas

- Primary key: unique ID for one row, for example `elderly_users.id`.
- Foreign key: a column that points to another table, for example `interactions.elderly_user_id`.
- Constraint: a rule that prevents invalid data, for example confidence must be between `0` and `1`.
- `TIMESTAMPTZ`: timestamp with timezone awareness, required by the SRS data requirements.
- `ON DELETE CASCADE`: if an elderly user is deleted, their dependent records are deleted too.
- `ON DELETE SET NULL`: keeps historical records when an optional linked record is deleted.
