import React, { lazy, Suspense } from 'react';
import './AuthFacePanel.css';

const FaceScanModel = lazy(() =>
  import('./FaceScanModel').then(({ FaceScanModel: model }) => ({ default: model }))
);

interface AuthFacePanelProps {
  badge: string;
}

export const AuthFacePanel: React.FC<AuthFacePanelProps> = ({ badge }) => (
  <aside className="gsap-card auth-face-panel relative flex min-h-[300px] flex-col justify-between overflow-hidden rounded-[28px] border border-white/10 shadow-2xl sm:min-h-[380px] lg:min-h-full">
    <div className="auth-face-model" aria-hidden="true">
      <Suspense fallback={<div className="auth-face-loading" aria-hidden="true" />}>
        <FaceScanModel followPointer normalizeSize />
      </Suspense>
    </div>
    <div className="auth-face-grid" aria-hidden="true" />
    <div className="auth-face-corners" aria-hidden="true" />
    <div className="auth-face-beam" aria-hidden="true" />
    <span className="auth-face-point auth-face-point-one" aria-hidden="true" />
    <span className="auth-face-point auth-face-point-two" aria-hidden="true" />
    <span className="auth-face-point auth-face-point-three" aria-hidden="true" />
    <div className="auth-face-content">
      <div className="auth-face-badge">
        <span className="auth-face-badge-dot" />
        {badge}
      </div>
    </div>
    <div className="auth-face-status" aria-hidden="true">
      <span className="auth-face-status-dot" />
      FACIAL MAPPING
    </div>
  </aside>
);
