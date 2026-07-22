import React, { useCallback } from 'react';

interface SpotlightPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const SpotlightPanel: React.FC<SpotlightPanelProps> = ({ children, className = '', onPointerMove, ...props }) => {
  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      event.currentTarget.style.setProperty('--spotlight-x', `${event.clientX - rect.left}px`);
      event.currentTarget.style.setProperty('--spotlight-y', `${event.clientY - rect.top}px`);
      onPointerMove?.(event);
    },
    [onPointerMove]
  );

  return (
    <div {...props} onPointerMove={handlePointerMove} className={`rb-spotlight-panel ${className}`.trim()}>
      {children}
    </div>
  );
};

export default SpotlightPanel;
