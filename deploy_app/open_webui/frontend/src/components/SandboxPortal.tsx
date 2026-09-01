import React, { useState, useEffect } from "react";
import {
  User,
  ArrowRight,
  CheckCircle,
  Play,
  Check,
  FileText,
  Layers,
  AlertCircle,
} from "lucide-react";
import { SandboxRequest } from "../types";

interface SandboxPortalProps {
  adminToken: string | null;
  onGoToHistory?: () => void;
  onApproveAndRedirect?: (req: SandboxRequest) => void;
}

export default function SandboxPortal({ adminToken, onGoToHistory, onApproveAndRedirect }: SandboxPortalProps) {
  const [portalMode, setPortalMode] = useState<"user" | "admin">("user");
  
  // USER PORTAL STATE
  const [userSession, setUserSession] = useState<{
    username: string;
    fullName: string;
    employeeId: string;
    department: string;
    email: string;
    approver: string;
  } | null>(null);

  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [projectName, setProjectName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [appType, setAppType] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formSuccess, setFormSuccess] = useState<SandboxRequest | null>(null);

  // ADMIN PORTAL STATE
  const [requests, setRequests] = useState<SandboxRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch requests for admin
  const fetchRequests = async () => {
    setRequestsLoading(true);
    try {
      const res = await fetch("/api/sandbox/requests");
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error("Failed to fetch sandbox requests", err);
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [portalMode]);

  const handleLdapLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim() || !passwordInput.trim()) return;

    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await fetch("/api/auth/ldap-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });

      const data = await res.json();
      if (res.ok && data.status === "success") {
        setUserSession(data.user);
      } else {
        setLoginError(data.detail || "Authentication failed. Invalid username or password.");
      }
    } catch {
      setLoginError("Failed to connect to corporate Active Directory server.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userSession || !projectName.trim() || !shortDescription.trim() || !targetAudience.trim() || !appType) return;

    setFormLoading(true);

    try {
      const res = await fetch("/api/sandbox/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: userSession.username,
          fullName: userSession.fullName,
          employeeId: userSession.employeeId,
          department: userSession.department,
          email: userSession.email,
          approver: userSession.approver,
          projectName,
          shortDescription,
          targetAudience,
          appType
        })
      });

      const data = await res.json();
      if (res.ok && data.status === "success") {
        setFormSuccess(data.request);
        // Reset form inputs
        setProjectName("");
        setShortDescription("");
        setTargetAudience("");
        setAppType("");
      }
    } catch {
      alert("Submission error. Please verify server connectivity.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleApprove = async (req: SandboxRequest) => {
    setActionLoadingId(req.id);
    try {
      const res = await fetch(`/api/sandbox/requests/${req.id}/approve`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        // Merge backend-computed auto_fill into the request object
        const enrichedReq: SandboxRequest = {
          ...req,
          ...data.request,
          // Attach computed deployment params so App.jsx can use them
          _autoFill: data.auto_fill || null,
        };
        if (onApproveAndRedirect) {
          onApproveAndRedirect(enrichedReq as any);
        } else {
          await fetchRequests();
        }
      } else {
        setErrorMessage("Failed to approve request. Please try again.");
        await fetchRequests();
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("Network error while approving request.");
    } finally {
      setActionLoadingId(null);
    }
  };


  const handleReject = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/sandbox/requests/${id}/reject`, { method: "POST" });
      if (res.ok) {
        await fetchRequests();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeploy = async (id: string) => {
    setActionLoadingId(id);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/sandbox/requests/${id}/deploy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${adminToken || "mock-token"}`
        }
      });
      if (res.ok) {
        await fetchRequests();
        if (onGoToHistory) {
          onGoToHistory();
        }
      } else {
        const errData = await res.json().catch(() => null);
        setErrorMessage(errData?.detail || "Automated service deployment failed.");
      }
    } catch {
      setErrorMessage("Network error during deployment invocation.");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Toggle Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            AI Sandbox Portal
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Submit a proposal for a custom PocketBase sandbox or approve pending deployments.
          </p>
        </div>

        <div className="flex bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setPortalMode("user")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition ${
              portalMode === "user"
                ? "bg-slate-900 dark:bg-blue-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Request Form
          </button>
          <button
            type="button"
            onClick={() => setPortalMode("admin")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition ${
              portalMode === "admin"
                ? "bg-slate-900 dark:bg-blue-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Approve Menu
          </button>
        </div>
      </div>

      {portalMode === "user" ? (
        <div className="w-full">
          {!userSession ? (
            /* VIEW 1: LOGIN SCREEN */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-10 rounded-2xl shadow-2xs">
              <div className="lg:col-span-6 flex flex-col justify-center pr-6 space-y-5 select-none">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold tracking-wide w-fit uppercase">
                  AICO: Intelligence in Motion
                </div>

                <div className="space-y-2">
                  <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                    Meet AICO
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold tracking-wide uppercase">
                    AAPICO Intelligence Companion for Opportunity
                  </p>
                  <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed max-w-md pt-2">
                    AICO is AAPICO’s intelligent companion, empowering our people to transform knowledge into action and create new opportunities through AI.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">AAPICO</h3>
                    <p className="text-[10px] text-slate-400 mt-1">Enterprise Foundation</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Intelligence</h3>
                    <p className="text-[10px] text-slate-400 mt-1">AI Guided Deployment</p>
                  </div>
                </div>
              </div>

              {/* Right Login Card */}
              <div className="lg:col-span-6 w-full max-w-md mx-auto">
                <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-3xs">
                  <div className="mb-6 text-left">
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Sign in with LDAP</h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Enter your corporate credentials to access the AI Sandbox form.</p>
                  </div>

                  {loginError && (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 flex items-start space-x-2 text-xs text-red-700 dark:text-red-300">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <form onSubmit={handleLdapLogin} className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 mb-1.5 block">Username</label>
                      <input
                        type="text"
                        required
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-400 dark:focus:border-slate-700 transition"
                        placeholder="e.g. somchai.j"
                        disabled={loginLoading}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 mb-1.5 block">Password</label>
                      <input
                        type="password"
                        required
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-400 dark:focus:border-slate-700 transition"
                        placeholder="Enter LDAP password"
                        disabled={loginLoading}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loginLoading}
                      className="w-full py-2.5 rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-850 dark:hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs transition duration-150 flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      {loginLoading ? (
                        <span>Authenticating...</span>
                      ) : (
                        <>
                          <span>Authenticate</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ) : !formSuccess ? (
            /* VIEW 2: AI SANDBOX REQUEST FORM */
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 rounded-2xl shadow-2xs">
              <div className="mb-6 pb-5 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-2 rounded-full bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/65 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold uppercase">
                    LDAP Authenticated
                  </div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">AI Sandbox Access Request</h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Provide project details to request an automated PocketBase sandbox space.</p>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800">
                  <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-blue-600 flex items-center justify-center text-white text-xs font-bold font-mono">
                    {userSession.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-none">{userSession.fullName}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-mono">{userSession.department}</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Column 1: LDAP Autofilled data */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">
                      1. User Information
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-400 mb-1.5 block">Full Name</label>
                        <input
                          type="text"
                          disabled
                          value={userSession.fullName}
                          className="w-full px-3.5 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-400 mb-1.5 block">Employee ID</label>
                        <input
                          type="text"
                          disabled
                          value={userSession.employeeId}
                          className="w-full px-3.5 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-400 mb-1.5 block">Department</label>
                        <input
                          type="text"
                          disabled
                          value={userSession.department}
                          className="w-full px-3.5 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-400 mb-1.5 block">Corporate Email</label>
                        <input
                          type="text"
                          disabled
                          value={userSession.email}
                          className="w-full px-3.5 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-400 mb-1.5 block">Approver VP / Manager</label>
                        <input
                          type="text"
                          disabled
                          value={userSession.approver}
                          className="w-full px-3.5 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Required app inputs */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">
                      2. Project Details
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 mb-1.5 block">
                          Project Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={projectName}
                          onChange={(e) => setProjectName(e.target.value)}
                          className="w-full px-3.5 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-400 dark:focus:border-slate-700 transition"
                          placeholder="e.g. Factory Asset Tracker"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 mb-1.5 block">
                          Short Description (How the app works) <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          required
                          rows={3}
                          value={shortDescription}
                          onChange={(e) => setShortDescription(e.target.value)}
                          className="w-full px-3.5 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-400 dark:focus:border-slate-700 transition resize-none"
                          placeholder="Briefly explain what problem this sandbox application will solve..."
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 mb-1.5 block">
                          Target Audience <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={targetAudience}
                          onChange={(e) => setTargetAudience(e.target.value)}
                          className="w-full px-3.5 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-400 dark:focus:border-slate-700 transition"
                          placeholder="e.g. HR Managers, Shift Supervisors"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 mb-1.5 block">
                          App Type <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          value={appType}
                          onChange={(e) => setAppType(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-400 dark:focus:border-slate-700 cursor-pointer"
                        >
                          <option value="">Select an application type</option>
                          <option value="form">Data Collection / Form</option>
                          <option value="booking">Booking / Reservation System</option>
                          <option value="dashboard">Data Visualization / Dashboard</option>
                          <option value="chatbot">Custom AI Chatbot</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-5 border-t border-slate-100 dark:border-slate-800/80 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setUserSession(null)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 cursor-pointer"
                  >
                    Logout
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-5 py-2 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-blue-600 text-white transition hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-50 cursor-pointer"
                  >
                    {formLoading ? "Submitting..." : "Submit Request"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* VIEW 3: SUCCESS VIEW */
            <div className="max-w-md mx-auto text-center bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-8 rounded-2xl shadow-2xs">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100/50 dark:border-emerald-900/50 rounded-full flex items-center justify-center mx-auto mb-5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="w-6 h-6" />
              </div>

              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Request Submitted!</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Your sandbox proposal for <span className="font-semibold text-slate-800 dark:text-slate-200">"{formSuccess.projectName}"</span> has been captured and routed to IT Administration for validation.
              </p>

              <div className="bg-slate-50 dark:bg-slate-950/60 rounded-xl p-4 text-left border border-slate-200/50 dark:border-slate-800 my-6 space-y-3.5">
                <div className="flex items-center space-x-2 text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Sandbox Metadata</span>
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-xs font-mono">
                  <div className="text-slate-400">ID Reference:</div>
                  <div className="text-slate-800 dark:text-slate-200 text-right">{formSuccess.id}</div>

                  <div className="text-slate-400">Category:</div>
                  <div className="text-slate-800 dark:text-slate-200 text-right uppercase">{formSuccess.appType}</div>

                  <div className="text-slate-400">Approver Admin:</div>
                  <div className="text-slate-800 dark:text-slate-200 text-right truncate">{formSuccess.approver}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setFormSuccess(null)}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition"
              >
                Back to Dashboard
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ADMIN PORTAL VIEW: APPROVE MENU */
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 rounded-2xl shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Pending Approvals Registry</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Review active sandbox requests and trigger automated service provisioning.</p>
            </div>
            <button
              type="button"
              onClick={fetchRequests}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              Refresh
            </button>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/50 flex items-start space-x-2.5 text-xs text-red-800 dark:text-red-300">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {requestsLoading ? (
            <div className="text-center py-12 text-xs text-slate-500">
              Loading requests from corporate registry...
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16 bg-slate-50/55 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-xs text-slate-500">No sandbox requests submitted yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {requests.map((req) => {
                const isPending = req.status === "pending";
                const isApproved = req.status === "approved";
                const isDeployed = req.status === "deployed";

                let statusBadgeStyle = "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400";
                if (isApproved) {
                  statusBadgeStyle = "border-amber-200 bg-amber-50/60 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-400";
                } else if (isDeployed) {
                  statusBadgeStyle = "border-emerald-200 bg-emerald-50/60 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-400";
                } else if (req.status === "rejected") {
                  statusBadgeStyle = "border-red-200 bg-red-50/60 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400";
                }

                return (
                  <div
                    key={req.id}
                    className="border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 bg-slate-50/20 dark:bg-slate-900/30 flex flex-col space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-start space-x-3.5">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200 flex-shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                              {req.fullName}
                            </h4>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                              @{req.username}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                            {req.department} • Emp ID: {req.employeeId}
                          </p>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 text-[9px] font-mono tracking-wide rounded border uppercase font-bold ${statusBadgeStyle}`}>
                        {req.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      <div className="md:col-span-8 space-y-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">
                            Project Name:
                          </span>
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {req.projectName}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-1">
                            Description:
                          </span>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                            {req.shortDescription}
                          </p>
                        </div>
                      </div>

                      <div className="md:col-span-4 bg-slate-50/60 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-800 p-3.5 rounded-xl space-y-2 text-xs font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Target:</span>
                          <span className="text-slate-800 dark:text-slate-200 font-semibold max-w-[120px] truncate" title={req.targetAudience}>
                            {req.targetAudience}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">App Type:</span>
                          <span className="text-slate-800 dark:text-slate-200 font-semibold">
                            {req.appType.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-slate-150/50 dark:border-slate-800 pt-1.5 mt-1.5">
                          <span className="text-slate-400">Date:</span>
                          <span className="text-slate-500">
                            {new Date(req.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 gap-3">
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                        Approver: <span className="font-semibold text-slate-700 dark:text-slate-300">{req.approver}</span>
                      </div>

                      <div className="flex gap-2">
                        {isPending && (
                          <>
                            <button
                              type="button"
                              disabled={actionLoadingId !== null}
                              onClick={() => handleReject(req.id)}
                              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-red-600 dark:text-red-400 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold cursor-pointer active:scale-[0.98] transition disabled:opacity-50"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              disabled={actionLoadingId !== null}
                              onClick={() => handleApprove(req)}
                              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold cursor-pointer active:scale-[0.98] transition disabled:opacity-50 flex items-center space-x-1"
                            >
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Approve</span>
                            </button>
                          </>
                        )}

                        {(isPending || isApproved) && (
                          <button
                            type="button"
                            disabled={actionLoadingId !== null}
                            onClick={() => handleDeploy(req.id)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer active:scale-[0.98] disabled:opacity-60 ${
                              isApproved
                                ? "bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white shadow-sm"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                            }`}
                            title={isApproved ? "Trigger instant automated PocketBase deployment" : "Requires Manager Approval first"}
                          >
                            <Play className="w-3 h-3" />
                            <span>Automation deploy service</span>
                          </button>
                        )}

                        {isDeployed && (
                          <div className="flex items-center space-x-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/60 dark:border-emerald-900/40 px-3.5 py-1.5 rounded-lg font-mono">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>DEPLOYED PIPELINE LIVE</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
