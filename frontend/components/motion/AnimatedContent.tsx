import React from 'react';

interface AnimatedContentProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

const AnimatedContent: React.FC<AnimatedContentProps> = ({ children, className = '', delay = 0 }) => (
  <div
    className={`rb-animated-content ${className}`.trim()}
    style={{ '--rb-delay': `${delay}ms` } as React.CSSProperties}
  >
    {children}
  </div>
);

export default AnimatedContent;
