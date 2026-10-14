import { query } from "../database/pool.js";

/**
 * Sends SMS via Twilio HTTP API if credentials are provided, or returns simulated status.
 */
export async function sendTwilioSms({ to, message }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_FROM_PHONE || process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromPhone || !to) {
    return { status: "simulated", mode: "stub" };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const body = new URLSearchParams({
      To: to,
      From: fromPhone,
      Body: message,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (response.ok) {
      const data = await response.json();
      return { status: "sent", sid: data.sid };
    } else {
      const errText = await response.text();
      console.warn(`[NotificationService] Twilio SMS failed HTTP ${response.status}:`, errText);
      return { status: "failed", error: errText };
    }
  } catch (error) {
    console.warn("[NotificationService] Twilio request error:", error.message);
    return { status: "failed", error: error.message };
  }
}

/**
 * Dispatches alert deliveries for caregivers and logs to alert_deliveries table.
 */
export async function dispatchAlertDeliveries({
  alertId,
  caregiverId,
  alertType = "distress",
  severity = "critical",
  triggeringPhrase = "",
  elderName = "Care recipient",
}) {
  let caregiverPhone = null;
  if (caregiverId) {
    const cgRes = await query("SELECT phone FROM caregivers WHERE caregiver_id = $1", [caregiverId]);
    if (cgRes.rowCount > 0) {
      caregiverPhone = cgRes.rows[0].phone;
    }
  }

  // Attempt real SMS if Twilio is configured
  let smsStatus = "simulated";
  if (caregiverPhone && process.env.TWILIO_ACCOUNT_SID) {
    const smsMessage = `[PRESENCE ALERT - ${severity.toUpperCase()}] ${elderName}: ${triggeringPhrase || alertType}. Please check on them.`;
    const smsResult = await sendTwilioSms({ to: caregiverPhone, message: smsMessage });
    if (smsResult.status === "sent") {
      smsStatus = "sent";
    }
  }

  const pushStatus = "simulated";

  await query(
    `INSERT INTO alert_deliveries (alert_id, target_caregiver_id, channel, delivery_status)
     VALUES ($1, $2, 'push', $3),
            ($1, $2, 'sms', $4)`,
    [alertId, caregiverId, pushStatus, smsStatus]
  );

  return { smsStatus, pushStatus };
}
