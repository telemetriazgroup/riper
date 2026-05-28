import React from 'react';

type Variant = 'blue' | 'green' | 'purple' | 'orange';

const variantStyles: Record<Variant, { border: string; badge: string; text: string }> = {
  blue: { border: 'border-blue-500', badge: 'bg-blue-600', text: 'rgb(37, 99, 235)' },
  green: { border: 'border-green-500', badge: 'bg-green-600', text: 'rgb(22, 163, 74)' },
  purple: { border: 'border-purple-500', badge: 'bg-purple-600', text: 'rgb(147, 51, 234)' },
  orange: { border: 'border-orange-500', badge: 'bg-orange-600', text: 'rgb(234, 88, 12)' },
};

type Props = {
  step: number;
  variant?: Variant;
  children: React.ReactNode;
};

export const ManualCallout: React.FC<Props> = ({ step, variant = 'blue', children }) => {
  const s = variantStyles[variant];
  return (
    <div className={`absolute top-4 right-4 bg-white border-2 ${s.border} rounded-lg p-4 shadow-xl max-w-xs`}>
      <div className="flex items-start gap-2">
        <div
          className={`flex items-center justify-center h-6 w-6 rounded-full ${s.badge} text-white text-sm font-bold flex-shrink-0`}
        >
          {step}
        </div>
        <p className="text-sm font-semibold" style={{ color: s.text }}>
          {children}
        </p>
      </div>
    </div>
  );
};
