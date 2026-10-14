import { app } from "./app.js";
import { escalateUnacknowledgedAlerts } from "./services/alertEngine.js";
import { checkMissedMedications } from "./services/medicationService.js";
import { checkDailyAnomalies } from "./services/anomalyService.js";

const port = Number(process.env.PORT ?? 4000);
const SCHEDULER_INTERVAL_MS = Number(process.env.SCHEDULER_INTERVAL_MS ?? 60 * 1000); // 1-minute tick

let lastAnomalyRunDate = null;

export async function runPeriodicSchedulerTick(now = new Date()) {
  try {
    const escalated = await escalateUnacknowledgedAlerts();
    if (escalated && escalated.length > 0) {
      console.log(`[Scheduler] Escalated ${escalated.length} unacknowledged alert(s).`);
    }
  } catch (err) {
    console.error("[Scheduler] Error running escalateUnacknowledgedAlerts:", err.message);
  }

  try {
    const missed = await checkMissedMedications();
    if (missed && missed.length > 0) {
      console.log(`[Scheduler] Created ${missed.length} missed medication alert(s).`);
    }
  } catch (err) {
    console.error("[Scheduler] Error running checkMissedMedications:", err.message);
  }

  // Daily anomaly evaluation: Evaluate yesterday's completed day once shortly after midnight
  const currentHour = now.getHours();
  const todayStr = now.toISOString().split("T")[0];

  if (currentHour === 0 && lastAnomalyRunDate !== todayStr) {
    lastAnomalyRunDate = todayStr;
    try {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const anomalies = await checkDailyAnomalies(yesterday);
      const flagged = anomalies.filter((a) => a?.metrics?.isAnomalous);
      if (flagged.length > 0) {
        console.log(`[Scheduler] Evaluated anomalies for ${yesterday}: flagged ${flagged.length} user(s).`);
      } else {
        console.log(`[Scheduler] Evaluated daily anomalies for ${yesterday}: no anomalies detected.`);
      }
    } catch (err) {
      console.error("[Scheduler] Error running checkDailyAnomalies:", err.message);
    }
  }
}

const server = app.listen(port, () => {
  console.log(`Presence backend running at http://127.0.0.1:${port}`);

  const intervalId = setInterval(runPeriodicSchedulerTick, SCHEDULER_INTERVAL_MS);

  const shutdown = () => {
    clearInterval(intervalId);
    server.close(() => {
      console.log("[Scheduler] Shutting down cleanly.");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
});
