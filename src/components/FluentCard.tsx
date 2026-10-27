import React, { useRef, useState } from 'react';

interface FluentCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

/**
 * مكون بطاقة بنمط Windows 10 Fluent Design
 * يطبق تأثير إضاءة الحواف الديناميكي (Edge Lighting / Reveal Highlight)
 * عند تمرير مؤشر الفأرة (Hover) أو عند اللمس بالإصبع على شاشات الجوال (Touch)
 */
export const FluentCard: React.FC<FluentCardProps> = ({
  children,
  className = '',
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [touchActive, setTouchActive] = useState(false);

  // تحديث إحداثيات الإضاءة عند تحريك الماوس
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    cardRef.current.style.setProperty('--mouse-x', `${x}px`);
    cardRef.current.style.setProperty('--mouse-y', `${y}px`);
  };

  // تحديث إحداثيات الإضاءة عند لمس الشاشة بالإصبع على الهواتف والأجهزة اللوحية
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!cardRef.current || e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = cardRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    cardRef.current.style.setProperty('--mouse-x', `${x}px`);
    cardRef.current.style.setProperty('--mouse-y', `${y}px`);
    setTouchActive(true);
  };

  const handleTouchEnd = () => {
    setTimeout(() => setTouchActive(false), 250);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchMove}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`fluent-edge-card rounded-sm ${touchActive ? 'touch-active' : ''} ${className}`}
      {...props}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
};
