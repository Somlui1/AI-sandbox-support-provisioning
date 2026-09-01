import React, { useState, useEffect } from 'react';
import { useApp } from './context/AppContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Stepper from './components/Stepper';
import LoginModal from './components/LoginModal';
import StepSelectUser from './components/steps/StepSelectUser';
import StepSyncUser from './components/steps/StepSyncUser';
import StepParams from './components/steps/StepParams';
import StepDeploy from './components/steps/StepDeploy';
import DeploymentHistory from './components/DeploymentHistory';
import SandboxPortal from './components/SandboxPortal';

export default function App() {
  const { currentStep, handleSelectFromSandbox } = useApp();
  const [activeMenu, setActiveMenu] = useState('deploy'); // 'deploy' | 'history' | 'sandbox'

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
    <div className="min-h-screen flex flex-col antialiased bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Login Authentication Dialog */}
      <LoginModal />

      {/* Main Header */}
      <Header />

      {/* Main Layout with Left Sidebar and Right Workspace */}
      <div className="flex-grow flex flex-col lg:flex-row max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 gap-6 sm:gap-8">
        {/* Left Sidebar Menu */}
        <Sidebar activeMenu={activeMenu} onSelectMenu={setActiveMenu} />

        {/* Right Workspace Area */}
        <main className="flex-1 min-w-0 flex flex-col">
          {activeMenu === 'deploy' && (
            <div className="space-y-6 flex flex-col flex-grow">
              <Stepper />
              {currentStep === 'select' && <StepSelectUser />}
              {currentStep === 'sync'   && <StepSyncUser />}
              {currentStep === 'params' && <StepParams />}
              {currentStep === 'deploy' && <StepDeploy />}
            </div>
          )}

          {activeMenu === 'history' && (
            <DeploymentHistory token={token} />
          )}

          {activeMenu === 'sandbox' && (
            <SandboxPortal
              adminToken={token}
              onGoToHistory={() => setActiveMenu('history')}
              onApproveAndRedirect={handleApproveRedirect}
            />
          )}
        </main>
      </div>
    </div>
  );
}
