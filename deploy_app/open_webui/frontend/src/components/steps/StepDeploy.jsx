import React from 'react';
import { useApp } from '../../context/AppContext';
import ReviewDossier from '../deploy/ReviewDossier';
import LiveTracker from '../deploy/LiveTracker';
import JobHistory from '../deploy/JobHistory';

export default function StepDeploy() {
  const { activeJobUuid, setActiveJobUuid, clearSelectedUser } = useApp();

  const handleStartFresh = () => {
    setActiveJobUuid(null);
    clearSelectedUser();
  };

  return (
    <div className="space-y-6">
      {/* Either Review Dossier OR Live Pipeline Tracker */}
      {activeJobUuid ? (
        <LiveTracker jobUuid={activeJobUuid} onStartFresh={handleStartFresh} />
      ) : (
        <ReviewDossier onDeploySuccess={(uuid) => setActiveJobUuid(uuid)} />
      )}

      {/* Historical Deployment Audit Log */}
      <JobHistory onViewJobFlow={(uuid) => setActiveJobUuid(uuid)} />
    </div>
  );
}
