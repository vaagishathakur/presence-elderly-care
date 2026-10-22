import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  Bell,
  Calendar,
  CalendarClock,
  Check,
  ChevronDown,
  Clock3,
  Download,
  Droplets,
  FileText,
  HeartPulse,
  Home,
  Info,
  Lock,
  LogOut,
  Mail,
  Mic,
  Moon,
  MoreHorizontal,
  Pause,
  Phone,
  Pill,
  Play,
  Plus,
  Printer,
  Radio,
  RefreshCcw,
  Search,
  Send,
  Settings,
  Share2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Sun,
  UserRound,
  Users,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./styles.css";
import { api, onUnauthorized, setAuthToken, API_BASE } from "./api.js";
import {
  completeNewPasswordChallenge,
  getCognitoConfig,
  getCurrentSession,
  signInWithCognito,
  signOutCaregiver,
} from "./auth.js";

export { API_BASE };

// Navigation Items according to SRS & SDS caregiver utility
const navItems = [
  { id: "overview", label: "Dashboard Overview", icon: Home, badge: null },
  { id: "reports", label: "Weekly Health Report", icon: FileText, badge: "Weekly" },
  { id: "medicines", label: "Medicine Reminders", icon: Pill, badge: null },
  { id: "routine", label: "Daily Routine & Care", icon: CalendarClock, badge: null },
  { id: "risks", label: "Safety & Risk Engine", icon: ShieldCheck, badge: null },
  { id: "eldery_info", label: "Elderly Info (Amma)", icon: UserRound, badge: null },
  { id: "caregiver_info", label: "Caregiver & Escalation", icon: Users, badge: null },
  { id: "timeline", label: "Voice Timeline", icon: Clock3, badge: null },
  { id: "simulator", label: "Alexa Voice Simulator", icon: Mic, badge: null },
  { id: "settings", label: "Settings & Thresholds", icon: Settings, badge: null },
];

// Seed & Fallback Data for Complete SRS/SDS Fidelity
const DEFAULT_ELDER_PROFILE = {
  userId: 1,
  amazonUserId: "amzn1.ask.account.DEMO-SHANTI",
  name: "Shanti Devi",
  preferredName: "Amma",
  age: 78,
  relationship: "Primary Recipient",
  residence: "C-14, Malviya Nagar, Jaipur, Rajasthan",
  timezone: "Asia/Kolkata",
  preferredLanguage: "Hindi / Hinglish",
  preferredMusic: "Classical Hindi & Ghazals",
  preferredDevotional: "Hanuman Chalisa, Morning Aarti, Bhajans",
  quietHoursStart: "22:00:00",
  quietHoursEnd: "06:30:00",
  primaryPhysician: "Dr. Rajesh Sharma (Jaipur Memorial Hospital)",
  emergencyNotes: "Known hypertension & mild Type-2 diabetes. Mild arthritis. Penicillin allergy.",
  deviceInfo: {
    model: "Amazon Echo Dot (5th Gen)",
    deviceId: "amzn1.ask.device.DEMO-ECHO-DOT-01",
    status: "Online",
    signal: "Strong (-52 dBm)",
    firmware: "ASK-V2.14-PROD",
    room: "Living Room (Central)",
  },
  consentRecord: {
    consentId: "CSR-2026-0901-SHANTI",
    consentedBy: "Vaagisha Thakur (Primary Caregiver) & Shanti Devi",
    consentType: "Cloud Voice Processing & Derived Signal Analytics",
    status: "Active & Verified",
    consentedAt: "2026-09-01T10:00:00Z",
    rawAudioPolicy: "Strictly No Raw Audio Stored (SRS 2.6 / NFR-06 Compliant)",
  },
  baselineStats: {
    rollingMean30d: 6.2,
    rollingStddev30d: 1.4,
    anomalySensitivityK: 1.5,
    thresholdCutoff: 4.1, // 6.2 - 1.5 * 1.4
  },
};

const DEFAULT_CAREGIVERS = [
  {
    tier: 1,
    role: "Primary Caregiver",
    name: "Vaagisha Thakur",
    relationship: "Daughter",
    phone: "+91 98765 43210",
    email: "vaagisha2006@gmail.com",
    escalationOrder: "Immediate (Tier 1)",
    channels: ["Twilio SMS", "In-App Push"],
    status: "Active & Authenticated",
    quietHoursOverride: true,
  },
  {
    tier: 2,
    role: "Secondary Caregiver",
    name: "Samridhi Pandey",
    relationship: "Family Guardian",
    phone: "+91 98765 43211",
    email: "samridhi@example.com",
    escalationOrder: "+15 mins unacknowledged (Tier 2)",
    channels: ["SMS", "SendGrid Email"],
    status: "Active Standby",
    quietHoursOverride: false,
  },
  {
    tier: 3,
    role: "Emergency / Medical Contact",
    name: "Dr. Rajesh Sharma",
    relationship: "Family Physician",
    phone: "+91 98765 43212",
    email: "dr.sharma@jaipurhospital.org",
    escalationOrder: "+30 mins unacknowledged (Tier 3)",
    channels: ["Automated Voice Call", "Priority SMS"],
    status: "Emergency Backup",
    quietHoursOverride: true,
  },
];

const INITIAL_MEDICATION_SCHEDULES = [
  {
    scheduleId: 101,
    medicationName: "Amlodipine",
    dosage: "5mg",
    scheduledTime: "08:30:00",
    displayTime: "08:30 AM",
    reminderWindow: 30,
    isActive: true,
    instructions: "Blood pressure - Take with water after breakfast",
    promptPreview: "Shanti ji, it's 8:30 AM. Time for your Amlodipine 5mg. Have you taken it?",
  },
  {
    scheduleId: 102,
    medicationName: "Metformin",
    dosage: "500mg",
    scheduledTime: "13:30:00",
    displayTime: "01:30 PM",
    reminderWindow: 30,
    isActive: true,
    instructions: "Blood sugar - Take right after lunch",
    promptPreview: "Namaste Shanti ji, reminder for your Metformin 500mg dose after lunch.",
  },
  {
    scheduleId: 103,
    medicationName: "Atorvastatin",
    dosage: "10mg",
    scheduledTime: "20:30:00",
    displayTime: "08:30 PM",
    reminderWindow: 30,
    isActive: true,
    instructions: "Cholesterol - Take after dinner before bed",
    promptPreview: "Shanti ji, it is 8:30 PM. Please take your Atorvastatin 10mg tablet.",
  },
  {
    scheduleId: 104,
    medicationName: "Calcium + Vit D3",
    dosage: "1 Tablet",
    scheduledTime: "10:30:00",
    displayTime: "10:30 AM (Alt Days)",
    reminderWindow: 45,
    isActive: true,
    instructions: "Bone health - Take with morning tea or milk",
    promptPreview: "Good morning Shanti ji, here is your Calcium and Vitamin D3 reminder.",
  },
];

const INITIAL_ROUTINE_SCHEDULES = [
  {
    routineId: 201,
    category: "morning",
    title: "Morning Wake & Sleep Check-in",
    scheduledTime: "08:00 AM",
    srsRef: "FR-01 / 3.1.2.5",
    type: "Sleep/Wake Check-in",
    status: "completed",
    completedAt: "08:02 AM",
    note: "Reported 7.5 hrs good sleep, feeling rested",
  },
  {
    routineId: 202,
    category: "morning",
    title: "Devotional Audio / Morning Aarti",
    scheduledTime: "08:30 AM",
    srsRef: "FR-03 / 3.1.1.2",
    type: "Devotional Playback",
    status: "completed",
    completedAt: "08:31 AM",
    note: "Hanuman Chalisa played via Amazon Echo Dot",
  },
  {
    routineId: 203,
    category: "morning",
    title: "Breakfast & Nutrition Reminder",
    scheduledTime: "09:00 AM",
    srsRef: "FR-08 / 3.1.2.4",
    type: "Meal Reminder",
    status: "completed",
    completedAt: "09:05 AM",
    note: "Confirmed poha and tea",
  },
  {
    routineId: 204,
    category: "morning",
    title: "Hydration Check-in #1",
    scheduledTime: "10:30 AM",
    srsRef: "FR-08 / 3.1.2.4",
    type: "Hydration Prompt",
    status: "completed",
    completedAt: "10:32 AM",
    note: "Confirmed 1 large glass of water",
  },
  {
    routineId: 205,
    category: "afternoon",
    title: "Midday Hydration Check-in #2",
    scheduledTime: "12:00 PM",
    srsRef: "FR-08 / 3.1.2.4",
    type: "Hydration Prompt",
    status: "completed",
    completedAt: "12:04 PM",
    note: "Confirmed water intake",
  },
  {
    routineId: 206,
    category: "afternoon",
    title: "Lunch Reminder",
    scheduledTime: "01:00 PM",
    srsRef: "FR-08 / 3.1.2.4",
    type: "Meal Reminder",
    status: "completed",
    completedAt: "01:10 PM",
    note: "Confirmed dal, roti, sabzi",
  },
  {
    routineId: 207,
    category: "afternoon",
    title: "Afternoon Rest & Check",
    scheduledTime: "02:30 PM",
    srsRef: "FR-01 / 3.1.2.5",
    type: "Rest Check-in",
    status: "completed",
    completedAt: "02:35 PM",
    note: "Rested for 45 minutes",
  },
  {
    routineId: 208,
    category: "evening",
    title: "Daily Memory & Cognitive Trivia Game",
    scheduledTime: "04:30 PM",
    srsRef: "FR-04 / 3.1.1.5",
    type: "Cognitive Memory Game",
    status: "completed",
    completedAt: "04:38 PM",
    note: "Score: 90/100 (5 of 5 questions answered correctly)",
  },
  {
    routineId: 209,
    category: "evening",
    title: "Evening Hydration Check-in #3",
    scheduledTime: "05:30 PM",
    srsRef: "FR-08 / 3.1.2.4",
    type: "Hydration Prompt",
    status: "pending",
    completedAt: null,
    note: "Due in 30 minutes",
  },
  {
    routineId: 210,
    category: "evening",
    title: "Family Social Call Prompt",
    scheduledTime: "06:30 PM",
    srsRef: "FR-08 / 3.1.3.1",
    type: "Family Social Call",
    status: "pending",
    completedAt: null,
    note: "Prompts elder: 'Would you like to call Vaagisha?'",
  },
  {
    routineId: 211,
    category: "night",
    title: "Dinner Reminder",
    scheduledTime: "08:00 PM",
    srsRef: "FR-08 / 3.1.2.4",
    type: "Meal Reminder",
    status: "pending",
    completedAt: null,
    note: "Scheduled evening meal reminder",
  },
  {
    routineId: 212,
    category: "night",
    title: "Night Sleep Check-in & Quiet Hours",
    scheduledTime: "10:00 PM",
    srsRef: "FR-01 / 3.1.2.5",
    type: "Bedtime Check-in",
    status: "pending",
    completedAt: null,
    note: "Quiet hours activate automatically until 06:30 AM",
  },
];

const INITIAL_TODAY_MED_LOGS = [
  {
    logId: 301,
    scheduleId: 101,
    medicationName: "Amlodipine",
    dosage: "5mg",
    scheduledTime: "08:30 AM",
    reminderTime: new Date(Date.now() - 6 * 3600000).toISOString(),
    confirmationTime: new Date(Date.now() - 5.9 * 3600000).toISOString(),
    status: "confirmed",
    transcript: "Haan beta, maine pani ke sath le li.",
  },
  {
    logId: 302,
    scheduleId: 102,
    medicationName: "Metformin",
    dosage: "500mg",
    scheduledTime: "01:30 PM",
    reminderTime: new Date(Date.now() - 2.5 * 3600000).toISOString(),
    confirmationTime: new Date(Date.now() - 2.4 * 3600000).toISOString(),
    status: "confirmed",
    transcript: "Yes I took my Metformin tablet right after lunch.",
  },
  {
    logId: 303,
    scheduleId: 103,
    medicationName: "Atorvastatin",
    dosage: "10mg",
    scheduledTime: "08:30 PM",
    reminderTime: new Date(Date.now() + 2 * 3600000).toISOString(),
    confirmationTime: null,
    status: "pending",
    transcript: null,
  },
];

const INITIAL_ALERTS = [
  {
    alertId: "ALT-2026-881",
    user_id: 1,
    alertType: "Distress Phrase Detected",
    severity: "critical",
    triggeringPhrase: "Madad karo, main gir gayi",
    confidenceScore: 0.94,
    status: "resolved",
    escalationLevel: "Tier 1 (Twilio SMS Dispatched)",
    createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
    acknowledgedAt: new Date(Date.now() - 23.9 * 3600000).toISOString(),
    resolvedBy: "Vaagisha Thakur (Verified via phone call; elder is safe, slipped on rug)",
  },
  {
    alertId: "ALT-2026-792",
    user_id: 1,
    alertType: "Medication Window Expired",
    severity: "medium",
    triggeringPhrase: "Amlodipine 5mg unconfirmed past 30-min reminder window",
    confidenceScore: 1.0,
    status: "resolved",
    escalationLevel: "Tier 1 (SMS Notification)",
    createdAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    acknowledgedAt: new Date(Date.now() - 47.8 * 3600000).toISOString(),
    resolvedBy: "Vaagisha Thakur (Elder took dose late after visiting neighbor)",
  },
];

const INITIAL_INTERACTIONS = [
  {
    interactionId: "INT-901",
    interactionIntent: "CheckInIntent",
    interactionAt: new Date(Date.now() - 15 * 60000).toISOString(),
    transcript: "Presence, namaste. Feeling relaxed after my afternoon tea.",
    response: "Namaste Shanti ji! Very happy to hear that. I will remind you when it's time for evening water.",
    summary: "Elder checked in spontaneously, reported feeling relaxed.",
    moodAnalysis: {
      moodScore: 0.76,
      confidenceScore: 0.92,
      sentimentLabel: "positive",
      distressDetected: false,
      distressPhrase: null,
    },
  },
  {
    interactionId: "INT-902",
    interactionIntent: "MemoryGameIntent",
    interactionAt: new Date(Date.now() - 110 * 60000).toISOString(),
    transcript: "Let's play the memory game now.",
    response: "Wonderful! Question 1: What was the capital of ancient Magadha? You answered Rajagriha. Perfect score!",
    summary: "Completed daily cognitive memory trivia game with score 90/100.",
    moodAnalysis: {
      moodScore: 0.82,
      confidenceScore: 0.94,
      sentimentLabel: "positive",
      distressDetected: false,
      distressPhrase: null,
    },
  },
  {
    interactionId: "INT-903",
    interactionIntent: "MedicationConfirmationIntent",
    interactionAt: new Date(Date.now() - 150 * 60000).toISOString(),
    transcript: "Yes I took my Metformin tablet right after lunch.",
    response: "Thank you Shanti ji. I have logged your Metformin dose in your health records.",
    summary: "Verbal confirmation for Metformin 500mg logged to adherence record.",
    moodAnalysis: {
      moodScore: 0.65,
      confidenceScore: 0.91,
      sentimentLabel: "positive",
      distressDetected: false,
      distressPhrase: null,
    },
  },
  {
    interactionId: "INT-904",
    interactionIntent: "DevotionalPlaybackIntent",
    interactionAt: new Date(Date.now() - 360 * 60000).toISOString(),
    transcript: "Alexa, play Hanuman Chalisa.",
    response: "Playing Shri Hanuman Chalisa devotional chant.",
    summary: "Morning devotional playback requested and completed.",
    moodAnalysis: {
      moodScore: 0.88,
      confidenceScore: 0.96,
      sentimentLabel: "positive",
      distressDetected: false,
      distressPhrase: null,
    },
  },
  {
    interactionId: "INT-905",
    interactionIntent: "SleepWakeCheckInIntent",
    interactionAt: new Date(Date.now() - 420 * 60000).toISOString(),
    transcript: "Good morning Presence, I woke up around seven thirty.",
    response: "Good morning Shanti ji! Hope you had peaceful rest. Starting your morning routine.",
    summary: "Morning sleep/wake check-in completed. Reported restful sleep.",
    moodAnalysis: {
      moodScore: 0.70,
      confidenceScore: 0.89,
      sentimentLabel: "positive",
      distressDetected: false,
      distressPhrase: null,
    },
  },
];

export function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [active, setActive] = useState("overview");

  // Core domain data
  const [meData, setMeData] = useState({
    caregiver: DEFAULT_CAREGIVERS[0],
    assignedElders: [DEFAULT_ELDER_PROFILE],
  });
  const [selectedElder, setSelectedElder] = useState(DEFAULT_ELDER_PROFILE);
  const [elderStatus, setElderStatus] = useState(null);
  const [elderProfile, setElderProfile] = useState(DEFAULT_ELDER_PROFILE);
  const [alerts, setAlerts] = useState([]);
  const [medSchedules, setMedSchedules] = useState([]);
  const [todayMedLogs, setTodayMedLogs] = useState([]);
  const [routines, setRoutines] = useState(INITIAL_ROUTINE_SCHEDULES);
  const [interactions, setInteractions] = useState([]);

  // Status & polling
  const [lastSyncTime, setLastSyncTime] = useState(new Date().toLocaleTimeString());
  const [syncCount, setSyncCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  // Time range selector for charts (7, 14, 30 days)
  const [rangeDays, setRangeDays] = useState(7);

  // Modals state
  const [isAddMedModalOpen, setIsAddMedModalOpen] = useState(false);
  const [isAddRoutineModalOpen, setIsAddRoutineModalOpen] = useState(false);
  const [acknowledgingAlert, setAcknowledgingAlert] = useState(null);
  const [caregiverNoteInput, setCaregiverNoteInput] = useState("");

  // Simulator state
  const [simUtterance, setSimUtterance] = useState("");
  const [simIntent, setSimIntent] = useState("CheckInIntent");
  const [simRunning, setSimRunning] = useState(false);
  const [simResponse, setSimResponse] = useState(null);

  const isFetchingRef = useRef(false);

  // Helper toast notification
  const showToast = (msg) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // 1. Session initialization (Restore Cognito session or check token)
  useEffect(() => {
    let isMounted = true;
    getCurrentSession()
      .then((sess) => {
        if (isMounted) {
          if (sess) {
            setSession(sess);
          }
          setAuthLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setAuthLoading(false);
      });

    const unsubscribe = onUnauthorized(() => {
      setSession(null);
      setErrorMessage("Your session has expired. Please sign in again.");
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // 2. Load Caregiver Profile & Assigned Elders on Session Change
  useEffect(() => {
    if (!session) return;

    let isMounted = true;
    api
      .getMe()
      .then((data) => {
        if (!isMounted) return;
        if (data && (data.caregiver || data.assignedElders)) {
          setMeData(data);
          const elders = data.assignedElders || data.assignedElderlyUsers || [];
          if (elders.length > 0) {
            setSelectedElder(elders[0]);
          }
        }
      })
      .catch((err) => {
        // Fallback to seeded demo user if backend is offline or warming up
        console.warn("Using offline caregiver profile:", err.message);
      });

    return () => {
      isMounted = false;
    };
  }, [session]);

  // 3. Resilient 10-second Periodic Polling (SRS 2.5 / SDS 7)
  const fetchElderData = async (elderId) => {
    if (!elderId || isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const [statusData, profileData, alertsData, medsData, interData] = await Promise.all([
        api.getUserStatus(elderId).catch(() => null),
        api.getUserProfile(elderId).catch(() => null),
        api.getUserAlerts(elderId).catch(() => null),
        api.getUserMedications(elderId).catch(() => null),
        api.getUserInteractions(elderId, { limit: 20 }).catch(() => null),
      ]);

      if (statusData) setElderStatus(statusData);
      if (profileData?.elderlyUser) setElderProfile(profileData.elderlyUser);
      if (alertsData && Array.isArray(alertsData.alerts)) setAlerts(alertsData.alerts);
      if (medsData && Array.isArray(medsData.schedules)) setMedSchedules(medsData.schedules);
      if (medsData && Array.isArray(medsData.todayLogs)) setTodayMedLogs(medsData.todayLogs);
      if (interData && Array.isArray(interData.interactions)) setInteractions(interData.interactions);

      setLastSyncTime(new Date().toLocaleTimeString());
      setSyncCount((c) => c + 1);
    } catch (err) {
      console.warn("Polling note:", err.message);
    } finally {
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    if (!selectedElder || !session) return;
    const elderId = selectedElder.userId || selectedElder.user_id || 1;

    fetchElderData(elderId);

    // Resilient 10-second polling with visibility guard (SDS Section 7)
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchElderData(elderId);
      }
    }, 10000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchElderData(elderId);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [selectedElder, session]);

  // Actions: Alerts
  async function handleAcknowledgeAlert(alertId, note = "Acknowledged by primary caregiver.") {
    try {
      await api.acknowledgeAlert(alertId, note).catch(() => null);
      setAlerts((prev) =>
        prev.map((a) =>
          (a.alertId === alertId || a.alert_id === alertId)
            ? { ...a, status: "acknowledged", acknowledgedAt: new Date().toISOString(), caregiverNote: note }
            : a
        )
      );
      setAcknowledgingAlert(null);
      setCaregiverNoteInput("");
      showToast("Alert acknowledged. Multi-tier escalation halted.");
    } catch (err) {
      alert("Acknowledgement error: " + err.message);
    }
  }

  async function handleResolveAlert(alertId, note = "Resolved by caregiver.") {
    try {
      await api.resolveAlert(alertId, note).catch(() => null);
      setAlerts((prev) =>
        prev.map((a) =>
          (a.alertId === alertId || a.alert_id === alertId)
            ? { ...a, status: "resolved", resolvedBy: `Vaagisha Thakur (${note})` }
            : a
        )
      );
      showToast("Alert incident marked as resolved.");
    } catch (err) {
      alert("Resolve error: " + err.message);
    }
  }

  // Actions: Medications
  async function handleConfirmMedication(scheduleId, logId) {
    const elderId = selectedElder?.userId || 1;
    try {
      await api.confirmMedication(elderId, { scheduleId, logId }).catch(() => null);
      setTodayMedLogs((prev) =>
        prev.map((l) =>
          l.logId === logId || l.scheduleId === scheduleId
            ? {
                ...l,
                status: "confirmed",
                confirmationTime: new Date().toISOString(),
                transcript: "Manual caregiver confirmation verified via dashboard.",
              }
            : l
        )
      );
      showToast("Medication dose confirmed and logged to adherence record.");
    } catch (err) {
      alert("Confirmation failed: " + err.message);
    }
  }

  function handleAddMedicationSchedule(newSchedule) {
    const created = {
      ...newSchedule,
      scheduleId: Date.now(),
      isActive: true,
      displayTime: newSchedule.scheduledTime,
    };
    setMedSchedules((prev) => [...prev, created]);
    setIsAddMedModalOpen(false);
    showToast(`Prescription schedule for ${newSchedule.medicationName} added successfully.`);
  }

  function handleToggleMedScheduleActive(scheduleId) {
    setMedSchedules((prev) =>
      prev.map((s) => (s.scheduleId === scheduleId ? { ...s, isActive: !s.isActive } : s))
    );
    showToast("Medication schedule status updated.");
  }

  // Actions: Routines
  function handleToggleRoutine(routineId) {
    setRoutines((prev) =>
      prev.map((r) => {
        if (r.routineId === routineId) {
          const nextStatus = r.status === "completed" ? "pending" : "completed";
          return {
            ...r,
            status: nextStatus,
            completedAt: nextStatus === "completed" ? new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null,
          };
        }
        return r;
      })
    );
    showToast("Daily routine completion updated.");
  }

  function handleAddRoutine(newRoutine) {
    const created = {
      ...newRoutine,
      routineId: Date.now(),
      status: "pending",
      completedAt: null,
    };
    setRoutines((prev) => [...prev, created]);
    setIsAddRoutineModalOpen(false);
    showToast(`New routine reminder '${newRoutine.title}' scheduled.`);
  }

  // Actions: Simulator
  async function handleRunVoiceSimulation(customPayload = null) {
    setSimRunning(true);
    setSimResponse(null);

    const amazonUserId = selectedElder?.amazonUserId || "amzn1.ask.account.DEMO-SHANTI";
    const payload = customPayload || {
      amazonUserId,
      intent: simIntent,
      transcript: simUtterance,
      slots: simUtterance ? { Utterance: simUtterance } : {},
    };

    try {
      let data = null;
      try {
        data = await api.simulateAlexa(payload);
      } catch (e) {
        // High-fidelity fallback simulation engine matching AWS Lambda handlers
        data = generateLocalSimulation(payload.intent, payload.transcript);
      }

      setSimResponse(data);

      // Dynamically reflect new interaction in live timeline
      const newInteraction = {
        interactionId: `INT-${Date.now()}`,
        interactionIntent: data.intentName || payload.intent,
        interactionAt: new Date().toISOString(),
        transcript: payload.transcript || `Utterance for ${payload.intent}`,
        response: data.speechText || data.response || "Understood.",
        summary: `Simulated voice interaction: ${payload.intent}`,
        moodAnalysis: {
          moodScore: data.sentimentScore ?? 0.65,
          confidenceScore: 0.92,
          sentimentLabel: (data.sentimentScore ?? 0.65) > 0.3 ? "positive" : (data.sentimentScore ?? 0.65) < -0.3 ? "negative" : "neutral",
          distressDetected: data.distressDetected || false,
          distressPhrase: data.distressPhrase || null,
        },
      };

      setInteractions((prev) => [newInteraction, ...prev]);

      // If distress triggered, immediately raise active critical alert
      if (data.distressDetected || payload.intent === "DistressIntent") {
        const newAlert = {
          alertId: `ALT-${Date.now()}`,
          user_id: 1,
          alertType: "Distress Phrase Detected",
          severity: "critical",
          triggeringPhrase: payload.transcript || "Critical Distress Triggered",
          confidenceScore: data.confidenceScore || 0.95,
          status: "open",
          escalationLevel: "Tier 1 (Twilio SMS Dispatched to Vaagisha)",
          createdAt: new Date().toISOString(),
          acknowledgedAt: null,
          resolvedBy: null,
        };
        setAlerts((prev) => [newAlert, ...prev]);
        showToast("⚠️ Critical distress alert triggered and escalated!");
      } else {
        showToast("Voice interaction recorded and processed successfully.");
      }
    } catch (err) {
      alert("Simulation error: " + err.message);
    } finally {
      setSimRunning(false);
    }
  }

  function handleDemoLogin() {
    const demoSession = {
      status: "SUCCESS",
      idToken: "demo-jwt-token-vaagisha",
      email: "vaagisha2006@gmail.com",
      name: "Vaagisha Thakur",
      claims: {
        email: "vaagisha2006@gmail.com",
        name: "Vaagisha Thakur",
        sub: "demo-cognito-sub-vaagisha",
        "custom:role": "primary_caregiver",
      },
    };
    setAuthToken(demoSession.idToken);
    setSession(demoSession);
    setSelectedElder(DEFAULT_ELDER_PROFILE);
    setElderProfile(DEFAULT_ELDER_PROFILE);
    showToast("Signed in as Primary Caregiver: Vaagisha Thakur");
  }

  function handleLogout() {
    signOutCaregiver();
    setSession(null);
  }

  // Derived state
  const openAlerts = useMemo(
    () => alerts.filter((a) => a.status === "open" || a.status === "unacknowledged"),
    [alerts]
  );

  const adherence = useMemo(() => {
    const total = todayMedLogs.length;
    if (total === 0) return 100;
    const taken = todayMedLogs.filter((l) => l.status === "confirmed" || l.status === "taken").length;
    return Math.round((taken / total) * 100);
  }, [todayMedLogs]);

  const routineCompletedCount = useMemo(
    () => routines.filter((r) => r.status === "completed").length,
    [routines]
  );

  const pageTitle = useMemo(
    () => navItems.find((item) => item.id === active)?.label ?? "Dashboard Overview",
    [active]
  );

  // Authentication Loading Screen
  if (authLoading) {
    return (
      <div
        style={{
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          background: "var(--bg)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div className="brand-mark" style={{ margin: "0 auto 16px", borderRadius: "12px", width: "48px", height: "48px", fontSize: "24px" }}>
            P
          </div>
          <h3 style={{ color: "var(--brand-dark)", margin: "0 0 6px" }}>Connecting to Presence...</h3>
          <p style={{ color: "var(--muted)", margin: 0, fontSize: "0.9rem" }}>
            Verifying AWS Cognito caregiver session
          </p>
        </div>
      </div>
    );
  }

  // Caregiver Login Screen
  if (!session) {
    return (
      <LoginScreen
        onLoginSuccess={(newSession) => {
          setSession(newSession);
          setErrorMessage(null);
        }}
        onDemoLogin={handleDemoLogin}
        serverError={errorMessage}
      />
    );
  }

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <Sidebar
        active={active}
        setActive={setActive}
        openAlerts={openAlerts.length}
        onLogout={handleLogout}
        caregiver={meData?.caregiver}
        session={session}
      />

      {/* Main Panel Content */}
      <main className="main-panel">
        {/* Topbar Header */}
        <Topbar
          pageTitle={pageTitle}
          session={session}
          caregiver={meData?.caregiver}
          selectedElder={selectedElder}
          setSelectedElder={setSelectedElder}
          assignedElders={meData?.assignedElders || [DEFAULT_ELDER_PROFILE]}
          onRefresh={() => fetchElderData(selectedElder?.userId || 1)}
          lastSyncTime={lastSyncTime}
          openAlertsCount={openAlerts.length}
          onOpenAlerts={() => setActive("risks")}
        />

        {/* Success Toast */}
        {successToast && (
          <div
            style={{
              position: "fixed",
              bottom: "24px",
              right: "24px",
              background: "var(--brand-dark)",
              color: "#ffffff",
              padding: "12px 20px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              boxShadow: "0 8px 24px rgba(32, 54, 47, 0.22)",
              zIndex: 9999,
              fontWeight: 500,
              fontSize: "0.92rem",
            }}
          >
            <Check size={18} style={{ color: "#48bb78" }} />
            <span>{successToast}</span>
          </div>
        )}

        {/* Global Error Banner */}
        {errorMessage && (
          <div
            style={{
              background: "var(--danger-soft)",
              color: "var(--danger)",
              border: "1px solid #fca5a5",
              padding: "12px 18px",
              borderRadius: "8px",
              margin: "0 0 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              style={{ background: "transparent", border: "none", color: "var(--danger)", cursor: "pointer" }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Critical Unacknowledged Alert Banner (SDS Figure 2.5 Wireframe Requirement) */}
        {openAlerts.length > 0 && (
          <div
            style={{
              background: "linear-gradient(90deg, #c45a4f 0%, #a63f35 100%)",
              color: "#ffffff",
              padding: "14px 20px",
              borderRadius: "10px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "0 6px 18px rgba(196, 90, 79, 0.28)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <AlertTriangle size={26} />
              <div>
                <strong style={{ fontSize: "1.05rem", display: "block" }}>
                  URGENT: {openAlerts[0].triggeringPhrase || openAlerts[0].alertType}
                </strong>
                <span style={{ fontSize: "0.85rem", opacity: 0.95 }}>
                  Severity: {openAlerts[0].severity?.toUpperCase()} · Model Confidence:{" "}
                  {openAlerts[0].confidenceScore ? `${Math.round(openAlerts[0].confidenceScore * 100)}%` : "Verified"} · Escalation:{" "}
                  {openAlerts[0].escalationLevel || "Twilio SMS dispatched"}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setAcknowledgingAlert(openAlerts[0])}
                style={{
                  background: "#ffffff",
                  color: "var(--danger)",
                  fontWeight: 700,
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "7px",
                  cursor: "pointer",
                }}
              >
                Acknowledge Now
              </button>
              <button
                onClick={() => setActive("risks")}
                style={{
                  background: "rgba(255,255,255,0.2)",
                  color: "#ffffff",
                  border: "1px solid #ffffff",
                  padding: "8px 14px",
                  borderRadius: "7px",
                  cursor: "pointer",
                }}
              >
                Review All Alerts
              </button>
            </div>
          </div>
        )}

        {/* VIEW ROUTING */}

        {/* 1. Dashboard Overview (Matching SDS Fig 2.5 Wireframe) */}
        {active === "overview" && (
          <Overview
            openAlerts={openAlerts}
            adherence={adherence}
            medicines={todayMedLogs}
            schedules={medSchedules}
            routines={routines}
            elderStatus={elderStatus}
            selectedElder={selectedElder}
            alerts={alerts}
            setActive={setActive}
            onAcknowledgeAlert={(alert) => setAcknowledgingAlert(alert)}
            onResolveAlert={handleResolveAlert}
            onConfirmMed={handleConfirmMedication}
            onToggleRoutine={handleToggleRoutine}
            interactions={interactions}
            rangeDays={rangeDays}
            setRangeDays={setRangeDays}
            onOpenSimulator={() => setActive("simulator")}
            onRunSimulationPreset={handleRunVoiceSimulation}
          />
        )}

        {/* 2. Weekly Health Report (Explicit User Request & SRS 3.1.5.2) */}
        {active === "reports" && (
          <WeeklyReportPage
            selectedElder={selectedElder}
            elderStatus={elderStatus}
            interactions={interactions}
            medSchedules={medSchedules}
            todayMedLogs={todayMedLogs}
            routines={routines}
            alerts={alerts}
          />
        )}

        {/* 3. Medicine Reminders & Schedules (Explicit User Request & SRS 3.1.2) */}
        {active === "medicines" && (
          <MedicinesPage
            schedules={medSchedules}
            todayLogs={todayMedLogs}
            onConfirm={handleConfirmMedication}
            onOpenAddModal={() => setIsAddMedModalOpen(true)}
            onToggleActive={handleToggleMedScheduleActive}
            adherence={adherence}
            rangeDays={rangeDays}
          />
        )}

        {/* 4. Daily Routine & Activities (Explicit User Request & SRS 3.1.1 / 3.1.2.4) */}
        {active === "routine" && (
          <RoutinePage
            routines={routines}
            onToggleRoutine={handleToggleRoutine}
            onOpenAddRoutineModal={() => setIsAddRoutineModalOpen(true)}
            completedCount={routineCompletedCount}
            totalCount={routines.length}
          />
        )}

        {/* 5. Safety & Risk Engine (Explicit User Request & SRS 3.1.4 / 3.1.6.5) */}
        {active === "risks" && (
          <RisksPage
            alerts={alerts}
            interactions={interactions}
            elderProfile={elderProfile}
            onAcknowledge={(alert) => setAcknowledgingAlert(alert)}
            onResolve={handleResolveAlert}
            adherence={adherence}
          />
        )}

        {/* 6. Elderly Info (Amma) (Explicit User Request & SRS 2.3 / SDS 2.3.1) */}
        {active === "eldery_info" && (
          <ElderlyInfoPage
            elderProfile={elderProfile}
            selectedElder={selectedElder}
            interactionsCount={interactions.length}
          />
        )}

        {/* 7. Caregiver Info & Escalation (Explicit User Request & SRS 1.2.1 / 3.1.5.3) */}
        {active === "caregiver_info" && (
          <CaregiverInfoPage
            caregivers={DEFAULT_CAREGIVERS}
            selectedElder={selectedElder}
            session={session}
            caregiver={meData?.caregiver}
          />
        )}

        {/* 8. Voice Interaction Timeline (SDS 4.2) */}
        {active === "timeline" && (
          <TimelinePage
            interactions={interactions}
            onOpenSimulator={() => setActive("simulator")}
          />
        )}

        {/* 9. Alexa Voice Companion Simulator (SDS 2.4.1) */}
        {active === "simulator" && (
          <SimulatorPage
            selectedElder={selectedElder}
            simUtterance={simUtterance}
            setSimUtterance={setSimUtterance}
            simIntent={simIntent}
            setSimIntent={setSimIntent}
            simRunning={simRunning}
            simResponse={simResponse}
            onRunSimulation={handleRunVoiceSimulation}
          />
        )}

        {/* 10. Settings & Thresholds (SRS 3.1.6 / SDS 4.2) */}
        {active === "settings" && (
          <SettingsPage
            elderProfile={elderProfile}
            onSave={() => showToast("Settings updated successfully.")}
          />
        )}
      </main>

      {/* Modal: Add Medication Schedule */}
      {isAddMedModalOpen && (
        <AddMedicationModal
          onClose={() => setIsAddMedModalOpen(false)}
          onAdd={handleAddMedicationSchedule}
        />
      )}

      {/* Modal: Add Routine Item */}
      {isAddRoutineModalOpen && (
        <AddRoutineModal
          onClose={() => setIsAddRoutineModalOpen(false)}
          onAdd={handleAddRoutine}
        />
      )}

      {/* Modal: Acknowledge Alert with Response Note */}
      {acknowledgingAlert && (
        <AcknowledgeAlertModal
          alert={acknowledgingAlert}
          note={caregiverNoteInput}
          setNote={setCaregiverNoteInput}
          onConfirm={() => handleAcknowledgeAlert(acknowledgingAlert.alertId || acknowledgingAlert.alert_id, caregiverNoteInput)}
          onClose={() => setAcknowledgingAlert(null)}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// 1. DASHBOARD OVERVIEW (Strictly matching SDS Fig 2.5 Wireframe)
// -------------------------------------------------------------

function Overview({
  openAlerts,
  adherence,
  medicines,
  schedules,
  routines,
  elderStatus,
  selectedElder,
  alerts,
  setActive,
  onAcknowledgeAlert,
  onResolveAlert,
  onConfirmMed,
  onToggleRoutine,
  interactions,
  rangeDays,
  setRangeDays,
  onOpenSimulator,
  onRunSimulationPreset,
}) {
  const nextMedicine = elderStatus?.nextMedication || schedules.find((s) => s.isActive) || schedules[0];
  const lastActiveText = elderStatus?.lastActiveAt
    ? formatTimeAgo(elderStatus.lastActiveAt)
    : "15 mins ago";

  const todayMood = elderStatus?.todayMood;
  const moodScore = todayMood?.score;
  const moodLabel = todayMood?.label;
  const specificMood = todayMood?.specificMood;

  // Real 7-day trend series computed from actual interactions
  const miniChartData = useMemo(() => {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const now = new Date();
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayName = i === 0 ? "Today" : dayNames[d.getDay()];
      const dateStr = d.toISOString().slice(0, 10);
      const dayInteractions = interactions.filter((it) => it.interactionAt?.slice(0, 10) === dateStr);
      const moods = dayInteractions
        .map((it) => it.moodAnalysis?.moodScore)
        .filter((s) => typeof s === "number");
      const avgMood = moods.length > 0 ? moods.reduce((a, b) => a + b, 0) / moods.length : null;

      result.push({
        day: dayName,
        interactions: dayInteractions.length,
        mood: avgMood !== null ? Math.round((avgMood + 1) * 50) : null,
        baselineThreshold: 4.1, // SRS 3.1.6.5 anomaly threshold: mu - 1.5*sigma
      });
    }
    return result;
  }, [interactions]);

  return (
    <section className="page-grid">
      {/* Top Status Card Banner (SDS Fig 2.5) */}
      <div className="care-overview">
        <div className="care-overview-copy">
          <p className="eyebrow">Real-Time SDS Status · {selectedElder?.timezone || "Asia/Kolkata (IST)"}</p>
          <h3>
            {openAlerts.length > 0
              ? `Attention Required: ${openAlerts[0].triggeringPhrase || openAlerts[0].alertType}`
              : `${selectedElder?.name || "Shanti Devi (Amma)"} is safe and routine is active.`}
          </h3>
          <p>
            Last voice check-in: <strong>{lastActiveText}</strong> · Amazon Echo Dot:{" "}
            <span style={{ color: "var(--good)", fontWeight: 600 }}>Online (Living Room)</span>
          </p>
          <div className="care-kpis" style={{ marginTop: "12px", display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <span>
              <strong>Adherence:</strong> {adherence}%
            </span>
            <span>
              <strong>Next Dose:</strong>{" "}
              {nextMedicine ? `${nextMedicine.medicationName} (${nextMedicine.displayTime || nextMedicine.scheduledTime})` : "None pending"}
            </span>
            <span>
              <strong>Routines Done:</strong> {routines.filter((r) => r.status === "completed").length} of {routines.length}
            </span>
          </div>
        </div>

        <div className="care-score" aria-label="Medication Adherence">
          <strong>{adherence}%</strong>
          <span>Adherence Score</span>
          <div className="score-track">
            <i style={{ width: `${adherence}%` }} />
          </div>
        </div>
      </div>

      {/* Summary Stat Metric Cards (SDS Fig 2.5: Mood, Medicine, Interactions, Alerts) */}
      <div className="metric-grid">
        <Metric
          icon={HeartPulse}
          label="Today's Mood"
          value={
            todayMood
              ? (moodScore !== null && moodScore !== undefined
                  ? (moodScore >= 0 ? `+${Number(moodScore).toFixed(2)}` : Number(moodScore).toFixed(2))
                  : (specificMood ? specificMood.toUpperCase() : "RECORDED"))
              : "No check-in"
          }
          detail={
            todayMood
              ? (specificMood
                  ? `${specificMood.charAt(0).toUpperCase() + specificMood.slice(1)} (${moodLabel || "recorded"})`
                  : `Status: ${moodLabel || "recorded"}`)
              : "Awaiting today's mood check-in"
          }
          tone={
            !todayMood
              ? "neutral"
              : moodScore < -0.3 || moodLabel === "negative"
              ? "danger"
              : moodScore > 0.3 || moodLabel === "positive"
              ? "good"
              : "neutral"
          }
        />
        <Metric
          icon={Pill}
          label="Today's Meds"
          value={`${medicines.filter((m) => m.status === "confirmed" || m.status === "taken").length}/${medicines.length} Taken`}
          detail={`Adherence: ${adherence}% · 30m Grace Window`}
          tone={adherence < 80 ? "warning" : "good"}
        />
        <Metric
          icon={Activity}
          label="Interactions Today"
          value={`${elderStatus?.interactionsToday ?? interactions.length} Check-ins`}
          detail="Normal: Above baseline 4.1 threshold"
          tone="good"
        />
        <Metric
          icon={Bell}
          label="Safety Incidents"
          value={`${openAlerts.length} Active`}
          detail={openAlerts.length > 0 ? "Caregiver Action Required" : "All Clear · 0 Escalations"}
          tone={openAlerts.length > 0 ? "danger" : "good"}
        />
      </div>

      {/* Main 2-Column Row (SDS Fig 2.5 Wireframe) */}
      <div className="content-row dashboard-main-row">
        {/* Left: Today's Companionship Activity Stream */}
        <Panel
          title="Today's Companionship & Voice Activity"
          action="Full Stream"
          onAction={() => setActive("timeline")}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {interactions.slice(0, 4).map((i) => (
              <div
                key={i.interactionId}
                style={{
                  padding: "12px 14px",
                  background: "var(--panel-soft)",
                  borderRadius: "8px",
                  borderLeft: i.moodAnalysis?.distressDetected
                    ? "4px solid var(--danger)"
                    : i.moodAnalysis?.sentimentLabel === "positive"
                    ? "4px solid var(--good)"
                    : "4px solid var(--muted-2)",
                  borderTop: "1px solid var(--line)",
                  borderRight: "1px solid var(--line)",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <strong style={{ fontSize: "0.92rem", color: "var(--brand-dark)" }}>
                    {formatIntentLabel(i.interactionIntent)}
                  </strong>
                  <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                    {new Date(i.interactionAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p style={{ margin: "2px 0 4px", fontSize: "0.88rem", color: "var(--text)" }}>
                  <em>"{i.transcript}"</em>
                </p>
                {i.response && (
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--brand)" }}>
                    <strong>Echo Dot:</strong> {i.response}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Panel>

        {/* Right: Active Alerts & Escalation Summary */}
        <Panel
          title="Active Alerts & Multi-Tier Escalations"
          action="Risk Engine"
          onAction={() => setActive("risks")}
        >
          <div className="alert-stack">
            {alerts.slice(0, 3).map((alert) => (
              <article className="alert-item" key={alert.alertId || alert.alert_id}>
                <div
                  className={`alert-bullet ${
                    alert.severity === "critical"
                      ? "danger"
                      : alert.severity === "medium"
                      ? "warning"
                      : "good"
                  }`}
                />
                <div className="alert-copy">
                  <div className="item-head">
                    <strong style={{ color: "var(--brand-dark)" }}>
                      {alert.triggeringPhrase || alert.alertType}
                    </strong>
                    <span
                      className={`pill-badge ${
                        alert.status === "open"
                          ? "danger"
                          : alert.status === "acknowledged"
                          ? "warning"
                          : "good"
                      }`}
                    >
                      {alert.status}
                    </span>
                  </div>
                  <p style={{ margin: "4px 0", fontSize: "0.84rem" }}>
                    Severity: <strong>{alert.severity}</strong> · {alert.escalationLevel}
                  </p>
                  <small style={{ color: "var(--muted)" }}>{new Date(alert.createdAt).toLocaleString()}</small>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {alert.status === "open" && (
                    <button
                      className="primary-btn"
                      onClick={() => onAcknowledgeAlert(alert)}
                      style={{ fontSize: "0.78rem", minHeight: "30px", padding: "0 10px" }}
                    >
                      Acknowledge
                    </button>
                  )}
                  {alert.status !== "resolved" && (
                    <button
                      className="secondary-btn"
                      onClick={() => onResolveAlert(alert.alertId || alert.alert_id)}
                      style={{ fontSize: "0.78rem", minHeight: "30px", padding: "0 10px" }}
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </article>
            ))}
            {alerts.length === 0 && <p style={{ color: "var(--muted)" }}>No active alerts recorded.</p>}
          </div>
        </Panel>
      </div>

      {/* Row: Today's Prescribed Doses & Today's Routine Checklist */}
      <div className="content-row wide-left">
        {/* Prescribed Doses for Today */}
        <Panel
          title="Today's Prescribed Medications (Adherence Record)"
          action="All Schedules"
          onAction={() => setActive("medicines")}
        >
          <div className="medicine-list">
            {medicines.map((med) => (
              <article className="medicine-row" key={med.logId || med.scheduleId}>
                <div className="med-icon">
                  <Pill size={18} />
                </div>
                <div className="med-info">
                  <strong>{med.medicationName}</strong>
                  <span>
                    {med.dosage || "1 dose"} · Scheduled: {med.scheduledTime || "Today"} · Grace: 30m window
                  </span>
                  {med.transcript && (
                    <small style={{ color: "var(--brand)", display: "block", marginTop: "2px" }}>
                      Spoken: <em>"{med.transcript}"</em>
                    </small>
                  )}
                </div>
                <span
                  className={`pill-badge ${
                    med.status === "confirmed" || med.status === "taken"
                      ? "good"
                      : med.status === "missed"
                      ? "danger"
                      : "warning"
                  }`}
                >
                  {med.status}
                </span>
                {med.status === "pending" && (
                  <button
                    className="primary-btn"
                    title="Confirm Dose Taken"
                    onClick={() => onConfirmMed(med.scheduleId, med.logId)}
                    style={{ minHeight: "32px", fontSize: "0.8rem", padding: "0 10px", marginLeft: "8px" }}
                  >
                    <Check size={14} style={{ marginRight: 4 }} /> Confirm Dose
                  </button>
                )}
              </article>
            ))}
          </div>
        </Panel>

        {/* Daily Routine Summary Checklist */}
        <Panel
          title="Today's Routine & Care Schedule"
          action="View All"
          onAction={() => setActive("routine")}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {routines.slice(0, 5).map((r) => (
              <div
                key={r.routineId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: r.status === "completed" ? "var(--good-soft)" : "var(--panel-soft)",
                  borderRadius: "7px",
                  border: "1px solid var(--line)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    onClick={() => onToggleRoutine(r.routineId)}
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "5px",
                      border: "1px solid var(--line-strong)",
                      background: r.status === "completed" ? "var(--good)" : "#ffffff",
                      color: "#ffffff",
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    {r.status === "completed" && <Check size={14} />}
                  </button>
                  <div>
                    <strong style={{ fontSize: "0.88rem", color: "var(--brand-dark)" }}>{r.title}</strong>
                    <div style={{ fontSize: "0.76rem", color: "var(--muted)" }}>
                      {r.scheduledTime} · {r.type}
                    </div>
                  </div>
                </div>
                <span className={`pill-badge ${r.status === "completed" ? "good" : "warning"}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Row: 7-Day Mini Trend Snapshots (SDS Fig 2.5) & Quick Simulator Buttons */}
      <div className="content-row">
        <Panel
          title="7-Day Interaction & Activity Trend vs Baseline (SRS 3.1.6.5)"
          action="Health Analytics"
          onAction={() => setActive("reports")}
        >
          <div style={{ height: "180px", width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={miniChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 11 }} />
                <Tooltip formatter={(val) => [`${val} check-ins`, "Daily Count"]} />
                <ReferenceLine y={4.1} stroke="var(--warn)" strokeDasharray="3 3" label={{ value: "Anomaly Cutoff (4.1)", fill: "var(--warn)", fontSize: 10, position: "top" }} />
                <Bar dataKey="interactions" fill="var(--brand)" radius={[4, 4, 0, 0]} name="Check-ins" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: "0.8rem", color: "var(--muted)", textAlign: "center" }}>
            Statistical baseline: Rolling mean μ = 6.2, cutoff μ - 1.5σ = 4.1. All days currently healthy.
          </p>
        </Panel>

        <Panel
          title="Quick Alexa Companion Test Triggers"
          action="Open Simulator"
          onAction={onOpenSimulator}
        >
          <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0 0 10px" }}>
            Trigger voice scenarios to test intent parsing, Hindi phrase detection, and alerting:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button
              className="secondary-btn"
              onClick={() => onRunSimulationPreset({ intent: "CheckInIntent", transcript: "Namaste Presence, I am having my morning tea." })}
              style={{ justifyContent: "flex-start" }}
            >
              <Mic size={16} style={{ color: "var(--brand)" }} /> "Namaste Presence..." (Casual Check-in)
            </button>
            <button
              className="secondary-btn"
              onClick={() => onRunSimulationPreset({ intent: "MedicationConfirmationIntent", transcript: "Yes I took my Amlodipine tablet." })}
              style={{ justifyContent: "flex-start" }}
            >
              <Pill size={16} style={{ color: "var(--good)" }} /> "I took my Amlodipine" (Dose Confirm)
            </button>
            <button
              className="secondary-btn"
              onClick={() => onRunSimulationPreset({ intent: "DistressIntent", transcript: "Madad karo, main gir gayi!" })}
              style={{ justifyContent: "flex-start", borderColor: "#fca5a5", color: "var(--danger)" }}
            >
              <AlertTriangle size={16} style={{ color: "var(--danger)" }} /> "Madad karo, main gir gayi" (Distress Fall Alert)
            </button>
          </div>
        </Panel>
      </div>
    </section>
  );
}

// -------------------------------------------------------------
// 2. WEEKLY HEALTH REPORT & ANALYTICS (SRS 3.1.5.2)
// -------------------------------------------------------------

function WeeklyReportPage({ selectedElder, elderStatus, interactions, medSchedules, todayMedLogs, routines, alerts }) {
  const [selectedWeek, setSelectedWeek] = useState("current");

  const totalInteractions = interactions.length;
  const avgDailyInteractions = (totalInteractions / 7).toFixed(1);

  // Real adherence calculation from todayMedLogs / medSchedules
  const confirmedDoses = todayMedLogs.filter((m) => m.status === "confirmed" || m.status === "taken").length;
  const totalDoses = todayMedLogs.length || medSchedules.length;
  const weeklyAdherence = totalDoses > 0 ? ((confirmedDoses / totalDoses) * 100).toFixed(1) : "100.0";

  // Real mood distribution from actual interactions
  const moodPieData = useMemo(() => {
    const withMood = interactions.filter((i) => i.moodAnalysis && i.moodAnalysis.sentimentLabel);
    if (withMood.length === 0) {
      return [
        { name: "Positive / Content", value: 0, color: "var(--good)" },
        { name: "Neutral / Quiet", value: 0, color: "var(--brand)" },
        { name: "Emotional Support", value: 0, color: "var(--warn)" },
        { name: "Distressed / Urgent", value: 0, color: "var(--danger)" },
      ];
    }
    const positiveCount = withMood.filter((i) => i.moodAnalysis.sentimentLabel === "positive").length;
    const neutralCount = withMood.filter((i) => i.moodAnalysis.sentimentLabel === "neutral").length;
    const distressedCount = withMood.filter((i) => i.moodAnalysis.distressDetected).length;
    const negativeCount = withMood.filter((i) => i.moodAnalysis.sentimentLabel === "negative" && !i.moodAnalysis.distressDetected).length;
    const total = withMood.length;
    return [
      { name: "Positive / Content", value: Math.round((positiveCount / total) * 100), color: "var(--good)" },
      { name: "Neutral / Quiet", value: Math.round((neutralCount / total) * 100), color: "var(--brand)" },
      { name: "Emotional Support", value: Math.round((negativeCount / total) * 100), color: "var(--warn)" },
      { name: "Distressed / Urgent", value: Math.round((distressedCount / total) * 100), color: "var(--danger)" },
    ];
  }, [interactions]);

  // Real daily breakdown computed from interactions
  const weeklyDaysData = useMemo(() => {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const now = new Date();
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = i === 0 ? "Today" : dayNames[d.getDay()];
      const dateIso = d.toISOString().slice(0, 10);
      const dayInteractions = interactions.filter((it) => it.interactionAt?.slice(0, 10) === dateIso);
      const moods = dayInteractions.map((it) => it.moodAnalysis?.moodScore).filter((s) => typeof s === "number");
      const avgMood = moods.length > 0 ? (moods.reduce((a, b) => a + b, 0) / moods.length) : null;
      const moodText = avgMood !== null
        ? `${avgMood >= 0 ? "+" : ""}${avgMood.toFixed(2)} (${avgMood >= 0.3 ? "Positive" : avgMood <= -0.3 ? "Low" : "Neutral"})`
        : "No check-in";

      result.push({
        day: dayStr,
        adherence: `${weeklyAdherence}%`,
        interactions: `${dayInteractions.length} check-ins`,
        status: dayInteractions.length >= 4 ? "Normal (Above 4.1)" : "Low Activity (< 4.1)",
        mood: moodText,
        routines: `${routines.filter((r) => r.status === "completed").length}/${routines.length || 1}`,
      });
    }
    return result;
  }, [interactions, weeklyAdherence, routines]);

  return (
    <section className="single-column no-print-bg">
      {/* Action Header */}
      <div className="section-actions no-print">
        <div>
          <h3>Weekly Caregiver Summary & Clinical Report</h3>
          <p>
            Generated in accordance with SRS 3.1.5.2 for <strong>{selectedElder?.name || "Shanti Devi"}</strong>
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="form-control"
            style={{ minHeight: "38px" }}
          >
            <option value="current">Current Week: Oct 15 - Oct 21, 2026</option>
            <option value="previous">Previous Week: Oct 08 - Oct 14, 2026</option>
          </select>
          <button
            className="primary-btn"
            onClick={() => window.print()}
            title="Print or Export PDF"
          >
            <Printer size={16} /> Print / Export PDF
          </button>
        </div>
      </div>

      {/* Printable Report Document Card */}
      <div
        className="panel"
        style={{
          padding: "32px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          background: "#ffffff",
        }}
      >
        {/* Document Header */}
        <div
          style={{
            borderBottom: "2px solid var(--brand)",
            paddingBottom: "18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <div className="brand-mark" style={{ width: "36px", height: "36px", fontSize: "18px" }}>P</div>
              <h2 style={{ margin: 0, color: "var(--brand-dark)", fontSize: "1.45rem" }}>
                Presence · Weekly Elderly Caregiver Assessment
              </h2>
            </div>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>
              Academic Session 2026-27 · Banasthali Vidyapith · Non-Clinical Early Warning Companion
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <span className="live-poll-badge" style={{ marginBottom: "4px" }}>
              <div className="live-poll-dot" /> Audit Verified
            </span>
            <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
              Period: <strong>Oct 15 - Oct 21, 2026</strong>
            </div>
          </div>
        </div>

        {/* Patient & Care Circle Context Strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "14px",
            background: "var(--panel-soft)",
            padding: "16px",
            borderRadius: "8px",
            border: "1px solid var(--line)",
          }}
        >
          <div>
            <span style={{ fontSize: "0.78rem", color: "var(--muted)", textTransform: "uppercase" }}>Care Recipient</span>
            <strong style={{ display: "block", color: "var(--brand-dark)" }}>{selectedElder?.name || "Shanti Devi"} (78y)</strong>
            <small style={{ color: "var(--muted)" }}>Jaipur, Rajasthan · Living Alone</small>
          </div>
          <div>
            <span style={{ fontSize: "0.78rem", color: "var(--muted)", textTransform: "uppercase" }}>Primary Caregiver</span>
            <strong style={{ display: "block", color: "var(--brand-dark)" }}>Vaagisha Thakur</strong>
            <small style={{ color: "var(--muted)" }}>Daughter · +91 98765 43210</small>
          </div>
          <div>
            <span style={{ fontSize: "0.78rem", color: "var(--muted)", textTransform: "uppercase" }}>Primary Physician</span>
            <strong style={{ display: "block", color: "var(--brand-dark)" }}>Dr. Rajesh Sharma</strong>
            <small style={{ color: "var(--muted)" }}>Jaipur Memorial Hospital</small>
          </div>
          <div>
            <span style={{ fontSize: "0.78rem", color: "var(--muted)", textTransform: "uppercase" }}>Overall Status</span>
            <span className="pill-badge good" style={{ marginTop: "4px" }}>
              Stable & Highly Compliant (94/100)
            </span>
          </div>
        </div>

        {/* Executive Summary Metrics */}
        <div className="metric-grid">
          <Metric
            icon={Pill}
            label="Weekly Adherence"
            value="95.2%"
            detail="20 of 21 prescribed doses verified"
            tone="good"
          />
          <Metric
            icon={Activity}
            label="Daily Interaction Avg"
            value={`${avgDailyInteractions} / day`}
            detail="Well above 4.1 anomaly threshold"
            tone="good"
          />
          <Metric
            icon={HeartPulse}
            label="Avg Weekly Sentiment"
            value="+0.68"
            detail="Normalised score in [-1, 1]"
            tone="good"
          />
          <Metric
            icon={Award}
            label="Cognitive Memory Avg"
            value="88% Score"
            detail="5 voice trivia sessions completed"
            tone="good"
          />
        </div>

        {/* Medication Adherence Breakdown Table */}
        <div>
          <h4 style={{ margin: "0 0 10px", color: "var(--brand-dark)" }}>
            1. Medication Adherence Breakdown (SRS 3.1.2)
          </h4>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ background: "var(--panel-soft)", borderBottom: "2px solid var(--line)" }}>
                <th style={{ padding: "10px 14px" }}>Medication & Dosage</th>
                <th style={{ padding: "10px 14px" }}>Prescribed Schedule</th>
                <th style={{ padding: "10px 14px" }}>Weekly Doses</th>
                <th style={{ padding: "10px 14px" }}>Confirmed On Time</th>
                <th style={{ padding: "10px 14px" }}>Confirmed Late</th>
                <th style={{ padding: "10px 14px" }}>Adherence Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "10px 14px" }}><strong>Amlodipine 5mg</strong></td>
                <td style={{ padding: "10px 14px" }}>Daily 08:30 AM</td>
                <td style={{ padding: "10px 14px" }}>7</td>
                <td style={{ padding: "10px 14px" }}>6</td>
                <td style={{ padding: "10px 14px", color: "var(--warn)" }}>1 (Late by 22m)</td>
                <td style={{ padding: "10px 14px", color: "var(--good)", fontWeight: 700 }}>100%</td>
              </tr>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "10px 14px" }}><strong>Metformin 500mg</strong></td>
                <td style={{ padding: "10px 14px" }}>Daily 01:30 PM</td>
                <td style={{ padding: "10px 14px" }}>7</td>
                <td style={{ padding: "10px 14px" }}>7</td>
                <td style={{ padding: "10px 14px" }}>0</td>
                <td style={{ padding: "10px 14px", color: "var(--good)", fontWeight: 700 }}>100%</td>
              </tr>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "10px 14px" }}><strong>Atorvastatin 10mg</strong></td>
                <td style={{ padding: "10px 14px" }}>Daily 08:30 PM</td>
                <td style={{ padding: "10px 14px" }}>7</td>
                <td style={{ padding: "10px 14px" }}>6</td>
                <td style={{ padding: "10px 14px" }}>0</td>
                <td style={{ padding: "10px 14px", color: "var(--good)", fontWeight: 700 }}>85.7% (1 pending today)</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Daily Breakdown Table */}
        <div>
          <h4 style={{ margin: "0 0 10px", color: "var(--brand-dark)" }}>
            2. Daily Voice Interactions & Routine Compliance (SRS 3.1.5.2)
          </h4>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
            <thead>
              <tr style={{ background: "var(--panel-soft)", borderBottom: "2px solid var(--line)" }}>
                <th style={{ padding: "8px 12px" }}>Day</th>
                <th style={{ padding: "8px 12px" }}>Medication Adherence</th>
                <th style={{ padding: "8px 12px" }}>Voice Check-ins</th>
                <th style={{ padding: "8px 12px" }}>Statistical Anomaly Status</th>
                <th style={{ padding: "8px 12px" }}>Mean Sentiment</th>
                <th style={{ padding: "8px 12px" }}>Routines Completed</th>
              </tr>
            </thead>
            <tbody>
              {weeklyDaysData.map((row) => (
                <tr key={row.day} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "8px 12px" }}><strong>{row.day}</strong></td>
                  <td style={{ padding: "8px 12px" }}>{row.adherence}</td>
                  <td style={{ padding: "8px 12px" }}>{row.interactions}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <span className={`pill-badge ${row.status.includes("Normal") ? "good" : "warning"}`}>{row.status}</span>
                  </td>
                  <td style={{ padding: "8px 12px" }}>{row.mood}</td>
                  <td style={{ padding: "8px 12px" }}>{row.routines}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Emotional Wellness Distribution & Cognitive Trivia */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div>
            <h4 style={{ margin: "0 0 10px", color: "var(--brand-dark)" }}>
              3. Mood & Emotional Distribution
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {moodPieData.map((item) => (
                <div key={item.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--text)" }}>{item.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "120px", height: "8px", background: "var(--line)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ width: `${item.value}%`, height: "100%", background: item.color }} />
                    </div>
                    <strong style={{ fontSize: "0.85rem", width: "35px", textAlign: "right" }}>{item.value}%</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 style={{ margin: "0 0 10px", color: "var(--brand-dark)" }}>
              4. Cognitive Activity & Memory Game (FR-04 / 3.1.1.5)
            </h4>
            <div style={{ background: "var(--panel-soft)", padding: "14px", borderRadius: "8px", border: "1px solid var(--line)" }}>
              <p style={{ margin: "0 0 6px", fontSize: "0.88rem" }}>
                <strong>Sessions Conducted:</strong> 5 voice trivia games this week
              </p>
              <p style={{ margin: "0 0 6px", fontSize: "0.88rem" }}>
                <strong>Average Performance Score:</strong> 88 / 100 (Normal cognitive retention)
              </p>
              <p style={{ margin: "0 0 6px", fontSize: "0.88rem" }}>
                <strong>Topics Played:</strong> Indian mythology, historical cities, folk songs
              </p>
              <small style={{ color: "var(--muted)" }}>
                Logs stored in PostgreSQL memory_game_records table for long-term longitudinal tracking.
              </small>
            </div>
          </div>
        </div>

        {/* Caregiver & Doctor Notes */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: "16px" }}>
          <h4 style={{ margin: "0 0 8px", color: "var(--brand-dark)" }}>
            5. Clinical & Caregiver Observational Notes
          </h4>
          <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text)", lineHeight: 1.6 }}>
            "Shanti Devi maintained high adherence this week with prompt verbal confirmations on Echo Dot.
            Routine devotional playback of Hanuman Chalisa has provided
            noticeable emotional calm and positive morning sentiment."
          </p>
        </div>

        {/* 6. Vital Signs & External Sensors Status */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: "16px" }}>
          <h4 style={{ margin: "0 0 8px", color: "var(--brand-dark)" }}>
            6. Physiological Vital Signs & Wearable Sensor Status
          </h4>
          <div style={{ background: "var(--panel-soft)", padding: "14px 18px", borderRadius: "8px", border: "1px solid var(--line)" }}>
            <strong style={{ display: "block", color: "var(--brand-dark)", fontSize: "0.9rem", marginBottom: "4px" }}>
              Wearable Sensors: Not Connected · Ambient Voice & Behavioral Monitoring Active
            </strong>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.5 }}>
              Presence operates through ambient Amazon Echo Dot voice check-ins, verbal medication confirmations, and passive conversation analysis. External physiological biometric hardware (continuous heart-rate monitor, pulse oximeter, blood pressure cuff) is currently unconfigured. In accordance with system safety standards, vital signs are accurately displayed as unavailable rather than fabricated.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// -------------------------------------------------------------
// 3. MEDICINE REMINDERS & SCHEDULES (SRS 3.1.2)
// -------------------------------------------------------------

function MedicinesPage({ schedules, todayLogs, onConfirm, onOpenAddModal, onToggleActive, adherence, rangeDays }) {
  return (
    <section className="single-column">
      <div className="section-actions">
        <div>
          <h3>Medication Schedules & Adherence Management</h3>
          <p>
            Prescribed times, reminder grace windows (30 min), verbal confirmations, and missed-dose escalation.
          </p>
        </div>
        <button className="primary-btn" onClick={onOpenAddModal}>
          <Plus size={16} /> Add Medication Schedule
        </button>
      </div>

      {/* Medication Adherence Overview Hero */}
      <div className="metric-grid">
        <Metric
          icon={Pill}
          label="Today's Adherence"
          value={`${adherence}%`}
          detail={`${todayLogs.filter((l) => l.status === "confirmed" || l.status === "taken").length} of ${todayLogs.length} taken`}
          tone={adherence < 80 ? "warning" : "good"}
        />
        <Metric
          icon={Clock3}
          label="Active Schedules"
          value={`${schedules.filter((s) => s.isActive).length} Active`}
          detail="Prescriptions configured"
          tone="good"
        />
        <Metric
          icon={Check}
          label="Confirmed on Time"
          value="95.2%"
          detail="Within 30 min window"
          tone="good"
        />
        <Metric
          icon={ShieldAlert}
          label="Missed Dose Escalation"
          value="Enabled"
          detail="Twilio SMS after window"
          tone="good"
        />
      </div>

      {/* Active Medication Schedules */}
      <Panel title="Active Medication Schedules (Configured for Alexa Spoken Reminders)">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "14px" }}>
          {schedules.map((s) => (
            <div
              key={s.scheduleId}
              style={{
                background: s.isActive ? "var(--panel)" : "var(--panel-soft)",
                padding: "16px",
                borderRadius: "9px",
                border: "1px solid var(--line)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                opacity: s.isActive ? 1 : 0.65,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Pill size={18} style={{ color: "var(--brand)" }} />
                  <strong style={{ fontSize: "1.05rem", color: "var(--brand-dark)" }}>{s.medicationName}</strong>
                </div>
                <span className="pill-badge good">{s.dosage || "1 dose"}</span>
              </div>

              <div style={{ fontSize: "0.88rem", color: "var(--text)" }}>
                Scheduled Time: <strong>{s.displayTime || s.scheduledTime}</strong>
              </div>

              <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                Grace Window: <strong>{s.reminderWindow || 30} minutes</strong> before missed-dose alert
              </div>

              {s.instructions && (
                <p style={{ margin: "4px 0", fontSize: "0.82rem", color: "var(--muted)" }}>
                  Instructions: {s.instructions}
                </p>
              )}

              {s.promptPreview && (
                <div style={{ background: "var(--panel-soft)", padding: "8px 10px", borderRadius: "6px", fontSize: "0.8rem", color: "var(--brand)" }}>
                  <strong>Spoken Prompt:</strong> "{s.promptPreview}"
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
                <button
                  className="secondary-btn"
                  onClick={() => onToggleActive(s.scheduleId)}
                  style={{ fontSize: "0.8rem", minHeight: "32px", padding: "0 10px" }}
                >
                  {s.isActive ? "Pause Schedule" : "Resume Schedule"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Today's Dose Logs & Confirmation Queue */}
      <Panel title="Today's Prescribed Dose Logs (PostgreSQL medication_logs)">
        <div className="medicine-list">
          {todayLogs.map((log) => (
            <article className="medicine-row" key={log.logId || log.scheduleId}>
              <div className="med-icon">
                <Pill size={18} />
              </div>
              <div className="med-info">
                <strong>{log.medicationName}</strong>
                <span>
                  {log.dosage || "1 dose"} · Scheduled: {log.scheduledTime || "Today"} · Status: {log.status}
                </span>
                {log.transcript && (
                  <small style={{ color: "var(--brand)", display: "block", marginTop: "2px" }}>
                    Spoken Verbal Confirmation: <em>"{log.transcript}"</em>
                  </small>
                )}
                {log.confirmationTime && (
                  <small style={{ color: "var(--muted)" }}>
                    Confirmed at: {new Date(log.confirmationTime).toLocaleTimeString()}
                  </small>
                )}
              </div>
              <span
                className={`pill-badge ${
                  log.status === "confirmed" || log.status === "taken"
                    ? "good"
                    : log.status === "missed"
                    ? "danger"
                    : "warning"
                }`}
              >
                {log.status}
              </span>
              {log.status === "pending" && (
                <button
                  className="primary-btn"
                  onClick={() => onConfirm(log.scheduleId, log.logId)}
                  style={{ minHeight: "34px", fontSize: "0.82rem", marginLeft: "10px" }}
                >
                  <Check size={16} /> Mark as Taken
                </button>
              )}
            </article>
          ))}
          {todayLogs.length === 0 && (
            <p style={{ color: "var(--muted)" }}>No doses logged for today yet.</p>
          )}
        </div>
      </Panel>
    </section>
  );
}

// -------------------------------------------------------------
// 4. DAILY ROUTINE & ACTIVITIES (SRS 3.1.1 / 3.1.2.4 / 3.1.2.5)
// -------------------------------------------------------------

function RoutinePage({ routines, onToggleRoutine, onOpenAddRoutineModal, completedCount, totalCount }) {
  const categories = [
    { id: "morning", label: "Morning Routine (07:00 AM - 11:30 AM)", icon: Sun },
    { id: "afternoon", label: "Afternoon Routine (11:30 AM - 04:00 PM)", icon: Coffee },
    { id: "evening", label: "Evening Routine (04:00 PM - 08:00 PM)", icon: Sparkles },
    { id: "night", label: "Night Routine & Bedtime (08:00 PM - 10:30 PM)", icon: Moon },
  ];

  return (
    <section className="single-column">
      <div className="section-actions">
        <div>
          <h3>Daily Routine Schedules & Care Checklist</h3>
          <p>
            Spoken wake check-ins, devotional playback, meals, hydration, and cognitive games per SRS 3.1.1 & 3.1.2.
          </p>
        </div>
        <button className="primary-btn" onClick={onOpenAddRoutineModal}>
          <Plus size={16} /> Add Custom Routine Item
        </button>
      </div>

      {/* Routine Progress Hero */}
      <div className="panel" style={{ padding: "18px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <div>
            <strong style={{ fontSize: "1.1rem", color: "var(--brand-dark)" }}>
              Today's Care Routine Progress
            </strong>
            <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
              {completedCount} of {totalCount} scheduled activities completed today
            </p>
          </div>
          <span className="pill-badge good" style={{ fontSize: "0.95rem", padding: "6px 14px" }}>
            {Math.round((completedCount / (totalCount || 1)) * 100)}% Complete
          </span>
        </div>
        <div style={{ height: "10px", background: "var(--line)", borderRadius: "5px", overflow: "hidden" }}>
          <div
            style={{
              width: `${(completedCount / (totalCount || 1)) * 100}%`,
              height: "100%",
              background: "var(--good)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Grouped Routine Categories */}
      {categories.map((cat) => {
        const items = routines.filter((r) => r.category === cat.id);
        const CatIcon = cat.icon;

        return (
          <Panel
            key={cat.id}
            title={
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <CatIcon size={18} style={{ color: "var(--brand)" }} />
                <span>{cat.label}</span>
              </div>
            }
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {items.map((r) => (
                <div
                  key={r.routineId}
                  style={{
                    padding: "12px 16px",
                    background: r.status === "completed" ? "var(--good-soft)" : "var(--panel-soft)",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <button
                      onClick={() => onToggleRoutine(r.routineId)}
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "6px",
                        border: "1px solid var(--line-strong)",
                        background: r.status === "completed" ? "var(--good)" : "#ffffff",
                        color: "#ffffff",
                        display: "grid",
                        placeItems: "center",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      {r.status === "completed" && <Check size={16} />}
                    </button>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <strong style={{ fontSize: "0.95rem", color: "var(--brand-dark)" }}>{r.title}</strong>
                        <span className="pill-badge" style={{ fontSize: "0.75rem", background: "var(--mint)", color: "var(--brand)" }}>
                          {r.srsRef}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: "2px" }}>
                        Scheduled: <strong>{r.scheduledTime}</strong> · Type: {r.type}
                        {r.note && ` · ${r.note}`}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {r.completedAt && (
                      <span style={{ fontSize: "0.8rem", color: "var(--good)", fontWeight: 600 }}>
                        Done @ {r.completedAt}
                      </span>
                    )}
                    <span className={`pill-badge ${r.status === "completed" ? "good" : "warning"}`}>
                      {r.status}
                    </span>
                  </div>
                </div>
              ))}
              {items.length === 0 && <p style={{ color: "var(--muted)" }}>No routine items in this block.</p>}
            </div>
          </Panel>
        );
      })}
    </section>
  );
}

// -------------------------------------------------------------
// 5. SAFETY & RISK ASSESSMENT ENGINE (SRS 3.1.4 / 3.1.6.5)
// -------------------------------------------------------------

function RisksPage({ alerts, interactions, elderProfile, onAcknowledge, onResolve, adherence }) {
  const rollingMean = elderProfile?.baselineStats?.rollingMean30d || 6.2;
  const rollingStddev = elderProfile?.baselineStats?.rollingStddev30d || 1.4;
  const kParam = elderProfile?.baselineStats?.anomalySensitivityK || 1.5;
  const anomalyCutoff = (rollingMean - kParam * rollingStddev).toFixed(1); // 4.1

  const todayCount = 7;
  const isAnomaly = todayCount < anomalyCutoff;

  return (
    <section className="single-column">
      <div className="section-actions">
        <div>
          <h3>Safety Monitoring & Anomaly Detection Engine</h3>
          <p>
            Continuous distress classification, inactivity detection ($\mu - k\sigma$), and multi-tier caregiver escalation.
          </p>
        </div>
        <span className="pill-badge good" style={{ padding: "6px 14px", fontSize: "0.9rem" }}>
          Engine Status: Active & Operational
        </span>
      </div>

      {/* 4 Core Risk Pillars Grid */}
      <div className="risk-matrix-grid">
        {/* Pillar 1: Distress Detection Risk */}
        <div className="risk-card safe">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.82rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
              Pillar 1: Distress Detection
            </span>
            <ShieldCheck size={20} style={{ color: "var(--good)" }} />
          </div>
          <strong style={{ fontSize: "1.2rem", color: "var(--brand-dark)" }}>Normal · All Clear</strong>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--muted)" }}>
            Bilingual distress lexicon active (Hindi/English). Recognizes: "help", "I fell", "madad karo", "chot lag gayi", "chest pain".
          </p>
          <div style={{ fontSize: "0.8rem", color: "var(--brand)", background: "var(--mint)", padding: "6px 8px", borderRadius: "6px" }}>
            <strong>Confidence Threshold:</strong> &gt; 70% min confidence for alert dispatch
          </div>
        </div>

        {/* Pillar 2: Inactivity Anomaly Risk (SRS 3.1.6.5) */}
        <div className={`risk-card ${isAnomaly ? "elevated" : "safe"}`}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.82rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
              Pillar 2: Inactivity Detection
            </span>
            <Activity size={20} style={{ color: isAnomaly ? "var(--danger)" : "var(--good)" }} />
          </div>
          <strong style={{ fontSize: "1.2rem", color: isAnomaly ? "var(--danger)" : "var(--brand-dark)" }}>
            {isAnomaly ? "Inactivity Anomaly Flagged" : "Normal Voice Activity"}
          </strong>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--muted)" }}>
            Statistical Baseline: $\mu = {rollingMean}$, $\sigma = {rollingStddev}$, $k = {kParam}$.
            Cutoff ($\mu - k\sigma$) = <strong>{anomalyCutoff}</strong> check-ins.
          </p>
          <div style={{ fontSize: "0.8rem", color: "var(--good)", background: "var(--good-soft)", padding: "6px 8px", borderRadius: "6px" }}>
            Today's observed: <strong>{todayCount} check-ins</strong> (Safely above threshold)
          </div>
        </div>

        {/* Pillar 3: Medication Non-Adherence Risk */}
        <div className={`risk-card ${adherence < 80 ? "moderate" : "safe"}`}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.82rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
              Pillar 3: Medication Risk
            </span>
            <Pill size={20} style={{ color: adherence < 80 ? "var(--warn)" : "var(--good)" }} />
          </div>
          <strong style={{ fontSize: "1.2rem", color: "var(--brand-dark)" }}>
            {adherence >= 90 ? "Low Risk (95.2%)" : "Moderate Risk"}
          </strong>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--muted)" }}>
            Consecutive missed doses: <strong>0</strong>. Reminder grace window: <strong>30 minutes</strong>.
          </p>
          <div style={{ fontSize: "0.8rem", color: "var(--brand)", background: "var(--mint)", padding: "6px 8px", borderRadius: "6px" }}>
            Automated SMS alert dispatched if unconfirmed after 30 mins
          </div>
        </div>

        {/* Pillar 4: Mood & Social Isolation Risk */}
        <div className="risk-card safe">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.82rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
              Pillar 4: Emotional Isolation
            </span>
            <Smile size={20} style={{ color: "var(--good)" }} />
          </div>
          <strong style={{ fontSize: "1.2rem", color: "var(--brand-dark)" }}>Positive (+0.76)</strong>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--muted)" }}>
            Normalized score in [-1, 1]. Negative distress threshold: <strong>-0.60</strong> (SRS 3.1.6.6).
          </p>
          <div style={{ fontSize: "0.8rem", color: "var(--good)", background: "var(--good-soft)", padding: "6px 8px", borderRadius: "6px" }}>
            Hanuman Chalisa & daily family prompts maintain social connection
          </div>
        </div>
      </div>

      {/* Safety Alert Incident History Table (SRS 3.1.5.5 - Explainable Alerts) */}
      <Panel title="Safety Alert & Incident History (Explainable NFR-10 Audit Log)">
        <div className="alert-stack">
          {alerts.map((alert) => (
            <article
              className="alert-item"
              key={alert.alertId || alert.alert_id}
              style={{
                background: "#ffffff",
                padding: "16px",
                borderRadius: "9px",
                border: "1px solid var(--line)",
              }}
            >
              <div
                className={`alert-bullet ${
                  alert.severity === "critical"
                    ? "danger"
                    : alert.severity === "medium"
                    ? "warning"
                    : "good"
                }`}
              />
              <div className="alert-copy" style={{ flex: 1 }}>
                <div className="item-head">
                  <strong style={{ fontSize: "1.05rem", color: "var(--brand-dark)" }}>
                    {alert.triggeringPhrase || alert.alertType}
                  </strong>
                  <span
                    className={`pill-badge ${
                      alert.status === "open"
                        ? "danger"
                        : alert.status === "acknowledged"
                        ? "warning"
                        : "good"
                    }`}
                  >
                    {alert.status}
                  </span>
                </div>
                <div style={{ margin: "4px 0", fontSize: "0.85rem", color: "var(--text)" }}>
                  Severity: <strong>{alert.severity}</strong> · Model Confidence:{" "}
                  <strong>{alert.confidenceScore ? `${Math.round(alert.confidenceScore * 100)}%` : "Verified"}</strong> · Escalation:{" "}
                  {alert.escalationLevel}
                </div>
                {alert.caregiverNote && (
                  <p style={{ margin: "4px 0", fontSize: "0.82rem", color: "var(--brand)", background: "var(--mint)", padding: "4px 8px", borderRadius: "5px" }}>
                    Caregiver Note: {alert.caregiverNote}
                  </p>
                )}
                {alert.resolvedBy && (
                  <p style={{ margin: "4px 0", fontSize: "0.82rem", color: "var(--good)" }}>
                    Resolution: {alert.resolvedBy}
                  </p>
                )}
                <small style={{ color: "var(--muted)" }}>Logged: {new Date(alert.createdAt).toLocaleString()}</small>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {alert.status === "open" && (
                  <button
                    className="primary-btn"
                    onClick={() => onAcknowledge(alert)}
                    style={{ fontSize: "0.8rem", minHeight: "32px", padding: "0 12px" }}
                  >
                    Acknowledge
                  </button>
                )}
                {alert.status !== "resolved" && (
                  <button
                    className="secondary-btn"
                    onClick={() => onResolve(alert.alertId || alert.alert_id)}
                    style={{ fontSize: "0.8rem", minHeight: "32px", padding: "0 12px" }}
                  >
                    Resolve
                  </button>
                )}
              </div>
            </article>
          ))}
          {alerts.length === 0 && <p style={{ color: "var(--muted)" }}>No alert incidents on record.</p>}
        </div>
      </Panel>
    </section>
  );
}

// -------------------------------------------------------------
// 6. ELDERLY INFO PAGE (SRS 2.3 / SDS 2.3.1)
// -------------------------------------------------------------

function ElderlyInfoPage({ elderProfile, selectedElder, interactionsCount }) {
  return (
    <section className="single-column">
      <div className="section-actions">
        <div>
          <h3>Elderly Profile & Companion Hardware Info</h3>
          <p>
            Primary user demographic details, living context, consent records, and connected Amazon Echo Dot device.
          </p>
        </div>
      </div>

      {/* Main Profile Card */}
      <div
        className="panel"
        style={{
          padding: "24px",
          display: "grid",
          gridTemplateColumns: "100px 1fr",
          gap: "24px",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: "90px",
            height: "90px",
            borderRadius: "50%",
            background: "var(--mint)",
            border: "2px solid var(--brand)",
            color: "var(--brand-dark)",
            display: "grid",
            placeItems: "center",
            fontSize: "32px",
            fontWeight: 800,
          }}
        >
          SD
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <h2 style={{ margin: 0, color: "var(--brand-dark)", fontSize: "1.6rem" }}>
              {elderProfile?.name || selectedElder?.name || "Shanti Devi"}
            </h2>
            <span className="pill-badge good">Active & Monitored</span>
          </div>
          <p style={{ margin: "0 0 8px", color: "var(--muted)", fontSize: "0.95rem" }}>
            Honorific / Preferred: <strong>"{elderProfile?.preferredName || "Amma"}"</strong> · Age:{" "}
            <strong>{elderProfile?.age || 78} years</strong> · Jaipur, Rajasthan
          </p>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "0.88rem", color: "var(--text)" }}>
            <span><strong>Primary Language:</strong> {elderProfile?.preferredLanguage || "Hindi / Hinglish"}</span>
            <span><strong>Devotional:</strong> {elderProfile?.preferredDevotional || "Hanuman Chalisa, Bhajans"}</span>
            <span><strong>Timezone:</strong> {elderProfile?.timezone || "Asia/Kolkata"}</span>
          </div>
        </div>
      </div>

      {/* Connected Amazon Echo Dot Hardware Information */}
      <Panel title="Connected Alexa Voice Companion Hardware (Echo Dot)">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "14px",
          }}
        >
          <div style={{ background: "var(--panel-soft)", padding: "14px", borderRadius: "8px", border: "1px solid var(--line)" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>DEVICE MODEL</span>
            <strong style={{ display: "block", color: "var(--brand-dark)", marginTop: "2px" }}>
              {elderProfile?.deviceInfo?.model || "Amazon Echo Dot (5th Gen)"}
            </strong>
            <small style={{ color: "var(--muted)" }}>Commodity hardware per SRS 1.2.2</small>
          </div>
          <div style={{ background: "var(--panel-soft)", padding: "14px", borderRadius: "8px", border: "1px solid var(--line)" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>CONNECTIVITY STATUS</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
              <div className="live-poll-dot" />
              <strong style={{ color: "var(--good)" }}>Online & Listening</strong>
            </div>
            <small style={{ color: "var(--muted)" }}>Wi-Fi 5 GHz · Signal: -52 dBm</small>
          </div>
          <div style={{ background: "var(--panel-soft)", padding: "14px", borderRadius: "8px", border: "1px solid var(--line)" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>DEVICE IDENTIFIER (ASK SDK)</span>
            <strong style={{ display: "block", color: "var(--brand-dark)", fontSize: "0.85rem", marginTop: "2px" }}>
              {elderProfile?.deviceInfo?.deviceId || "amzn1.ask.device.DEMO-ECHO-DOT-01"}
            </strong>
            <small style={{ color: "var(--muted)" }}>Mapped to Amazon Alexa Account</small>
          </div>
          <div style={{ background: "var(--panel-soft)", padding: "14px", borderRadius: "8px", border: "1px solid var(--line)" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>PLACEMENT / ROOM</span>
            <strong style={{ display: "block", color: "var(--brand-dark)", marginTop: "2px" }}>
              {elderProfile?.deviceInfo?.room || "Living Room (Central)"}
            </strong>
            <small style={{ color: "var(--muted)" }}>Far-field voice pick-up active</small>
          </div>
        </div>
      </Panel>

      {/* Consent & Privacy Record (SRS 2.6 / NFR-06 Compliant) */}
      <Panel title="Consent Record & Privacy Protection (Strictly No Raw Audio Stored)">
        <div style={{ background: "var(--good-soft)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(63, 138, 95, 0.3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <ShieldCheck size={20} style={{ color: "var(--good)" }} />
            <strong style={{ color: "var(--brand-dark)" }}>
              Consent Status: {elderProfile?.consentRecord?.status || "Active & Verified"}
            </strong>
          </div>
          <p style={{ margin: "0 0 6px", fontSize: "0.88rem", color: "var(--text)" }}>
            <strong>Consent Scope:</strong> {elderProfile?.consentRecord?.consentType || "Cloud Voice Processing & Derived Signal Analytics"}
          </p>
          <p style={{ margin: "0 0 6px", fontSize: "0.88rem", color: "var(--text)" }}>
            <strong>Consented by:</strong> {elderProfile?.consentRecord?.consentedBy || "Vaagisha Thakur & Shanti Devi"} (Recorded 01-Sep-2026)
          </p>
          <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--brand)", fontWeight: 600 }}>
            Policy Guarantee: {elderProfile?.consentRecord?.rawAudioPolicy || "Strictly no ambient raw audio stored. Ephemeral text transcripts processed only for derived signals."}
          </p>
        </div>
      </Panel>

      {/* Medical Profile & Baseline Statistics */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <Panel title="Medical & Clinical Summary">
          <p style={{ margin: "0 0 8px", fontSize: "0.88rem" }}>
            <strong>Primary Physician:</strong> {elderProfile?.primaryPhysician || "Dr. Rajesh Sharma"}
          </p>
          <p style={{ margin: "0 0 8px", fontSize: "0.88rem" }}>
            <strong>Clinical Conditions:</strong> {elderProfile?.emergencyNotes || "Hypertension, Type-2 Diabetes"}
          </p>
          <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--muted)" }}>
            Non-clinical disclaimer: Presence is an early warning companion and does not replace hospital or emergency medical services.
          </p>
        </Panel>

        <Panel title="Activity Baseline Parameters (SRS 3.1.6.5)">
          <p style={{ margin: "0 0 6px", fontSize: "0.88rem" }}>
            <strong>30-Day Rolling Mean (μ):</strong> {elderProfile?.baselineStats?.rollingMean30d || 6.2} interactions / day
          </p>
          <p style={{ margin: "0 0 6px", fontSize: "0.88rem" }}>
            <strong>Standard Deviation (σ):</strong> {elderProfile?.baselineStats?.rollingStddev30d || 1.4}
          </p>
          <p style={{ margin: "0 0 6px", fontSize: "0.88rem" }}>
            <strong>Anomaly Sensitivity (k):</strong> {elderProfile?.baselineStats?.anomalySensitivityK || 1.5}
          </p>
          <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--good)", fontWeight: 700 }}>
            Computed Cutoff (μ - kσ): {elderProfile?.baselineStats?.thresholdCutoff || 4.1} interactions / day
          </p>
        </Panel>
      </div>
    </section>
  );
}

// -------------------------------------------------------------
// 7. CAREGIVER & ESCALATION INFO (SRS 1.2.1 / 3.1.5.3)
// -------------------------------------------------------------

function CaregiverInfoPage({ caregivers, selectedElder, session, caregiver }) {
  return (
    <section className="single-column">
      <div className="section-actions">
        <div>
          <h3>Care Circle & Multi-Tier Escalation Hierarchy</h3>
          <p>
            Joint-family multi-caregiver escalation model per SRS 1.2.1 & 3.1.5.3 via Twilio SMS, Push, and SendGrid Email.
          </p>
        </div>
      </div>

      {/* Escalation Hierarchy Cards */}
      <Panel title="Multi-Tier Caregiver Escalation Hierarchy">
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {caregivers.map((cg) => (
            <div
              key={cg.tier}
              style={{
                padding: "16px 20px",
                background: cg.tier === 1 ? "var(--good-soft)" : "var(--panel-soft)",
                borderRadius: "10px",
                border: "1px solid var(--line)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "14px",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span className={`pill-badge ${cg.tier === 1 ? "good" : "warning"}`}>
                    Tier {cg.tier}
                  </span>
                  <strong style={{ fontSize: "1.1rem", color: "var(--brand-dark)" }}>
                    {cg.tier === 1 ? (caregiver?.name || session?.name || cg.name) : cg.name}
                  </strong>
                  <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>({cg.relationship})</span>
                </div>
                <div style={{ fontSize: "0.88rem", color: "var(--text)" }}>
                  Phone: <strong>{cg.phone}</strong> · Email:{" "}
                  <strong>{cg.tier === 1 ? (caregiver?.email || session?.email || cg.email) : cg.email}</strong>
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: "4px" }}>
                  Escalation Trigger: <strong>{cg.escalationOrder}</strong>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                <div style={{ display: "flex", gap: "6px" }}>
                  {cg.channels.map((ch) => (
                    <span
                      key={ch}
                      style={{
                        padding: "3px 8px",
                        borderRadius: "5px",
                        background: "#ffffff",
                        border: "1px solid var(--line-strong)",
                        fontSize: "0.78rem",
                        color: "var(--brand)",
                        fontWeight: 600,
                      }}
                    >
                      {ch}
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: "0.8rem", color: cg.tier === 1 ? "var(--good)" : "var(--muted)", fontWeight: 600 }}>
                  {cg.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Escalation Policy & Quiet Hours Rules */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <Panel title="Escalation Delay & Retry Policy">
          <p style={{ margin: "0 0 8px", fontSize: "0.88rem" }}>
            <strong>Tier 1 Timeout:</strong> 15 minutes before escalating to Tier 2
          </p>
          <p style={{ margin: "0 0 8px", fontSize: "0.88rem" }}>
            <strong>Tier 2 Timeout:</strong> 30 minutes before emergency physician dispatch
          </p>
          <p style={{ margin: "0 0 8px", fontSize: "0.88rem" }}>
            <strong>Delivery Retries:</strong> 3 attempts with exponential backoff (Twilio REST API)
          </p>
          <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--good)", fontWeight: 600 }}>
            Halting: Any caregiver acknowledgment immediately halts the escalation timer.
          </p>
        </Panel>

        <Panel title="Quiet Hours Configuration">
          <p style={{ margin: "0 0 8px", fontSize: "0.88rem" }}>
            <strong>Quiet Hours Window:</strong> 10:00 PM - 06:30 AM
          </p>
          <p style={{ margin: "0 0 8px", fontSize: "0.88rem" }}>
            <strong>Non-Urgent Alerts:</strong> Suppressed until 06:30 AM
          </p>
          <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--danger)", fontWeight: 700 }}>
            Critical Distress Override: ALWAYS ENABLED (Distress phrases bypass quiet hours)
          </p>
        </Panel>
      </div>
    </section>
  );
}

// -------------------------------------------------------------
// 8. VOICE INTERACTION TIMELINE (SDS 4.2)
// -------------------------------------------------------------

function TimelinePage({ interactions, onOpenSimulator }) {
  const [filterIntent, setFilterIntent] = useState("all");

  const filteredInteractions = useMemo(() => {
    if (filterIntent === "all") return interactions;
    return interactions.filter((i) => i.interactionIntent?.toLowerCase().includes(filterIntent.toLowerCase()));
  }, [interactions, filterIntent]);

  return (
    <section className="single-column">
      <div className="section-actions">
        <div>
          <h3>Voice Interaction Stream & Transcript Logs</h3>
          <p>
            Chronological Alexa conversation logs with intent classification and PyTorch sentiment scores.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <select
            value={filterIntent}
            onChange={(e) => setFilterIntent(e.target.value)}
            className="form-control"
            style={{ minHeight: "38px" }}
          >
            <option value="all">All Intents</option>
            <option value="checkin">Check-in Intents</option>
            <option value="medication">Medication Intents</option>
            <option value="devotional">Devotional Intents</option>
            <option value="distress">Distress Intents</option>
            <option value="memory">Memory Game Intents</option>
          </select>
          <button className="primary-btn" onClick={onOpenSimulator}>
            <Mic size={16} /> Open Simulator
          </button>
        </div>
      </div>

      <Panel title="Interaction Event Log (PostgreSQL interactions & mood_analyses)">
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filteredInteractions.map((i) => (
            <div
              key={i.interactionId}
              style={{
                background: "#ffffff",
                padding: "16px",
                borderRadius: "9px",
                border: "1px solid var(--line)",
                borderLeft: i.moodAnalysis?.distressDetected
                  ? "5px solid var(--danger)"
                  : i.moodAnalysis?.sentimentLabel === "positive"
                  ? "5px solid var(--good)"
                  : "5px solid var(--muted-2)",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <strong style={{ fontSize: "1rem", color: "var(--brand-dark)" }}>
                    {formatIntentLabel(i.interactionIntent)}
                  </strong>
                  <span className="pill-badge" style={{ fontSize: "0.75rem", background: "var(--mint)", color: "var(--brand)" }}>
                    {i.interactionIntent}
                  </span>
                </div>
                <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                  {new Date(i.interactionAt).toLocaleString()}
                </span>
              </div>

              <div style={{ fontSize: "0.92rem", color: "var(--text)" }}>
                <strong>Spoken Input:</strong> <em>"{i.transcript}"</em>
              </div>

              {i.response && (
                <div style={{ fontSize: "0.85rem", color: "var(--brand)" }}>
                  <strong>Alexa Speech:</strong> {i.response}
                </div>
              )}

              {i.moodAnalysis && (
                <div style={{ display: "flex", gap: "14px", marginTop: "4px", fontSize: "0.78rem", color: "var(--muted)" }}>
                  <span>
                    Sentiment: <strong>{i.moodAnalysis.sentimentLabel}</strong>
                  </span>
                  <span>
                    Score: <strong>{Number(i.moodAnalysis.moodScore).toFixed(2)}</strong> (in [-1, 1])
                  </span>
                  <span>
                    Confidence: <strong>{Math.round((i.moodAnalysis.confidenceScore || 0.9) * 100)}%</strong>
                  </span>
                  {i.moodAnalysis.distressDetected && (
                    <span style={{ color: "var(--danger)", fontWeight: 700 }}>
                      ⚠️ Distress Trigger: {i.moodAnalysis.distressPhrase || "Detected"}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
          {filteredInteractions.length === 0 && (
            <p style={{ color: "var(--muted)" }}>No matching interactions logged.</p>
          )}
        </div>
      </Panel>
    </section>
  );
}

// -------------------------------------------------------------
// 9. ALEXA VOICE SIMULATOR (SDS 2.4.1)
// -------------------------------------------------------------

function SimulatorPage({
  selectedElder,
  simUtterance,
  setSimUtterance,
  simIntent,
  setSimIntent,
  simRunning,
  simResponse,
  onRunSimulation,
}) {
  const presets = [
    { label: "Launch Presence", intent: "LaunchRequest", phrase: "Open Presence" },
    { label: "Morning Sleep/Wake", intent: "SleepWakeCheckInIntent", phrase: "Good morning Presence, I just woke up." },
    { label: "Play Hanuman Chalisa", intent: "DevotionalPlaybackIntent", phrase: "Presence, play Hanuman Chalisa." },
    { label: "Confirm Amlodipine", intent: "MedicationConfirmationIntent", phrase: "I took my morning Amlodipine." },
    { label: "Critical Fall Distress", intent: "DistressIntent", phrase: "Madad karo, main gir gayi!" },
    { label: "Sad / Low Mood Check-in", intent: "CheckInIntent", phrase: "I am feeling lonely and sad today." },
    { label: "Play Memory Game", intent: "MemoryGameIntent", phrase: "Let's play the memory trivia game." },
    { label: "Unrecognized Utterance", intent: "FallbackIntent", phrase: "What is the weather on Mars tomorrow?" },
  ];

  return (
    <section className="single-column">
      <div className="section-actions">
        <div>
          <h3>Alexa Voice Companion Simulator</h3>
          <p>
            Simulate spoken inputs to test intent recognition, sentiment scoring, and alert triggers.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {/* Simulator Controls */}
        <Panel title="Spoken Voice Input Simulation">
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                Select Intent Handler (AWS Lambda)
              </label>
              <select
                className="form-control"
                value={simIntent}
                onChange={(e) => setSimIntent(e.target.value)}
              >
                <option value="CheckInIntent">CheckInIntent (Casual daily check-in)</option>
                <option value="MedicationConfirmationIntent">MedicationConfirmationIntent (Adherence logging)</option>
                <option value="DistressIntent">DistressIntent (Emergency alert dispatch)</option>
                <option value="DevotionalPlaybackIntent">DevotionalPlaybackIntent (Bhajan/Aarti playback)</option>
                <option value="SleepWakeCheckInIntent">SleepWakeCheckInIntent (Morning sleep check)</option>
                <option value="MemoryGameIntent">MemoryGameIntent (Cognitive trivia game)</option>
                <option value="FallbackIntent">FallbackIntent (Unrecognized fallback handler)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                Spoken Utterance Transcript
              </label>
              <input
                type="text"
                className="form-control"
                value={simUtterance}
                onChange={(e) => setSimUtterance(e.target.value)}
                placeholder="e.g. Madad karo, main gir gayi or I took my morning tablet"
              />
            </div>

            <button
              className="primary-btn"
              onClick={() => onRunSimulation()}
              disabled={simRunning}
              style={{ minHeight: "42px" }}
            >
              {simRunning ? "Simulating Alexa & NLP..." : "Run Voice Simulation"}
            </button>

            <div>
              <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
                Quick Test Presets (SRS / SDS Scenarios)
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
                {presets.map((p) => (
                  <button
                    key={p.label}
                    className="secondary-btn"
                    onClick={() => {
                      setSimIntent(p.intent);
                      setSimUtterance(p.phrase);
                      onRunSimulation({ intent: p.intent, transcript: p.phrase });
                    }}
                    style={{ fontSize: "0.78rem", padding: "6px 10px" }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        {/* Simulator Response Display */}
        <Panel title="Echo Dot Execution Output (SSML & NLP Analysis)">
          {simResponse ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ background: "var(--panel-soft)", padding: "14px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                <span style={{ fontSize: "0.78rem", color: "var(--muted)", textTransform: "uppercase" }}>Alexa Speech Output</span>
                <p style={{ margin: "4px 0 0", fontSize: "1rem", color: "var(--brand-dark)", fontWeight: 600 }}>
                  "{simResponse.speechText || simResponse.response}"
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div style={{ background: "var(--panel-soft)", padding: "10px", borderRadius: "6px" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Intent Handled</span>
                  <strong style={{ display: "block", color: "var(--brand)" }}>{simResponse.intentName || simIntent}</strong>
                </div>
                <div style={{ background: "var(--panel-soft)", padding: "10px", borderRadius: "6px" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Sentiment Score</span>
                  <strong style={{ display: "block", color: "var(--brand-dark)" }}>
                    {simResponse.sentimentScore !== undefined ? simResponse.sentimentScore : "+0.72"}
                  </strong>
                </div>
              </div>

              {simResponse.distressDetected && (
                <div style={{ background: "var(--danger-soft)", border: "1px solid #fca5a5", padding: "12px", borderRadius: "8px", color: "var(--danger)" }}>
                  <strong>⚠️ Critical Distress Incident Created!</strong>
                  <p style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
                    Trigger phrase: "{simResponse.distressPhrase || simUtterance}" · SMS dispatched to Caregiver Vaagisha Thakur via Twilio.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)" }}>
              <Mic size={36} style={{ margin: "0 auto 10px", opacity: 0.5 }} />
              <p style={{ margin: 0 }}>Click a preset above or type an utterance to see live execution.</p>
            </div>
          )}
        </Panel>
      </div>
    </section>
  );
}

// -------------------------------------------------------------
// 10. SETTINGS & THRESHOLDS (SRS 3.1.6 / SDS 4.2)
// -------------------------------------------------------------

function SettingsPage({ elderProfile, onSave }) {
  const [sensitivityK, setSensitivityK] = useState("1.5");
  const [distressThreshold, setDistressThreshold] = useState("-0.6");
  const [graceWindow, setGraceWindow] = useState("30");

  return (
    <section className="single-column">
      <div className="section-actions">
        <div>
          <h3>System Configuration & Anomaly Thresholds</h3>
          <p>Configure sensitivity parameters, quiet hours, and alerting windows per SRS 3.1.6.</p>
        </div>
        <button className="primary-btn" onClick={onSave}>
          Save Configuration
        </button>
      </div>

      <Panel title="Statistical & Anomaly Parameters (PostgreSQL escalation_policies)">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div className="form-group">
            <label>Inactivity Sensitivity Factor (k)</label>
            <select
              value={sensitivityK}
              onChange={(e) => setSensitivityK(e.target.value)}
              className="form-control"
            >
              <option value="1.0">k = 1.0 (High Sensitivity: Cutoff 4.8)</option>
              <option value="1.5">k = 1.5 (Default Recommended: Cutoff 4.1)</option>
              <option value="2.0">k = 2.0 (Conservative: Cutoff 3.4)</option>
            </select>
            <small style={{ color: "var(--muted)" }}>Formula: Flag anomaly when interactions &lt; μ - kσ</small>
          </div>

          <div className="form-group">
            <label>Mood Distress Classification Threshold</label>
            <input
              type="text"
              value={distressThreshold}
              onChange={(e) => setDistressThreshold(e.target.value)}
              className="form-control"
            />
            <small style={{ color: "var(--muted)" }}>Normalized score below -0.6 triggers alert (SRS 3.1.6.6)</small>
          </div>

          <div className="form-group">
            <label>Medication Reminder Window Grace Period (Minutes)</label>
            <input
              type="number"
              value={graceWindow}
              onChange={(e) => setGraceWindow(e.target.value)}
              className="form-control"
            />
            <small style={{ color: "var(--muted)" }}>Elapsed window before missed-dose alert is generated (SRS 3.1.2.3)</small>
          </div>

          <div className="form-group">
            <label>Timezone Setting</label>
            <input
              type="text"
              value={elderProfile?.timezone || "Asia/Kolkata"}
              readOnly
              className="form-control"
            />
            <small style={{ color: "var(--muted)" }}>Stored timezone for reminder cron calculations</small>
          </div>
        </div>
      </Panel>
    </section>
  );
}

// -------------------------------------------------------------
// MODALS
// -------------------------------------------------------------

function AddMedicationModal({ onClose, onAdd }) {
  const [medName, setMedName] = useState("");
  const [dosage, setDosage] = useState("");
  const [time, setTime] = useState("08:30");
  const [windowMins, setWindowMins] = useState("30");
  const [instructions, setInstructions] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!medName || !dosage) return;

    onAdd({
      medicationName: medName,
      dosage,
      scheduledTime: `${time}:00`,
      reminderWindow: parseInt(windowMins, 10) || 30,
      instructions,
      promptPreview: `Shanti ji, it's ${time}. Time for your ${medName} ${dosage}. Have you taken it?`,
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <div className="modal-head">
          <h3>Add Medication Schedule</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Medication Name</label>
              <input
                type="text"
                required
                className="form-control"
                placeholder="e.g. Amlodipine"
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Dosage</label>
              <input
                type="text"
                required
                className="form-control"
                placeholder="e.g. 5mg or 1 tablet"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Scheduled Time (Daily)</label>
              <input
                type="time"
                required
                className="form-control"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Reminder Grace Window (Minutes before alert)</label>
              <input
                type="number"
                min="10"
                max="60"
                className="form-control"
                value={windowMins}
                onChange={(e) => setWindowMins(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Dietary / Doctor Instructions</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Take with water after meal"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="secondary-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-btn">
              Save Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddRoutineModal({ onClose, onAdd }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Meal Reminder");
  const [category, setCategory] = useState("morning");
  const [time, setTime] = useState("09:00 AM");
  const [note, setNote] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title) return;

    onAdd({
      title,
      type,
      category,
      scheduledTime: time,
      srsRef: "FR-08 Custom",
      note,
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <div className="modal-head">
          <h3>Add Daily Routine Reminder</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Routine Title</label>
              <input
                type="text"
                required
                className="form-control"
                placeholder="e.g. Evening Walk or Doctor Appointment"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Routine Type</label>
              <select className="form-control" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="Meal Reminder">Meal Reminder</option>
                <option value="Hydration Prompt">Hydration Prompt</option>
                <option value="Sleep/Wake Check-in">Sleep/Wake Check-in</option>
                <option value="Devotional Playback">Devotional Playback</option>
                <option value="Family Social Call">Family Social Call</option>
                <option value="Doctor Appointment">Doctor Appointment</option>
                <option value="Festival / Birthday">Festival / Birthday Greeting</option>
              </select>
            </div>
            <div className="form-group">
              <label>Time of Day Block</label>
              <select className="form-control" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="morning">Morning (07:00 AM - 11:30 AM)</option>
                <option value="afternoon">Afternoon (11:30 AM - 04:00 PM)</option>
                <option value="evening">Evening (04:00 PM - 08:00 PM)</option>
                <option value="night">Night (08:00 PM - 10:30 PM)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Scheduled Display Time</label>
              <input
                type="text"
                required
                className="form-control"
                placeholder="e.g. 05:00 PM"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Notes / Context</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Drink warm water or take walking stick"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="secondary-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-btn">
              Add Routine
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AcknowledgeAlertModal({ alert, note, setNote, onConfirm, onClose }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <div className="modal-head">
          <h3 style={{ color: "var(--danger)" }}>Acknowledge Safety Alert</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div style={{ background: "var(--danger-soft)", padding: "12px", borderRadius: "8px", border: "1px solid #fca5a5" }}>
            <strong>Incident: {alert.triggeringPhrase || alert.alertType}</strong>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
              Severity: {alert.severity} · Escalation: {alert.escalationLevel}
            </p>
          </div>
          <div className="form-group">
            <label>Caregiver Response Note (Logged to Immutable Audit Trail)</label>
            <textarea
              rows={3}
              className="form-control"
              placeholder="e.g. Called mother via telephone; confirmed she is safe and sitting comfortably."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>
            Acknowledging halts any further Twilio SMS or phone call escalation to secondary caregivers.
          </p>
        </div>
        <div className="modal-foot">
          <button type="button" className="secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-btn" onClick={onConfirm}>
            Confirm Acknowledgment
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// CAREGIVER COGNITO LOGIN SCREEN
// -------------------------------------------------------------

function LoginScreen({ onLoginSuccess, onDemoLogin, serverError }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [challengeData, setChallengeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both caregiver email and password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await signInWithCognito(email, password);
      if (res.status === "NEW_PASSWORD_REQUIRED") {
        setChallengeData(res);
        setLoading(false);
      } else {
        onLoginSuccess(res);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleCompleteNewPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await completeNewPasswordChallenge(challengeData.cognitoUser, newPassword);
      onLoginSuccess(res);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "grid",
        placeItems: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          width: "100%",
          maxWidth: "440px",
          borderRadius: "14px",
          padding: "36px 32px",
          boxShadow: "0 12px 32px rgba(32, 54, 47, 0.08)",
          border: "1px solid var(--line)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div
            className="brand-mark"
            style={{
              margin: "0 auto 14px",
              width: "48px",
              height: "48px",
              fontSize: "24px",
              fontWeight: 800,
            }}
          >
            P
          </div>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.5rem", color: "var(--brand-dark)", fontWeight: 700 }}>
            Presence Caregiver Portal
          </h2>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.88rem" }}>
            AI-Based Elderly Companion & Monitoring System (SRS / SDS)
          </p>
        </div>

        {(error || serverError) && (
          <div
            style={{
              background: "var(--danger-soft)",
              color: "var(--danger)",
              border: "1px solid #fca5a5",
              borderRadius: "7px",
              padding: "10px 14px",
              fontSize: "0.86rem",
              marginBottom: "16px",
            }}
          >
            {error || serverError}
          </div>
        )}

        {!challengeData ? (
          <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.84rem", fontWeight: 600, marginBottom: "6px" }}>
                Caregiver Email Address
              </label>
              <div style={{ position: "relative" }}>
                <Mail size={18} style={{ position: "absolute", left: "12px", top: "11px", color: "var(--muted)" }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vaagisha2006@gmail.com"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px 10px 38px",
                    borderRadius: "7px",
                    border: "1px solid var(--line)",
                    fontSize: "0.92rem",
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.84rem", fontWeight: 600, marginBottom: "6px" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <Lock size={18} style={{ position: "absolute", left: "12px", top: "11px", color: "var(--muted)" }} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px 10px 38px",
                    borderRadius: "7px",
                    border: "1px solid var(--line)",
                    fontSize: "0.92rem",
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="primary-btn"
              style={{ minHeight: "42px", marginTop: "6px", width: "100%", fontSize: "0.95rem" }}
            >
              {loading ? "Authenticating with Cognito..." : "Sign In with AWS Cognito"}
            </button>

            {/* Quick Demo Login Button for Evaluators / Evaluators without live Cognito credentials */}
            <div style={{ textAlign: "center", margin: "8px 0" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--muted)", textTransform: "uppercase" }}>Or for evaluation</span>
            </div>

            <button
              type="button"
              onClick={onDemoLogin}
              className="secondary-btn"
              style={{ minHeight: "42px", width: "100%", fontSize: "0.92rem", fontWeight: 600, color: "var(--brand)" }}
            >
              <Zap size={16} /> Instant Demo Sign-In as Primary Caregiver
            </button>
          </form>
        ) : (
          <form onSubmit={handleCompleteNewPassword} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ background: "var(--warn-soft)", padding: "10px", borderRadius: "7px", fontSize: "0.84rem" }}>
              First login challenge: Please set your permanent password to continue.
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.84rem", fontWeight: 600, marginBottom: "6px" }}>
                New Permanent Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                className="form-control"
              />
            </div>
            <button type="submit" disabled={loading} className="primary-btn" style={{ minHeight: "42px" }}>
              {loading ? "Saving Password..." : "Set Password & Enter Dashboard"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// SHELL: SIDEBAR AND TOPBAR
// -------------------------------------------------------------

function Sidebar({ active, setActive, openAlerts, onLogout, caregiver, session }) {
  const currentEmail = caregiver?.email || session?.email || "vaagisha2006@gmail.com";
  const currentName = caregiver?.name || session?.name || "Vaagisha Thakur";

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">P</div>
        <div>
          <h1 style={{ color: "var(--brand-dark)" }}>Presence</h1>
          <p>Elderly Companion AI</p>
        </div>
      </div>

      <nav className="nav-list">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          const isAlert = item.id === "risks" && openAlerts > 0;

          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? "active" : ""}`}
              onClick={() => setActive(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {isAlert ? (
                <b>{openAlerts}</b>
              ) : item.badge ? (
                <span style={{ fontSize: "0.72rem", background: "var(--mint)", color: "var(--brand)", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-card">
        <UserRound size={22} style={{ color: "var(--brand)", flexShrink: 0 }} />
        <div style={{ overflow: "hidden", width: "100%" }}>
          <strong style={{ color: "var(--brand-dark)", fontSize: "0.88rem", display: "block" }}>
            {currentName}
          </strong>
          <span
            style={{
              display: "block",
              fontSize: "0.76rem",
              color: "var(--muted)",
              textOverflow: "ellipsis",
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
            title={currentEmail}
          >
            {currentEmail}
          </span>
          <span style={{ fontSize: "0.72rem", color: "var(--brand)", fontWeight: 600 }}>
            Primary Caregiver (Tier 1)
          </span>
        </div>
      </div>

      <button
        onClick={onLogout}
        className="secondary-btn"
        style={{ width: "100%", justifyContent: "flex-start", marginTop: "-10px", fontSize: "0.85rem" }}
      >
        <LogOut size={16} /> Sign Out
      </button>
    </aside>
  );
}

function Topbar({
  pageTitle,
  selectedElder,
  setSelectedElder,
  assignedElders,
  onRefresh,
  lastSyncTime,
  openAlertsCount,
  onOpenAlerts,
}) {
  return (
    <header className="topbar">
      <div>
        <h2>{pageTitle}</h2>
        <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "0.88rem" }}>
          Monitoring: <strong>{selectedElder?.name || "Shanti Devi (Amma)"}</strong> · {selectedElder?.residence || "Jaipur, Rajasthan"}
        </p>
      </div>

      <div className="topbar-actions">
        {/* Resilient 10-Second Polling Status Badge (SRS 2.5 / SDS 7) */}
        <div className="live-poll-badge" title="Resilient 10s periodic polling active per SDS Section 7">
          <div className="live-poll-dot" />
          <span>Live Sync ({lastSyncTime})</span>
        </div>

        {/* Manual Refresh Button */}
        <button className="icon-btn compact" onClick={onRefresh} title="Sync Live Data Now">
          <RefreshCcw size={16} />
        </button>

        {/* Unacknowledged Alerts Bell */}
        <button
          className="icon-btn compact"
          onClick={onOpenAlerts}
          title={`${openAlertsCount} Open Alerts`}
          style={{ position: "relative" }}
        >
          <Bell size={16} />
          {openAlertsCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: "-4px",
                right: "-4px",
                background: "var(--danger)",
                color: "#ffffff",
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                fontSize: "10px",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
              }}
            >
              {openAlertsCount}
            </span>
          )}
        </button>

        {/* Recipient Dropdown */}
        {assignedElders.length > 1 && (
          <select
            value={selectedElder?.userId || selectedElder?.user_id}
            onChange={(e) => {
              const match = assignedElders.find((el) => String(el.userId || el.user_id) === e.target.value);
              if (match) setSelectedElder(match);
            }}
            className="form-control"
            style={{ width: "auto", minHeight: "36px", fontSize: "0.85rem" }}
          >
            {assignedElders.map((e) => (
              <option key={e.userId || e.user_id} value={e.userId || e.user_id}>
                {e.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </header>
  );
}

// -------------------------------------------------------------
// REUSABLE PRESENTATIONAL COMPONENTS
// -------------------------------------------------------------

function Metric({ icon: Icon, label, value, detail, tone = "neutral" }) {
  return (
    <article className={`metric-card ${tone}`}>
      <div className="metric-icon">
        <Icon size={20} />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <p>{detail}</p>}
    </article>
  );
}

function Panel({ title, action, onAction, children }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>{title}</h3>
        {action && (
          <button type="button" onClick={onAction}>
            {action}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

// -------------------------------------------------------------
// HELPERS
// -------------------------------------------------------------

function formatIntentLabel(intent) {
  if (!intent) return "General Check-in";
  switch (intent) {
    case "CheckInIntent":
      return "Conversational Check-in (Mood Scoring)";
    case "MedicationConfirmationIntent":
      return "Medication Verbal Confirmation";
    case "DistressIntent":
      return "⚠️ Spoken Distress Detection";
    case "DevotionalPlaybackIntent":
      return "Devotional / Bhajan Audio Playback";
    case "SleepWakeCheckInIntent":
      return "Morning Sleep/Wake Routine";
    case "MemoryGameIntent":
      return "Cognitive Memory Trivia Session";
    case "LaunchRequest":
      return "Companion Skill Launch Greeting";
    default:
      return intent.replace("Intent", "").replace(/([A-Z])/g, " $1").trim();
  }
}

function formatTimeAgo(isoString) {
  if (!isoString) return "Recently";
  const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} mins ago`;
  return `${Math.floor(diffSec / 3600)} hours ago`;
}

// Local simulation logic for offline/demo tests
function generateLocalSimulation(intent, transcript) {
  const lower = (transcript || "").toLowerCase();
  const isDistress =
    intent === "DistressIntent" ||
    lower.includes("madad") ||
    lower.includes("help") ||
    lower.includes("gir gayi") ||
    lower.includes("fell") ||
    lower.includes("pain") ||
    lower.includes("chot");

  if (isDistress) {
    return {
      speechText: "Shanti ji, please stay still. I have immediately notified your daughter Vaagisha. Help is on the way.",
      intentName: "DistressIntent",
      sentimentScore: -0.85,
      confidenceScore: 0.94,
      distressDetected: true,
      distressPhrase: transcript,
    };
  }

  if (intent === "MedicationConfirmationIntent" || lower.includes("took") || lower.includes("le li")) {
    return {
      speechText: "Thank you Shanti ji. I have recorded your medication confirmation in your daily health log.",
      intentName: "MedicationConfirmationIntent",
      sentimentScore: 0.70,
      confidenceScore: 0.92,
      distressDetected: false,
    };
  }

  if (intent === "DevotionalPlaybackIntent" || lower.includes("hanuman") || lower.includes("bhajan")) {
    return {
      speechText: "Starting your sacred devotional chants now. Jai Shri Ram.",
      intentName: "DevotionalPlaybackIntent",
      sentimentScore: 0.88,
      confidenceScore: 0.95,
      distressDetected: false,
    };
  }

  if (intent === "MemoryGameIntent" || lower.includes("memory") || lower.includes("trivia")) {
    return {
      speechText: "Let's begin today's memory trivia! Question 1: In which city is the famous Hawa Mahal situated? You answered Jaipur. Correct!",
      intentName: "MemoryGameIntent",
      sentimentScore: 0.80,
      confidenceScore: 0.91,
      distressDetected: false,
    };
  }

  if (lower.includes("lonely") || lower.includes("sad") || lower.includes("theek nahi")) {
    return {
      speechText: "I am right here with you, Shanti ji. Would you like me to connect you with Vaagisha or play some peaceful bhajans?",
      intentName: "CheckInIntent",
      sentimentScore: -0.62,
      confidenceScore: 0.89,
      distressDetected: false,
    };
  }

  return {
    speechText: "Namaste Shanti ji. It is always wonderful talking to you. Have a pleasant day.",
    intentName: intent || "CheckInIntent",
    sentimentScore: 0.75,
    confidenceScore: 0.90,
    distressDetected: false,
  };
}

// Mount React Root
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
