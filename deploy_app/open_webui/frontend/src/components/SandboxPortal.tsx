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
import { API_BASE } from "../api/client";

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
      const res = await fetch(`${API_BASE}/api/sandbox/requests`);
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
      const res = await fetch(`${API_BASE}/api/auth/ldap-login`, {
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
      const res = await fetch(`${API_BASE}/api/sandbox/requests`, {
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
      const res = await fetch(`${API_BASE}/api/sandbox/requests/${req.id}/approve`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const enrichedReq: SandboxRequest = {
          ...req,
          ...data.request,
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
      const res = await fetch(`${API_BASE}/api/sandbox/requests/${id}/reject`, { method: "POST" });
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
    try {
      const res = await fetch(`${API_BASE}/api/sandbox/requests/${id}/deploy`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.status === "started") {
        await fetchRequests();
        if (onGoToHistory) {
          onGoToHistory();
        }
      } else {
        setErrorMessage(data.detail || "Deployment trigger failed.");
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to initiate deployment service.");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-full w-full">
      {/* Top Bar Switcher between Employee View & Admin Approve */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200/80 dark:border-gray-800/80 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold tracking-wide">
            <span>AI Sandbox</span>
            <span>&bull;</span>
            <span>Innovation Hub</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            AI Sandbox Portal
          </h1>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
            Internal request and automated provisioning gateway for AI application development.
          </p>
        </div>

        {/* Segmented Switch: Employee vs Admin Mode */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-gray-900/80 border border-slate-200 dark:border-gray-700/80 rounded-xl">
          <button
            type="button"
            onClick={() => setPortalMode("user")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              portalMode === "user"
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm"
                : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Request Form
          </button>
          <button
            type="button"
            onClick={() => setPortalMode("admin")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              portalMode === "admin"
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm"
                : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Approve Menu
          </button>
        </div>
      </div>

      {portalMode === "user" ? (
        <div className="w-full">
          {!userSession ? (
            /* VIEW 1: LOGIN SCREEN MATCHING REQUEST_FORM.HTML */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white/90 dark:bg-gray-900/65 backdrop-blur-xl border border-slate-200/80 dark:border-gray-800/80 p-6 sm:p-10 rounded-3xl shadow-xs">
              {/* Left Branding Side */}
              <div className="lg:col-span-6 flex flex-col justify-center pr-6 space-y-5 select-none">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold tracking-wide w-fit">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                  </span>
                  <span>AI Sandbox Developer Portal</span>
                </div>

                <div className="space-y-3">
                  <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                    Empower Your Ideas in the{" "}
                    <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                      AI Sandbox
                    </span>
                  </h1>
                  <p className="text-indigo-600 dark:text-indigo-300 text-xs font-semibold tracking-wide">
                    ศูนย์รวมสภาพแวดล้อมและเครื่องมือสำหรับนักพัฒนานวัตกรรม AI
                  </p>
                  <p className="text-slate-600 dark:text-gray-300 text-xs leading-relaxed max-w-lg">
                    พอร์ทัลสำหรับนักพัฒนาและบุคลากรภายในองค์กร เข้าสู่ระบบเพื่อส่งไอเดียและขอสิทธิ์เข้าถึงสภาพแวดล้อม AI Sandbox พร้อมระบบฐานข้อมูล PocketBase และ Open WebUI Agent ที่ถูกติดตั้งให้โดยอัตโนมัติ
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="group p-3.5 rounded-2xl bg-slate-50 dark:bg-gray-900/70 border border-slate-200/80 dark:border-gray-800/80 transition-all duration-300 hover:border-indigo-500/40">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="h-7 w-7 rounded-lg bg-indigo-500/20 text-indigo-500 dark:text-indigo-400 font-extrabold text-xs flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                      </div>
                      <h3 className="text-xs font-bold text-slate-800 dark:text-gray-200">Developer Portal</h3>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400">ส่งไอเดียและรายละเอียดโครงการ</p>
                  </div>

                  <div className="group p-3.5 rounded-2xl bg-slate-50 dark:bg-gray-900/70 border border-slate-200/80 dark:border-gray-800/80 transition-all duration-300 hover:border-purple-500/40">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="h-7 w-7 rounded-lg bg-purple-500/20 text-purple-500 dark:text-purple-400 font-extrabold text-xs flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                      </div>
                      <h3 className="text-xs font-bold text-slate-800 dark:text-gray-200">AI Sandbox</h3>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400">พื้นที่ทดสอบระบบแบบแยกอิสระ</p>
                  </div>

                  <div className="group p-3.5 rounded-2xl bg-slate-50 dark:bg-gray-900/70 border border-slate-200/80 dark:border-gray-800/80 transition-all duration-300 hover:border-pink-500/40">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="h-7 w-7 rounded-lg bg-pink-500/20 text-pink-500 dark:text-pink-400 font-extrabold text-xs flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                        </svg>
                      </div>
                      <h3 className="text-xs font-bold text-slate-800 dark:text-gray-200">Auto Provision</h3>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400">สร้าง PocketBase Backend ทันที</p>
                  </div>

                  <div className="group p-3.5 rounded-2xl bg-slate-50 dark:bg-gray-900/70 border border-slate-200/80 dark:border-gray-800/80 transition-all duration-300 hover:border-emerald-500/40">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 font-extrabold text-xs flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <h3 className="text-xs font-bold text-slate-800 dark:text-gray-200">AICO Agents</h3>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400">เชื่อมต่อ AI Agent &amp; Models อัตโนมัติ</p>
                  </div>
                </div>
              </div>

              {/* Right Login Card */}
              <div className="lg:col-span-6 w-full max-w-md mx-auto">
                <div className="bg-white dark:bg-gray-900/85 rounded-3xl p-7 sm:p-9 border border-slate-200 dark:border-gray-800/90 shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">AI Sandbox Portal</h2>
                        <p className="text-[11px] text-indigo-500 dark:text-indigo-400 font-semibold">Empowered by AICO</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Online</span>
                    </div>
                  </div>

                  <div className="mb-5 text-left">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Request Access</h2>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 leading-relaxed">
                      เข้าสู่ระบบด้วยบัญชีองค์กร (Active Directory) เพื่อเริ่มต้นขั้นตอนการขอสิทธิ์ Sandbox
                    </p>
                  </div>

                  {loginError && (
                    <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start space-x-2 text-xs text-red-600 dark:text-red-400">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <form onSubmit={handleLdapLogin} className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5 block">Username</label>
                      <input
                        type="text"
                        required
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        className="w-full px-4 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700/80 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition"
                        placeholder="e.g. somchai.j"
                        disabled={loginLoading}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5 block">Password</label>
                      <input
                        type="password"
                        required
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className="w-full px-4 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700/80 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition"
                        placeholder="Enter LDAP password"
                        disabled={loginLoading}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loginLoading}
                      className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/30 transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                    >
                      {loginLoading ? (
                        <span>Authenticating...</span>
                      ) : (
                        <>
                          <span>Authenticate with LDAP</span>
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
            <div className="bg-white/90 dark:bg-gray-900/65 backdrop-blur-xl border border-slate-200/80 dark:border-gray-800/80 p-6 sm:p-8 rounded-3xl shadow-xs">
              <div className="mb-6 pb-5 border-b border-slate-100 dark:border-gray-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    LDAP Authenticated
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">AI Sandbox Access Request</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Provide project details to request an automated PocketBase sandbox space.</p>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 dark:bg-gray-900/80 p-3 rounded-2xl border border-slate-200/80 dark:border-gray-800">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold font-mono shadow-sm">
                    {userSession.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-800 dark:text-white leading-none">{userSession.fullName}</p>
                    <p className="text-[10px] text-slate-400 dark:text-gray-400 mt-1 font-mono">{userSession.department}</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Column 1: LDAP Autofilled data */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider border-b border-slate-100 dark:border-gray-800/80 pb-2">
                      1. User Information
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5 block">Full Name</label>
                        <input
                          type="text"
                          disabled
                          value={userSession.fullName}
                          className="w-full px-4 py-2.5 text-xs rounded-xl bg-slate-100 dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700/60 text-slate-500 dark:text-gray-400 cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5 block">Employee ID</label>
                        <input
                          type="text"
                          disabled
                          value={userSession.employeeId}
                          className="w-full px-4 py-2.5 text-xs rounded-xl bg-slate-100 dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700/60 text-slate-500 dark:text-gray-400 cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5 block">Department</label>
                        <input
                          type="text"
                          disabled
                          value={userSession.department}
                          className="w-full px-4 py-2.5 text-xs rounded-xl bg-slate-100 dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700/60 text-slate-500 dark:text-gray-400 cursor-not-allowed"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5 block">Company Email (PocketBase Account)</label>
                        <input
                          type="email"
                          disabled
                          value={userSession.email}
                          className="w-full px-4 py-2.5 text-xs rounded-xl bg-slate-100 dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700/60 text-slate-500 dark:text-gray-400 cursor-not-allowed font-mono"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5 block">Manager / Approver</label>
                        <input
                          type="text"
                          disabled
                          value={userSession.approver}
                          className="w-full px-4 py-2.5 text-xs rounded-xl bg-slate-100 dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700/60 text-slate-500 dark:text-gray-400 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Application Details */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider border-b border-slate-100 dark:border-gray-800/80 pb-2">
                      2. Project Details
                    </h3>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5 block">
                        Project Name <span className="text-pink-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        className="w-full saas-input px-4 py-2.5 text-xs"
                        placeholder="e.g. Smart Factory Inventory"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5 block">
                        Short Description <span className="text-pink-500">*</span>
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={shortDescription}
                        onChange={(e) => setShortDescription(e.target.value)}
                        className="w-full saas-input px-4 py-2.5 text-xs resize-none"
                        placeholder="Explain the application idea and problem it solves..."
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5 block">
                        Target Audience <span className="text-pink-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={targetAudience}
                        onChange={(e) => setTargetAudience(e.target.value)}
                        className="w-full saas-input px-4 py-2.5 text-xs"
                        placeholder="e.g. Line Managers, Quality Assurance"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5 block">
                        App Type <span className="text-pink-500">*</span>
                      </label>
                      <select
                        required
                        value={appType}
                        onChange={(e) => setAppType(e.target.value)}
                        className="w-full saas-input px-4 py-2.5 text-xs bg-white dark:bg-gray-900/90"
                      >
                        <option value="" disabled>Select an application type</option>
                        <option value="form">Data Collection / Form</option>
                        <option value="booking">Booking / Reservation System</option>
                        <option value="dashboard">Data Visualization / Dashboard</option>
                        <option value="calculator">Calculation / Logic Tool</option>
                        <option value="chatbot">Custom AI Chatbot</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-5 border-t border-slate-100 dark:border-gray-800/80">
                  <button
                    type="button"
                    onClick={() => setUserSession(null)}
                    className="px-5 py-2.5 btn-secondary text-xs cursor-pointer"
                  >
                    Logout
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-6 py-2.5 btn-primary text-xs cursor-pointer"
                  >
                    {formLoading ? "Submitting..." : "Submit Request"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* VIEW 3: SUCCESS VIEW */
            <div className="max-w-md mx-auto text-center bg-white/90 dark:bg-gray-900/75 backdrop-blur-xl border border-slate-200/80 dark:border-gray-800/80 p-8 rounded-3xl shadow-2xl">
              <div className="w-14 h-14 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-5 text-emerald-500">
                <CheckCircle className="w-8 h-8" />
              </div>

              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Request Submitted!</h2>
              <p className="text-xs text-slate-500 dark:text-gray-300 mt-2 leading-relaxed">
                Your sandbox proposal for <span className="font-bold text-slate-800 dark:text-white">"{formSuccess.projectName}"</span> has been captured and routed to IT Administration for validation.
              </p>

              <div className="bg-slate-50 dark:bg-gray-800/50 rounded-2xl p-4 text-left border border-slate-200/60 dark:border-gray-700/80 my-6 space-y-3">
                <div className="flex items-center space-x-2 text-[10px] text-indigo-600 dark:text-indigo-400 uppercase tracking-widest font-bold">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Sandbox Metadata</span>
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-xs font-mono">
                  <div className="text-slate-400">ID Reference:</div>
                  <div className="text-slate-800 dark:text-gray-200 text-right font-bold">{formSuccess.id}</div>

                  <div className="text-slate-400">Category:</div>
                  <div className="text-slate-800 dark:text-gray-200 text-right uppercase">{formSuccess.appType}</div>

                  <div className="text-slate-400">Approver Admin:</div>
                  <div className="text-slate-800 dark:text-gray-200 text-right truncate">{formSuccess.approver}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setFormSuccess(null)}
                className="w-full py-2.5 btn-primary text-xs cursor-pointer"
              >
                Back to Dashboard
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ADMIN PORTAL VIEW: APPROVE MENU */
        <div className="bg-white/90 dark:bg-gray-900/65 backdrop-blur-xl border border-slate-200/80 dark:border-gray-800/80 p-6 sm:p-8 rounded-3xl shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-800/80 pb-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-semibold tracking-wide">
                <span>Admin Governance</span>
                <span>&bull;</span>
                <span>Approvals</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Pending Approvals Registry</h2>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Review active sandbox requests and trigger automated service provisioning.</p>
            </div>
            <button
              type="button"
              onClick={fetchRequests}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-gray-800 dark:hover:bg-gray-700 border border-slate-200 dark:border-gray-700 cursor-pointer transition"
            >
              Refresh
            </button>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start space-x-2.5 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {requestsLoading ? (
            <div className="text-center py-12 text-xs text-slate-500 dark:text-gray-400 font-mono">
              Loading requests from corporate registry...
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16 bg-slate-50/55 dark:bg-gray-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-gray-800">
              <FileText className="w-8 h-8 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-xs text-slate-500 dark:text-gray-400">No sandbox requests submitted yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((req) => {
                const isPending = req.status === "pending";
                const isApproved = req.status === "approved";
                const isDeployed = req.status === "deployed";

                let statusBadgeStyle = "border-slate-200 bg-slate-50 text-slate-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400";
                if (isApproved) {
                  statusBadgeStyle = "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400";
                } else if (isDeployed) {
                  statusBadgeStyle = "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
                } else if (req.status === "rejected") {
                  statusBadgeStyle = "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400";
                }

                return (
                  <div
                    key={req.id}
                    className="border border-slate-200/80 dark:border-gray-700/80 rounded-2xl p-5 bg-white/60 dark:bg-gray-800/40 flex flex-col space-y-4 shadow-xs"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-3 border-b border-slate-100 dark:border-gray-700/60 pb-3">
                      <div className="flex items-start space-x-3.5">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                              {req.fullName}
                            </h4>
                            <span className="text-[10px] text-slate-400 dark:text-gray-400 font-mono">
                              @{req.username}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-1 font-mono">
                            {req.department} &bull; Emp ID: {req.employeeId}
                          </p>
                        </div>
                      </div>

                      <span className={`px-2.5 py-0.5 text-[9px] font-mono tracking-wide rounded-full border uppercase font-bold ${statusBadgeStyle}`}>
                        {req.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      <div className="md:col-span-8 space-y-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">
                            Project Name:
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {req.projectName}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-gray-400 block mb-1">
                            Description:
                          </span>
                          <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed font-normal">
                            {req.shortDescription}
                          </p>
                        </div>
                      </div>

                      <div className="md:col-span-4 bg-slate-50/60 dark:bg-gray-900/60 border border-slate-200/80 dark:border-gray-700/70 p-3.5 rounded-xl space-y-2 text-xs font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Target:</span>
                          <span className="text-slate-800 dark:text-gray-200 font-semibold max-w-[120px] truncate" title={req.targetAudience}>
                            {req.targetAudience}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">App Type:</span>
                          <span className="text-slate-800 dark:text-gray-200 font-semibold">
                            {req.appType.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200/60 dark:border-gray-800 pt-1.5 mt-1.5">
                          <span className="text-slate-400">Date:</span>
                          <span className="text-slate-500 dark:text-gray-400">
                            {new Date(req.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between pt-3 border-t border-slate-100 dark:border-gray-700/60 gap-3">
                      <div className="text-[11px] text-slate-400 dark:text-gray-400 font-mono">
                        Approver: <span className="font-semibold text-slate-700 dark:text-gray-200">{req.approver}</span>
                      </div>

                      <div className="flex gap-2">
                        {isPending && (
                          <>
                            <button
                              type="button"
                              disabled={actionLoadingId !== null}
                              onClick={() => handleReject(req.id)}
                              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-red-600 dark:text-red-400 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-semibold cursor-pointer active:scale-[0.98] transition disabled:opacity-50"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              disabled={actionLoadingId !== null}
                              onClick={() => handleApprove(req)}
                              className="px-4 py-1.5 btn-secondary text-xs font-semibold cursor-pointer active:scale-[0.98] transition disabled:opacity-50 flex items-center space-x-1"
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
                            className={`px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer active:scale-[0.98] disabled:opacity-60 ${
                              isApproved
                                ? "btn-primary"
                                : "bg-slate-100 dark:bg-gray-800 text-slate-400 dark:text-gray-500 cursor-not-allowed"
                            }`}
                            title={isApproved ? "Trigger instant automated PocketBase deployment" : "Requires Manager Approval first"}
                          >
                            <Play className="w-3 h-3" />
                            <span>Automation deploy service</span>
                          </button>
                        )}

                        {isDeployed && (
                          <div className="flex items-center space-x-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-xl font-mono">
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
