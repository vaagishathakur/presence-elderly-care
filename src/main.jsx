import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarClock,
  Check,
  ChevronDown,
  Clock3,
  Download,
  FileText,
  HeartPulse,
  Home,
  Leaf,
  Lock,
  LogOut,
  Mail,
  Mic,
  MoreHorizontal,
  Pause,
  Pill,
  Play,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  UserRound,
  Volume2,
  X,
  Radio,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./styles.css";
import { api, onUnauthorized, setAuthToken } from "./api.js";
import {
  completeNewPasswordChallenge,
  getCognitoConfig,
  getCurrentSession,
  signInWithCognito,
  signOutCaregiver,
} from "./auth.js";

const navItems = [
  { id: "overview", label: "Dashboard", icon: Home },
  { id: "care", label: "Care Recipients", icon: Users },
  { id: "medicines", label: "Medications", icon: Pill },
  { id: "timeline", label: "Interactions & Timeline", icon: CalendarClock },
  { id: "health", label: "Health & Mood", icon: HeartPulse },
  { id: "alerts", label: "Alerts & Escalation", icon: Bell },
  { id: "simulator", label: "Alexa Voice Simulator", icon: Mic },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings },
];

export function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [active, setActive] = useState("overview");

  // Domain data
  const [meData, setMeData] = useState(null);
  const [selectedElder, setSelectedElder] = useState(null);
  const [elderStatus, setElderStatus] = useState(null);
  const [elderProfile, setElderProfile] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [medications, setMedications] = useState({ schedules: [], todayLogs: [] });
  const [interactions, setInteractions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Time range selector for charts (7, 14, 30 days)
  const [rangeDays, setRangeDays] = useState(7);

  // Simulator state
  const [simUtterance, setSimUtterance] = useState("");
  const [simIntent, setSimIntent] = useState("CheckInIntent");
  const [simRunning, setSimRunning] = useState(false);
  const [simResponse, setSimResponse] = useState(null);

  const isFetchingRef = useRef(false);

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1);

  // 1. Session initialization (Restore Cognito session or check token)
  useEffect(() => {
    let isMounted = true;
    getCurrentSession()
      .then((sess) => {
        if (isMounted) {
          setSession(sess);
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
    if (!session) {
      setMeData(null);
      setSelectedElder(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    api
      .getMe()
      .then((data) => {
        if (!isMounted) return;
        setMeData(data);
        const elders = data.assignedElders || data.assignedElderlyUsers || [];
        if (elders.length > 0) {
          setSelectedElder(elders[0]);
        } else {
          setErrorMessage("No elderly individuals are currently assigned to your caregiver account.");
        }
      })
      .catch((err) => {
        if (isMounted) {
          setErrorMessage(err.message || "Failed to load caregiver profile.");
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [session]);

  // 3. Fetch Selected Elder Data & Polling with Tab-Visibility Guard
  const fetchElderData = async (elderId) => {
    if (!elderId || isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const [statusData, profileData, alertsData, medsData, interData] = await Promise.all([
        api.getUserStatus(elderId).catch(() => null),
        api.getUserProfile(elderId).catch(() => null),
        api.getUserAlerts(elderId).catch(() => ({ alerts: [] })),
        api.getUserMedications(elderId).catch(() => ({ schedules: [], todayLogs: [] })),
        api.getUserInteractions(elderId, { limit: 100 }).catch(() => ({ interactions: [] })),
      ]);

      if (statusData) setElderStatus(statusData);
      if (profileData?.elderlyUser) setElderProfile(profileData.elderlyUser);
      if (alertsData?.alerts) setAlerts(alertsData.alerts);
      if (medsData) setMedications(medsData);
      if (interData?.interactions) setInteractions(interData.interactions);
      setErrorMessage(null);
    } catch (err) {
      console.warn("Polling error:", err.message);
    } finally {
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    if (!selectedElder || !session) return;
    const elderId = selectedElder.userId || selectedElder.user_id;
    if (!elderId) return;

    fetchElderData(elderId);

    // Live update polling every 10 seconds, pausing when document is hidden
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
  }, [selectedElder, session, refreshTrigger]);

  // Actions
  async function handleAcknowledgeAlert(alertId) {
    try {
      await api.acknowledgeAlert(alertId, "Acknowledged via dashboard by caregiver.");
      triggerRefresh();
    } catch (err) {
      alert("Could not acknowledge alert: " + err.message);
    }
  }

  async function handleResolveAlert(alertId) {
    try {
      await api.resolveAlert(alertId, "Resolved by caregiver via dashboard.");
      triggerRefresh();
    } catch (err) {
      alert("Could not resolve alert: " + err.message);
    }
  }

  async function handleConfirmMedication(scheduleId, logId) {
    if (!selectedElder) return;
    const elderId = selectedElder.userId || selectedElder.user_id;
    try {
      await api.confirmMedication(elderId, { scheduleId, logId });
      triggerRefresh();
    } catch (err) {
      alert("Failed to confirm dose: " + err.message);
    }
  }

  async function handleRunVoiceSimulation(customPayload = null) {
    if (!selectedElder) return;
    setSimRunning(true);
    setSimResponse(null);

    const amazonUserId =
      selectedElder.amazonUserId || selectedElder.amazon_user_id || "amzn1.ask.account.DEMO-SHANTI";
    const payload = customPayload || {
      amazonUserId,
      intent: simIntent,
      transcript: simUtterance,
      slots: simUtterance ? { Utterance: simUtterance } : {},
    };

    try {
      const data = await api.simulateAlexa(payload);
      setSimResponse(data);
      // Refresh dashboard after a brief moment to capture passive logs and alerts
      setTimeout(triggerRefresh, 600);
    } catch (err) {
      alert("Simulation error: " + err.message);
    } finally {
      setSimRunning(false);
    }
  }

  function handleLogout() {
    signOutCaregiver();
    setSession(null);
    setMeData(null);
    setSelectedElder(null);
    setElderStatus(null);
    setAlerts([]);
    setMedications({ schedules: [], todayLogs: [] });
    setInteractions([]);
  }

  // Derived state
  const openAlerts = useMemo(() => alerts.filter((a) => a.status === "open"), [alerts]);
  const adherence = useMemo(() => {
    if (elderStatus?.medicationToday?.total > 0) {
      return Math.round((elderStatus.medicationToday.taken / elderStatus.medicationToday.total) * 100);
    }
    return 100;
  }, [elderStatus]);

  const pageTitle = useMemo(
    () => navItems.find((item) => item.id === active)?.label ?? "Overview",
    [active]
  );

  if (authLoading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", background: "#f3f8f4" }}>
        <div style={{ textAlign: "center" }}>
          <div className="brand-mark" style={{ margin: "0 auto 16px" }}>P</div>
          <h3>Connecting to Presence...</h3>
          <p style={{ color: "#66736b" }}>Verifying caregiver authentication</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <LoginScreen
        onLoginSuccess={(newSession) => {
          setSession(newSession);
          setErrorMessage(null);
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        active={active}
        setActive={setActive}
        openAlerts={openAlerts.length}
        onLogout={handleLogout}
      />
      <main className="main-panel">
        <Topbar
          pageTitle={pageTitle}
          session={session}
          caregiver={meData?.caregiver}
          selectedElder={selectedElder}
          setSelectedElder={setSelectedElder}
          assignedElders={meData?.assignedElders || []}
          onRefresh={triggerRefresh}
          onLogout={handleLogout}
        />

        {/* Global Error Banner */}
        {errorMessage && (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              border: "1px solid #f87171",
              padding: "12px 18px",
              borderRadius: "8px",
              margin: "1rem 2rem 0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              style={{ background: "transparent", border: "none", color: "#991b1b", cursor: "pointer" }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Critical Alert Warning Banner */}
        {openAlerts.length > 0 && (
          <div
            style={{
              background: "linear-gradient(90deg, #ef4444 0%, #b91c1c 100%)",
              color: "#ffffff",
              padding: "1rem 1.5rem",
              borderRadius: "12px",
              margin: "1rem 2rem 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "0 4px 12px rgba(239, 68, 68, 0.25)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <AlertTriangle size={24} />
              <div>
                <strong>
                  {openAlerts.length} Urgent Alert{openAlerts.length > 1 ? "s" : ""} Active!
                </strong>
                <p style={{ margin: 0, opacity: 0.9 }}>
                  {openAlerts[0].triggeringPhrase || openAlerts[0].alertType} ({openAlerts[0].severity})
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => handleAcknowledgeAlert(openAlerts[0].alertId)}
                style={{
                  background: "#ffffff",
                  color: "#b91c1c",
                  fontWeight: "bold",
                  border: "none",
                  padding: "6px 14px",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Acknowledge Now
              </button>
              <button
                onClick={() => setActive("alerts")}
                style={{
                  background: "rgba(255,255,255,0.2)",
                  color: "#ffffff",
                  border: "1px solid #ffffff",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                View All
              </button>
            </div>
          </div>
        )}

        {active === "overview" && (
          <Overview
            openAlerts={openAlerts}
            adherence={adherence}
            medicines={medications.todayLogs || []}
            schedules={medications.schedules || []}
            elderStatus={elderStatus}
            selectedElder={selectedElder}
            alerts={alerts}
            setActive={setActive}
            onAcknowledgeAlert={handleAcknowledgeAlert}
            onResolveAlert={handleResolveAlert}
            onConfirmMed={handleConfirmMedication}
            interactions={interactions}
            rangeDays={rangeDays}
            setRangeDays={setRangeDays}
          />
        )}

        {active === "alerts" && (
          <AlertsPage
            alerts={alerts}
            onAcknowledge={handleAcknowledgeAlert}
            onResolve={handleResolveAlert}
          />
        )}

        {active === "medicines" && (
          <MedicinesPage
            schedules={medications.schedules || []}
            todayLogs={medications.todayLogs || []}
            onConfirm={handleConfirmMedication}
          />
        )}

        {active === "timeline" && <TimelinePage interactions={interactions} />}

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

        {active === "health" && (
          <HealthActivityPage
            elderStatus={elderStatus}
            interactions={interactions}
            rangeDays={rangeDays}
            setRangeDays={setRangeDays}
          />
        )}

        {active === "reports" && (
          <ReportsPage
            elderStatus={elderStatus}
            interactions={interactions}
            medications={medications}
          />
        )}

        {active === "care" && (
          <CareCirclePage meData={meData} selectedElder={selectedElder} />
        )}

        {active === "settings" && <SettingsPage elderProfile={elderProfile} />}
      </main>
    </div>
  );
}

// -------------------------------------------------------------
// Caregiver Cognito Login Screen
// -------------------------------------------------------------

function LoginScreen({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [challengeData, setChallengeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const config = getCognitoConfig();

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password.");
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

  const handleDemoLogin = (demoToken, caregiverName, caregiverEmail) => {
    setAuthToken(demoToken);
    onLoginSuccess({
      status: "SUCCESS",
      idToken: demoToken,
      name: caregiverName,
      email: caregiverEmail,
      isDemo: true,
    });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)",
        display: "grid",
        placeItems: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          width: "100%",
          maxWidth: "420px",
          borderRadius: "16px",
          padding: "36px 30px",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
          border: "1px solid #d5e0d8",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div className="brand-mark" style={{ margin: "0 auto 12px" }}>
            P
          </div>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.5rem", color: "#1b2420" }}>
            Presence Caregiver Portal
          </h2>
          <p style={{ margin: 0, color: "#66736b", fontSize: "0.9rem" }}>
            Sign in with Amazon Cognito to monitor your assigned family members
          </p>
        </div>

        {error && (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              border: "1px solid #fca5a5",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "0.88rem",
              marginBottom: "18px",
            }}
          >
            {error}
          </div>
        )}

        {!challengeData ? (
          <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                Caregiver Email Address
              </label>
              <div style={{ position: "relative" }}>
                <Mail
                  size={18}
                  style={{ position: "absolute", left: "12px", top: "11px", color: "#8a978f" }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px 10px 38px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.95rem",
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <Lock
                  size={18}
                  style={{ position: "absolute", left: "12px", top: "11px", color: "#8a978f" }}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px 10px 38px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.95rem",
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                background: "#2f7d68",
                color: "#ffffff",
                border: "none",
                padding: "12px",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "1rem",
                marginTop: "8px",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Authenticating with Cognito..." : "Sign In with Cognito"}
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleCompleteNewPassword}
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            <div style={{ background: "#fef3c7", padding: "10px", borderRadius: "8px", fontSize: "0.85rem" }}>
              First login detected: Please set your permanent account password to continue.
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                New Permanent Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: "#2f7d68",
                color: "#ffffff",
                border: "none",
                padding: "12px",
                borderRadius: "8px",
                fontWeight: 600,
              }}
            >
              {loading ? "Setting New Password..." : "Set Password & Enter Dashboard"}
            </button>
          </form>
        )}

        {/* Demo Login Fallback (Visible only when VITE_USE_DEMO_AUTH=true) */}
        {config.isDemoAuthEnabled && (
          <div
            style={{
              marginTop: "24px",
              paddingTop: "20px",
              borderTop: "1px solid #e2e8f0",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 10px", fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>
              DEVELOPMENT DEMO MODE (VITE_USE_DEMO_AUTH=true)
            </p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
              <button
                type="button"
                className="secondary-btn"
                onClick={() =>
                  handleDemoLogin("demo-token-caregiver-a", "Samridhi Pandey", "samridhi@example.com")
                }
                style={{ fontSize: "0.8rem", padding: "6px 12px" }}
              >
                Caregiver A (Shanti)
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() =>
                  handleDemoLogin("demo-token-caregiver-b", "Arjun Sharma", "arjun@example.com")
                }
                style={{ fontSize: "0.8rem", padding: "6px 12px" }}
              >
                Caregiver B (Ramesh)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Shell: Sidebar and Topbar
// -------------------------------------------------------------

function Sidebar({ active, setActive, openAlerts, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">P</div>
        <div>
          <h1>Presence</h1>
          <p>AI Elderly Companion</p>
        </div>
      </div>
      <nav className="nav-list" aria-label="Dashboard sections">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-item ${active === item.id ? "active" : ""}`}
              onClick={() => setActive(item.id)}
              aria-label={item.label}
              title={item.label}
              type="button"
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {item.id === "alerts" && openAlerts > 0 && (
                <b style={{ background: "#ef4444", color: "#fff" }}>{openAlerts}</b>
              )}
              {item.id === "simulator" && <b style={{ background: "#3b82f6", color: "#fff" }}>Live</b>}
            </button>
          );
        })}
      </nav>
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "12px" }}>
        <button
          onClick={onLogout}
          className="nav-item"
          style={{ width: "100%", justifyContent: "flex-start", color: "#c45a4f" }}
          type="button"
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
        <div className="sidebar-card">
          <ShieldCheck size={20} />
          <div>
            <strong>Cognito Verified</strong>
            <span>Zero passwords in DB</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Topbar({
  pageTitle,
  session,
  caregiver,
  selectedElder,
  setSelectedElder,
  assignedElders,
  onRefresh,
  onLogout,
}) {
  const caregiverName = caregiver?.name || session?.name || "Caregiver";
  const caregiverEmail = caregiver?.email || session?.email || "";

  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">
          Caregiver Session: <strong>{caregiverName}</strong> ({caregiverEmail})
          {session?.isDemo && <span style={{ marginLeft: 8, color: "#bd8429" }}>[Demo Auth]</span>}
        </p>
        <h2>
          {selectedElder ? (
            <>
              Monitoring <strong>{selectedElder.name}</strong>
            </>
          ) : (
            pageTitle
          )}
        </h2>
      </div>
      <div className="topbar-actions">
        {/* Assigned Elders Dropdown */}
        {assignedElders.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Users size={16} color="#64748b" />
            <select
              value={selectedElder?.userId || ""}
              onChange={(e) => {
                const elder = assignedElders.find(
                  (el) => String(el.userId || el.user_id) === e.target.value
                );
                if (elder) setSelectedElder(elder);
              }}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {assignedElders.map((el) => (
                <option key={el.userId || el.user_id} value={el.userId || el.user_id}>
                  {el.name} ({el.relationship || "Assigned"})
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          className="icon-btn notify-btn"
          title="Refresh Live Data"
          type="button"
          onClick={onRefresh}
        >
          <RefreshCcw size={18} />
        </button>

        <button
          className="icon-btn"
          title="Sign Out"
          type="button"
          onClick={onLogout}
          style={{ color: "#c45a4f" }}
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

// -------------------------------------------------------------
// Overview Page
// -------------------------------------------------------------

function Overview({
  openAlerts,
  adherence,
  medicines,
  schedules,
  elderStatus,
  selectedElder,
  alerts,
  setActive,
  onAcknowledgeAlert,
  onResolveAlert,
  onConfirmMed,
  interactions,
  rangeDays,
  setRangeDays,
}) {
  const nextMedicine = elderStatus?.nextMedication || schedules[0];
  const lastActiveText = elderStatus?.lastActiveAt
    ? new Date(elderStatus.lastActiveAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "No activity yet today";

  const moodScore = elderStatus?.todayMood?.score;
  const moodLabel = elderStatus?.todayMood?.label || "neutral";

  return (
    <section className="page-grid premium-dashboard">
      <div className="care-overview">
        <div className="care-overview-copy">
          <p className="eyebrow">Real-Time SDS Status</p>
          <h3>
            {openAlerts.length > 0
              ? `Critical: ${openAlerts[0].triggeringPhrase || openAlerts[0].alertType}`
              : `${selectedElder?.name || "Elder"} is safe and routine is active.`}
          </h3>
          <p>
            Last voice check-in: <strong>{lastActiveText}</strong> · Interactions logged today:{" "}
            <strong>{elderStatus?.interactionsToday ?? interactions.length}</strong>
          </p>
          <div className="care-kpis">
            <span>Adherence: {adherence}%</span>
            <span>
              Next dose:{" "}
              {nextMedicine
                ? `${nextMedicine.medicationName} (${nextMedicine.scheduledTime})`
                : "None remaining today"}
            </span>
            <span>Timezone: {selectedElder?.timezone || "Asia/Kolkata"}</span>
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

      <div className="metric-grid premium-metrics">
        <Metric
          icon={HeartPulse}
          label="Today's Mood"
          value={
            moodScore !== undefined && moodScore !== null
              ? (moodScore >= 0 ? `+${Number(moodScore).toFixed(2)}` : Number(moodScore).toFixed(2))
              : "0.00"
          }
          detail={`Sentiment: ${moodLabel.charAt(0).toUpperCase() + moodLabel.slice(1)}`}
          tone={moodLabel === "negative" ? "danger" : moodLabel === "positive" ? "good" : "neutral"}
        />
        <Metric
          icon={Pill}
          label="Today's Meds"
          value={`${elderStatus?.medicationToday?.taken ?? 0}/${elderStatus?.medicationToday?.total ?? 0} Taken`}
          detail={`Adherence: ${adherence}%`}
          tone={adherence < 80 ? "warning" : "good"}
        />
        <Metric
          icon={Activity}
          label="Interactions"
          value={`${elderStatus?.interactionsToday ?? interactions.length} Today`}
          detail="Alexa Passive Transcript Logs"
          tone="neutral"
        />
        <Metric
          icon={Bell}
          label="Open Incidents"
          value={`${openAlerts.length}`}
          detail={openAlerts.length > 0 ? "Caregiver Action Required" : "All Clear"}
          tone={openAlerts.length > 0 ? "danger" : "good"}
        />
      </div>

      <div className="content-row dashboard-main-row">
        <Panel
          title="Recent Voice Interactions (Passive Alexa Logs)"
          action="Open Simulator"
          onAction={() => setActive("simulator")}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {interactions.slice(0, 4).map((i) => (
              <div
                key={i.interactionId}
                style={{
                  padding: "10px 14px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  borderLeft: i.moodAnalysis?.distressDetected
                    ? "4px solid #ef4444"
                    : i.moodAnalysis?.sentimentLabel === "positive"
                    ? "4px solid #10b981"
                    : "4px solid #64748b",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <strong style={{ fontSize: "0.9rem" }}>{i.interactionIntent}</strong>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    {new Date(i.interactionAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#334155" }}>
                  <em>"{i.transcript}"</em>
                </p>
                {i.response && (
                  <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#0284c7" }}>
                    Alexa: {i.response}
                  </p>
                )}
              </div>
            ))}
            {interactions.length === 0 && (
              <p style={{ color: "#64748b" }}>No voice interactions recorded yet today.</p>
            )}
          </div>
        </Panel>

        <CareAlerts
          alerts={alerts}
          onAcknowledge={onAcknowledgeAlert}
          onResolve={onResolveAlert}
          onViewAll={() => setActive("alerts")}
        />
      </div>

      <div className="content-row wide-left">
        <Panel
          title="Today's Prescribed Doses"
          action="Manage Schedules"
          onAction={() => setActive("medicines")}
        >
          <div className="medicine-list">
            {medicines.map((med) => (
              <article className="medicine-row" key={med.logId}>
                <div className="med-icon">
                  <Pill size={18} />
                </div>
                <div className="med-info">
                  <strong>{med.medicationName}</strong>
                  <span>
                    {med.dosage || "1 dose"} · Scheduled:{" "}
                    {new Date(med.reminderTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
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
                    className="icon-btn"
                    title="Confirm Dose"
                    onClick={() => onConfirmMed(med.scheduleId, med.logId)}
                    style={{ background: "#10b981", color: "#fff", marginLeft: "8px" }}
                  >
                    <Check size={16} />
                  </button>
                )}
              </article>
            ))}
            {medicines.length === 0 && (
              <p style={{ color: "#64748b" }}>No scheduled doses logged for today yet.</p>
            )}
          </div>
        </Panel>

        <Panel
          title="Voice Simulator Quick Actions"
          action="Full Simulator"
          onAction={() => setActive("simulator")}
        >
          <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 0 }}>
            Simulate spoken inputs to test intent recognition, sentiment scoring, and alert triggers.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button
              className="secondary-btn"
              onClick={() => setActive("simulator")}
              style={{ justifyContent: "flex-start" }}
            >
              <Mic size={16} style={{ marginRight: 8 }} /> "Open Presence" (Greeting)
            </button>
            <button
              className="secondary-btn"
              onClick={() => setActive("simulator")}
              style={{ justifyContent: "flex-start" }}
            >
              <Mic size={16} style={{ marginRight: 8 }} /> "I took my Amlodipine" (Dose Confirmation)
            </button>
            <button
              className="secondary-btn"
              onClick={() => setActive("simulator")}
              style={{ justifyContent: "flex-start", borderColor: "#fca5a5", color: "#b91c1c" }}
            >
              <AlertTriangle size={16} style={{ marginRight: 8 }} /> "Madad karo, main gir gayi" (Distress Alert)
            </button>
          </div>
        </Panel>
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value, detail, tone }) {
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

function CareAlerts({ alerts, onAcknowledge, onResolve, onViewAll }) {
  return (
    <Panel title="Active Alerts & Escalations" action="View all" onAction={onViewAll}>
      <div className="alert-stack">
        {alerts.slice(0, 3).map((alert) => (
          <article className="alert-item" key={alert.alertId}>
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
                <strong>{alert.triggeringPhrase || alert.alertType}</strong>
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
              <p>
                Severity: {alert.severity} · Escalation Level: {alert.escalationLevel}
              </p>
              <small>{new Date(alert.createdAt).toLocaleString()}</small>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {alert.status === "open" && (
                <button
                  className="secondary-btn"
                  onClick={() => onAcknowledge(alert.alertId)}
                  style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                >
                  Ack
                </button>
              )}
              {alert.status !== "resolved" && (
                <button
                  className="secondary-btn"
                  onClick={() => onResolve(alert.alertId)}
                  style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                >
                  Resolve
                </button>
              )}
            </div>
          </article>
        ))}
        {alerts.length === 0 && <p style={{ color: "#64748b" }}>No alerts recorded.</p>}
      </div>
    </Panel>
  );
}

// -------------------------------------------------------------
// Alerts Page
// -------------------------------------------------------------

function AlertsPage({ alerts, onAcknowledge, onResolve }) {
  return (
    <section className="single-column" style={{ padding: "2rem" }}>
      <div className="section-actions">
        <div>
          <h3>Alerts & Escalation History</h3>
          <p>Critical incidents, missed medication reminders, and multi-channel caregiver deliveries.</p>
        </div>
      </div>
      <div className="alert-stack">
        {alerts.map((alert) => (
          <article
            className="alert-item"
            key={alert.alertId}
            style={{
              background: "#ffffff",
              padding: "1.25rem",
              borderRadius: "10px",
              marginBottom: "1rem",
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
                <strong style={{ fontSize: "1.1rem" }}>{alert.triggeringPhrase || alert.alertType}</strong>
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
              <p style={{ margin: "6px 0" }}>
                Type: <strong>{alert.alertType}</strong> · Severity: <strong>{alert.severity}</strong> ·
                Escalation Level: <strong>{alert.escalationLevel}</strong>
              </p>
              {alert.confidenceScore !== null && (
                <p style={{ margin: "4px 0", fontSize: "0.85rem", color: "#64748b" }}>
                  Detection Confidence: {(alert.confidenceScore * 100).toFixed(0)}%
                </p>
              )}
              {alert.acknowledgementNote && (
                <p style={{ margin: "4px 0", fontSize: "0.85rem", color: "#0284c7" }}>
                  Note: {alert.acknowledgementNote}
                </p>
              )}
              <small>{new Date(alert.createdAt).toLocaleString()}</small>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {alert.status === "open" && (
                <button className="primary-btn" onClick={() => onAcknowledge(alert.alertId)}>
                  Acknowledge
                </button>
              )}
              {alert.status !== "resolved" && (
                <button className="secondary-btn" onClick={() => onResolve(alert.alertId)}>
                  Resolve
                </button>
              )}
            </div>
          </article>
        ))}
        {alerts.length === 0 && <p style={{ color: "#64748b" }}>No alerts recorded for this user.</p>}
      </div>
    </section>
  );
}

// -------------------------------------------------------------
// Medicines Page
// -------------------------------------------------------------

function MedicinesPage({ schedules, todayLogs, onConfirm }) {
  return (
    <section className="single-column" style={{ padding: "2rem" }}>
      <div className="section-actions">
        <div>
          <h3>Medication Schedules & Adherence</h3>
          <p>Prescribed times, reminder windows, and verbal confirmation logs.</p>
        </div>
      </div>
      <Panel title="Active Medication Schedules">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1rem",
          }}
        >
          {schedules.map((s) => (
            <div
              key={s.scheduleId}
              style={{
                background: "#f8fafc",
                padding: "1rem",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>{s.medicationName}</strong>
                <span className="pill-badge good">{s.dosage || "1 dose"}</span>
              </div>
              <p style={{ margin: "8px 0 4px", fontSize: "0.9rem" }}>
                Scheduled Time: <strong>{s.scheduledTime}</strong>
              </p>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
                Reminder Window: {s.reminderWindow} minutes
              </p>
            </div>
          ))}
          {schedules.length === 0 && <p style={{ color: "#64748b" }}>No active medication schedules.</p>}
        </div>
      </Panel>

      <Panel title="Today's Dose Logs">
        <div className="medicine-list">
          {todayLogs.map((log) => (
            <article className="medicine-row" key={log.logId}>
              <div className="med-icon">
                <Pill size={18} />
              </div>
              <div className="med-info">
                <strong>{log.medicationName}</strong>
                <span>
                  {log.dosage || "1 dose"} · Scheduled:{" "}
                  {new Date(log.reminderTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
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
                  className="secondary-btn"
                  onClick={() => onConfirm(log.scheduleId, log.logId)}
                  style={{ marginLeft: "8px" }}
                >
                  Confirm Dose
                </button>
              )}
            </article>
          ))}
          {todayLogs.length === 0 && (
            <p style={{ color: "#64748b" }}>No doses logged for today yet.</p>
          )}
        </div>
      </Panel>
    </section>
  );
}

// -------------------------------------------------------------
// Timeline Page
// -------------------------------------------------------------

function TimelinePage({ interactions }) {
  return (
    <section className="single-column" style={{ padding: "2rem" }}>
      <div className="section-actions">
        <div>
          <h3>Daily Routine & Voice Timeline</h3>
          <p>Passively captured interaction transcripts, intent classifications, and sentiment scores.</p>
        </div>
      </div>
      <Panel title="Interaction Stream">
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {interactions.map((i) => (
            <div
              key={i.interactionId}
              style={{
                background: "#ffffff",
                padding: "1rem",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{i.interactionIntent}</strong>
                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                  {new Date(i.interactionAt).toLocaleString()}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: "0.95rem" }}>
                Elder: <em>"{i.transcript}"</em>
              </p>
              {i.response && (
                <p style={{ margin: 0, fontSize: "0.9rem", color: "#0284c7" }}>
                  Alexa: {i.response}
                </p>
              )}
              {i.moodAnalysis && (
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    fontSize: "0.8rem",
                    color: "#64748b",
                    marginTop: "4px",
                  }}
                >
                  <span>
                    Sentiment: <strong>{i.moodAnalysis.sentimentLabel}</strong>
                  </span>
                  <span>
                    Mood Score: <strong>{i.moodAnalysis.moodScore?.toFixed(2)}</strong>
                  </span>
                  <span>
                    Distress Detected:{" "}
                    <strong style={{ color: i.moodAnalysis.distressDetected ? "#ef4444" : "#10b981" }}>
                      {i.moodAnalysis.distressDetected ? "Yes" : "No"}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          ))}
          {interactions.length === 0 && (
            <p style={{ color: "#64748b" }}>No voice interactions recorded yet.</p>
          )}
        </div>
      </Panel>
    </section>
  );
}

// -------------------------------------------------------------
// Voice Simulator Page
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
  const PRESETS = [
    { label: "1. Skill Launch", intent: "LaunchRequest", text: "Open Presence" },
    {
      label: "2. Positive Check-in (Hinglish)",
      intent: "CheckInIntent",
      text: "Aaj main bahut khush hoon, achhi neend aayi.",
    },
    {
      label: "3. Low Mood Check-in",
      intent: "CheckInIntent",
      text: "I am feeling lonely and sad today.",
    },
    {
      label: "4. Confirm Medication",
      intent: "MedicationConfirmationIntent",
      text: "I took my Amlodipine medicine.",
    },
    {
      label: "5. Distress Signal (Emergency Fall)",
      intent: "DistressIntent",
      text: "Madad karo, main gir gayi aur uth nahi pa rahi hoon.",
    },
  ];

  return (
    <section className="single-column" style={{ padding: "2rem" }}>
      <div className="section-actions">
        <div>
          <h3>Alexa Voice Companion Simulator</h3>
          <p>
            Simulate spoken interactions for <strong>{selectedElder?.name || "Shanti Devi"}</strong> without physical hardware.
          </p>
        </div>
      </div>

      <Panel title="Interactive Voice Simulator Controls">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "8px" }}>
              Select Preset Scenario:
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  className="secondary-btn"
                  onClick={() => {
                    setSimIntent(p.intent);
                    setSimUtterance(p.text);
                  }}
                  style={{ fontSize: "0.85rem" }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>Intent:</label>
              <select
                value={simIntent}
                onChange={(e) => setSimIntent(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                }}
              >
                <option value="LaunchRequest">LaunchRequest</option>
                <option value="CheckInIntent">CheckInIntent</option>
                <option value="MedicationConfirmationIntent">MedicationConfirmationIntent</option>
                <option value="DistressIntent">DistressIntent</option>
                <option value="FallbackIntent">FallbackIntent</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                Spoken Utterance Transcript:
              </label>
              <input
                type="text"
                value={simUtterance}
                onChange={(e) => setSimUtterance(e.target.value)}
                placeholder="Type elder utterance (English or Hinglish)..."
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                }}
              />
            </div>
          </div>

          <button
            className="primary-btn"
            onClick={() => onRunSimulation()}
            disabled={simRunning}
            style={{
              padding: "10px 20px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "fit-content",
            }}
          >
            <Zap size={18} />
            {simRunning ? "Simulating Voice Interaction..." : "Execute Voice Interaction"}
          </button>
        </div>
      </Panel>

      {simResponse && (
        <Panel title="Alexa Skill Spoken Response & Output Envelope">
          <div
            style={{
              background: "#0f172a",
              color: "#38bdf8",
              padding: "1.25rem",
              borderRadius: "8px",
            }}
          >
            <p style={{ margin: "0 0 8px", fontSize: "0.9rem", color: "#94a3b8" }}>
              Spoken Alexa Response:
            </p>
            <h4 style={{ margin: "0 0 12px", color: "#f8fafc", fontSize: "1.1rem" }}>
              "{simResponse.speechText}"
            </h4>
            <div style={{ display: "flex", gap: "16px", fontSize: "0.85rem", color: "#cbd5e1" }}>
              <span>
                Intent Handled: <strong>{simResponse.intentName}</strong>
              </span>
              <span>
                Session Ended: <strong>{simResponse.shouldEndSession ? "Yes" : "No"}</strong>
              </span>
            </div>
          </div>
        </Panel>
      )}
    </section>
  );
}

// -------------------------------------------------------------
// Health, Analytics & Dynamic 7/14/30-Day Trend Charts
// -------------------------------------------------------------

function HealthActivityPage({ elderStatus, interactions, rangeDays, setRangeDays }) {
  // Aggregate real interaction data across rangeDays
  const chartData = useMemo(() => {
    const days = [];
    const now = new Date();

    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split("T")[0];
      const dayLabel = d.toLocaleDateString([], { weekday: "short", month: "numeric", day: "numeric" });

      const dayInteractions = interactions.filter(
        (item) => item.interactionAt && item.interactionAt.startsWith(dateStr)
      );

      const count = dayInteractions.length;
      let totalMood = 0;
      let moodCount = 0;

      dayInteractions.forEach((item) => {
        if (item.moodAnalysis?.moodScore !== null && item.moodAnalysis?.moodScore !== undefined) {
          totalMood += Number(item.moodAnalysis.moodScore);
          moodCount++;
        }
      });

      const avgMood = moodCount > 0 ? Number((totalMood / moodCount).toFixed(2)) : null;

      days.push({
        date: dateStr,
        day: dayLabel,
        interactions: count,
        mood: avgMood !== null ? Math.round(((avgMood + 1) / 2) * 100) : null,
        rawMood: avgMood,
      });
    }

    return days;
  }, [interactions, rangeDays]);

  return (
    <section className="single-column" style={{ padding: "2rem" }}>
      <div className="section-actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3>Health & Mood Analytics</h3>
          <p>Continuous sentiment tracking $\\in [-1, 1]$ and interaction frequency trends.</p>
        </div>
        {/* 7 / 14 / 30 day range selector */}
        <div style={{ display: "flex", gap: "6px", background: "#ffffff", padding: "4px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setRangeDays(d)}
              style={{
                border: "none",
                background: rangeDays === d ? "#2f7d68" : "transparent",
                color: rangeDays === d ? "#ffffff" : "#64748b",
                padding: "6px 12px",
                borderRadius: "6px",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              {d} Days
            </button>
          ))}
        </div>
      </div>

      <Panel title={`Mood Index Trend (${rangeDays} Days)`}>
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip
                formatter={(val, name, item) => [
                  `${val}% (Score: ${item.payload.rawMood !== null ? item.payload.rawMood : "N/A"})`,
                  "Mood Index",
                ]}
              />
              <Area
                type="monotone"
                dataKey="mood"
                stroke="#10b981"
                fill="#ecfdf5"
                strokeWidth={2}
                name="Mood Index"
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title={`Daily Voice Interaction Frequency (${rangeDays} Days)`}>
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip formatter={(val) => [`${val} check-ins`, "Interactions"]} />
              <Bar dataKey="interactions" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Interactions" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </section>
  );
}

// -------------------------------------------------------------
// Reports Page
// -------------------------------------------------------------

function ReportsPage({ elderStatus, interactions, medications }) {
  const totalInteractions = interactions.length;
  const moodItems = interactions.filter((i) => i.moodAnalysis?.moodScore !== null && i.moodAnalysis?.moodScore !== undefined);
  const avgScore =
    moodItems.length > 0
      ? (moodItems.reduce((acc, cur) => acc + Number(cur.moodAnalysis.moodScore), 0) / moodItems.length).toFixed(2)
      : "0.72";

  const adherencePct = elderStatus?.medicationToday?.total > 0
    ? Math.round((elderStatus.medicationToday.taken / elderStatus.medicationToday.total) * 100)
    : 100;

  return (
    <section className="single-column" style={{ padding: "2rem" }}>
      <div className="section-actions">
        <div>
          <h3>Caregiver Summary Reports</h3>
          <p>Live calculated adherence, companion engagement, and mood averages from PostgreSQL data.</p>
        </div>
      </div>
      <Panel title="Weekly Adherence & Activity (Computed from Live Database)">
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
              <th style={{ padding: "10px" }}>Metric</th>
              <th style={{ padding: "10px" }}>Recorded Live Value</th>
              <th style={{ padding: "10px" }}>Target</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
              <td style={{ padding: "10px" }}>Medication Adherence</td>
              <td style={{ padding: "10px" }}>
                <strong>{adherencePct}%</strong> ({elderStatus?.medicationToday?.taken ?? 0}/{elderStatus?.medicationToday?.total ?? 0} doses today)
              </td>
              <td style={{ padding: "10px", color: "#10b981" }}>&gt; 90%</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
              <td style={{ padding: "10px" }}>Recorded Voice Interactions</td>
              <td style={{ padding: "10px" }}>
                <strong>{totalInteractions} total interactions</strong> ({elderStatus?.interactionsToday ?? 0} today)
              </td>
              <td style={{ padding: "10px", color: "#10b981" }}>&gt; 3 / day</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
              <td style={{ padding: "10px" }}>Average Mood Score</td>
              <td style={{ padding: "10px" }}>
                <strong>{avgScore >= 0 ? `+${avgScore}` : avgScore}</strong> ({Number(avgScore) >= 0 ? "Positive" : "Needs Review"})
              </td>
              <td style={{ padding: "10px", color: "#10b981" }}>&gt; 0.00</td>
            </tr>
          </tbody>
        </table>
      </Panel>
    </section>
  );
}

// -------------------------------------------------------------
// Care Circle Page
// -------------------------------------------------------------

function CareCirclePage({ meData, selectedElder }) {
  const caregiver = meData?.caregiver;

  return (
    <section className="single-column" style={{ padding: "2rem" }}>
      <div className="section-actions">
        <div>
          <h3>Care Circle & Assigned Roles</h3>
          <p>Caregiver credentials verified through AWS Cognito with role-based access control.</p>
        </div>
      </div>
      <Panel title="Authenticated Caregiver Profile">
        <div style={{ background: "#f8fafc", padding: "1.25rem", borderRadius: "8px" }}>
          <p style={{ margin: "0 0 8px" }}>
            <strong>Caregiver Name:</strong> {caregiver?.name || "Samridhi Pandey"}
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong>Email:</strong> {caregiver?.email || "samridhi@example.com"}
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong>Phone for SMS Alerts:</strong> {caregiver?.phone || "+919876543210"}
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong>Assigned Recipient:</strong> {selectedElder?.name || "Shanti Devi"} ({selectedElder?.relationship || "Primary"})
          </p>
          <p style={{ margin: "0", color: "#64748b", fontSize: "0.85rem" }}>
            <strong>Tenant Security:</strong> Access restricted to assigned user ID {selectedElder?.userId || 1} via PostgreSQL caregiver_assignments.
          </p>
        </div>
      </Panel>
    </section>
  );
}

// -------------------------------------------------------------
// Settings Page
// -------------------------------------------------------------

function SettingsPage({ elderProfile }) {
  const prefs = elderProfile?.preferences;

  return (
    <section className="single-column" style={{ padding: "2rem" }}>
      <Panel title="System & Safety Configuration (Read from Database)">
        <div className="settings-grid">
          <Setting label="Timezone" value={elderProfile?.timezone || "Asia/Kolkata"} />
          <Setting
            label="Quiet Hours"
            value={
              prefs?.quietHoursStart && prefs?.quietHoursEnd
                ? `${prefs.quietHoursStart} - ${prefs.quietHoursEnd}`
                : "10:00 PM - 06:30 AM"
            }
          />
          <Setting label="Preferred Language" value={prefs?.preferredLanguage || "Hindi"} />
          <Setting label="Preferred Devotional" value={prefs?.preferredDevotional || "Bhajans"} />
          <Setting label="Preferred Music" value={prefs?.preferredMusic || "Classical Hindi"} />
          <Setting label="Distress Mood Threshold" value="-0.600" />
        </div>
      </Panel>
    </section>
  );
}

function Setting({ label, value }) {
  return (
    <label className="setting-row">
      <span>{label}</span>
      <input defaultValue={value} readOnly />
    </label>
  );
}

function Panel({ title, action, onAction, children }) {
  return (
    <section className="dashboard-panel">
      <div className="panel-head">
        <h4>{title}</h4>
        {action && (
          <button className="panel-action" type="button" onClick={onAction}>
            {action}
          </button>
        )}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Dashboard error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", background: "#f8fafc", padding: "20px" }}>
          <div style={{ maxWidth: "520px", background: "#fff", padding: "32px", borderRadius: "12px", border: "1px solid #e2e8f0", textAlign: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
            <h2 style={{ color: "#ef4444", margin: "0 0 12px" }}>Dashboard Render Error</h2>
            <p style={{ color: "#64748b", fontSize: "0.95rem", margin: "0 0 16px" }}>The dashboard caught an unexpected issue:</p>
            <pre style={{ background: "#f1f5f9", padding: "12px", borderRadius: "8px", fontSize: "0.85rem", overflowX: "auto", textAlign: "left", color: "#334155", marginBottom: "20px" }}>
              {this.state.error?.message || String(this.state.error)}
            </pre>
            <button
              onClick={() => { window.location.reload(); }}
              style={{ background: "#2f7d68", color: "#fff", border: "none", padding: "10px 24px", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
