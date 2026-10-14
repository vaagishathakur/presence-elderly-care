/**
 * Reminder Provider Adapter Interface and Implementations (SDS D6)
 */

export class BaseReminderProvider {
  async scheduleReminder(_params) {
    throw new Error("scheduleReminder must be implemented by subclass");
  }

  async cancelReminder(_reminderId) {
    throw new Error("cancelReminder must be implemented by subclass");
  }
}

export class SimulatedReminderProvider extends BaseReminderProvider {
  constructor() {
    super();
    this.scheduledReminders = new Map();
  }

  async scheduleReminder({ userId, scheduleId, medicationName, dosage, reminderTime }) {
    const reminderId = `sim-rem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const record = {
      reminderId,
      userId,
      scheduleId,
      medicationName,
      dosage,
      reminderTime,
      createdAt: new Date().toISOString(),
      status: "scheduled",
    };
    this.scheduledReminders.set(reminderId, record);
    return record;
  }

  async cancelReminder(reminderId) {
    if (this.scheduledReminders.has(reminderId)) {
      const record = this.scheduledReminders.get(reminderId);
      record.status = "cancelled";
      return true;
    }
    return false;
  }

  getRemindersForUser(userId) {
    return Array.from(this.scheduledReminders.values()).filter(
      (r) => r.userId === userId && r.status === "scheduled"
    );
  }
}

export class AlexaRemindersProvider extends BaseReminderProvider {
  constructor(apiEndpoint = "https://api.amazonalexa.com", consentToken = null) {
    super();
    this.apiEndpoint = apiEndpoint;
    this.consentToken = consentToken;
  }

  async scheduleReminder({ userId, scheduleId, medicationName, dosage, reminderTime }) {
    // Production Alexa Reminders API v1 Client
    if (!this.consentToken) {
      // In development or simulation mode, return structured stub
      return {
        reminderId: `alexa-rem-stub-${scheduleId}`,
        userId,
        scheduleId,
        medicationName,
        status: "simulated_alexa_reminder",
      };
    }

    const payload = {
      requestTime: new Date().toISOString(),
      trigger: {
        type: "SCHEDULED_ABSOLUTE",
        scheduledTime: reminderTime,
      },
      alertInfo: {
        spokenInfo: {
          content: [
            {
              locale: "en-IN",
              text: `Namaste, it is time to take your medication: ${medicationName} ${dosage || ""}`,
            },
          ],
        },
      },
      pushNotification: {
        status: "ENABLED",
      },
    };

    const res = await fetch(`${this.apiEndpoint}/v1/alerts/reminders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.consentToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Alexa Reminders API error (${res.status}): ${errBody}`);
    }

    const data = await res.json();
    return {
      reminderId: data.alertToken,
      userId,
      scheduleId,
      medicationName,
      status: "scheduled",
    };
  }

  async cancelReminder(reminderId) {
    if (!this.consentToken) return true;

    const res = await fetch(`${this.apiEndpoint}/v1/alerts/reminders/${reminderId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.consentToken}`,
      },
    });

    return res.ok;
  }
}

export const defaultReminderProvider = new SimulatedReminderProvider();
