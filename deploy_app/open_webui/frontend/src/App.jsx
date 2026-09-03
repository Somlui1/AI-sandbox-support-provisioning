import React, { useState, useEffect } from 'react';
import { useApp } from './context/AppContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Stepper from './components/Stepper';
import LoginModal from './components/LoginModal';
import AnimatedBackground from './components/AnimatedBackground';
import StepSelectUser from './components/steps/StepSelectUser';
import StepSyncUser from './components/steps/StepSyncUser';
import StepParams from './components/steps/StepParams';
import StepDeploy from './components/steps/StepDeploy';
import DeploymentHistory from './components/DeploymentHistory';
import SandboxPortal from './components/SandboxPortal';
import DeployedAgents from './components/DeployedAgents';

export default function App() {
  const { currentStep, handleSelectFromSandbox } = useApp();
  const [activeMenu, setActiveMenu] = useState('deploy'); // 'deploy' | 'agents' | 'history' | 'sandbox'
  const [inspectJobUuid, setInspectJobUuid] = useState(null);

  const token = localStorage.getItem('openwebui_admin_token') || '';

  // ── Handle redirect from Sandbox Portal Approve (via URL parameters) ────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');

    if (action === 'deploy_from_sandbox') {
      const username    = params.get('username') || '';
      const fullName    = params.get('fullName') || username;
      const email       = params.get('email')    || `${username}@aapico.com`;
      const department  = params.get('department') || 'Digital Innovation';
      const projectName = params.get('project') || params.get('projectName') || 'AI Sandbox';
      const employeeId  = params.get('employeeId') || `emp-${username}`;

      handleSelectFromSandbox({
        username,
        fullName,
        email,
        department,
        projectName,
        employeeId,
      });

      setActiveMenu('deploy');

      // Clean up URL without a page reload
      window.history.replaceState({}, '', window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApproveRedirect = (req) => {
    handleSelectFromSandbox(req);
    setActiveMenu('deploy');
  };

  return (
    <div className="min-h-screen flex flex-col antialiased bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-gray-100 transition-colors duration-200 relative selection:bg-indigo-500/30">
      {/* Animated Glowing Blobs & Grid Pattern Background */}
      <AnimatedBackground />

      {/* Login Authentication Dialog */}
      <LoginModal />

      {/* Main Header */}
      <Header />

      {/* Main Layout with Left Sidebar and Right Workspace */}
      <div className="relative z-10 flex-grow flex flex-col lg:flex-row max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 gap-6 sm:gap-8">
        {/* Left Sidebar Menu */}
        <Sidebar activeMenu={activeMenu} onSelectMenu={setActiveMenu} />

        {/* Right Workspace Area */}
        <main className="flex-1 min-w-0 flex flex-col">
          {activeMenu === 'deploy' && (
            <div className="space-y-6 flex flex-col flex-grow fade-in">
              <Stepper />
              {currentStep === 'select' && <StepSelectUser />}
              {currentStep === 'sync'   && <StepSyncUser />}
              {currentStep === 'params' && <StepParams />}
              {currentStep === 'deploy' && <StepDeploy />}
            </div>
          )}

          {activeMenu === 'agents' && (
            <div className="fade-in flex-grow flex flex-col">
              <DeployedAgents
                onGoToDeploy={() => setActiveMenu('deploy')}
                onInspectJob={(jobUuid) => {
                  setInspectJobUuid(jobUuid);
                  setActiveMenu('history');
                }}
              />
            </div>
          )}

          {activeMenu === 'history' && (
            <div className="fade-in flex-grow flex flex-col">
              <DeploymentHistory token={token} initialJobUuid={inspectJobUuid} />
            </div>
          )}

          {activeMenu === 'sandbox' && (
            <div className="fade-in flex-grow flex flex-col">
              <SandboxPortal
                adminToken={token}
                onGoToHistory={() => setActiveMenu('history')}
                onApproveAndRedirect={handleApproveRedirect}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
