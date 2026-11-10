import React from 'react';

interface H1LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

export const H1Logo: React.FC<H1LogoProps> = ({
  size = 30,
  showWordmark = true,
  className = '',
}) => {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        {/* Soft rounded squircle frame */}
        <rect
          x="2"
          y="2"
          width="36"
          height="36"
          rx="11"
          fill="#FBEAE2"
          stroke="#E8E3DF"
          strokeWidth="1.5"
        />
        {/* Inner warm peach coordination hexagon */}
        <path
          d="M20 7.5L30.8 13.75V26.25L20 32.5L9.2 26.25V13.75L20 7.5Z"
          fill="#FFFFFF"
          stroke="#F2B9A0"
          strokeWidth="1.4"
        />
        {/* Interconnected H1 architectural monogram */}
        <path
          d="M13.5 14V26M21 14V26M13.5 20H21"
          stroke="#302C29"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Multilevel '1' pillar */}
        <path
          d="M24.8 16.2L27.2 14V26"
          stroke="#C78A4A"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Agent coordination nodes */}
        <circle cx="13.5" cy="14" r="1.9" fill="#F2B9A0" />
        <circle cx="21" cy="20" r="1.9" fill="#C78A4A" />
        <circle cx="27.2" cy="14" r="2.1" fill="#F6C6A8" />
        <circle cx="27.2" cy="26" r="1.9" fill="#679779" />
      </svg>
      {showWordmark && (
        <span className="font-display font-semibold tracking-tight text-[15px] text-[#302C29] whitespace-nowrap shrink-0">
          H1-multilevel
        </span>
      )}
    </div>
  );
};

export const H1WelcomeMark: React.FC = () => {
  return (
    <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FFFFFF] border border-[#E8E3DF] shadow-[0_8px_24px_-6px_rgba(48,44,41,0.07)]">
      <svg
        width="34"
        height="34"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="20" cy="20" r="16" fill="#FBEAE2" stroke="#F2B9A0" strokeWidth="1.2" strokeDasharray="3 2" />
        <path
          d="M20 7.5L30.8 13.75V26.25L20 32.5L9.2 26.25V13.75L20 7.5Z"
          fill="#FFFFFF"
          stroke="#E8E3DF"
          strokeWidth="1.3"
        />
        <path
          d="M13.5 14V26M21 14V26M13.5 20H21"
          stroke="#302C29"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M24.8 16.2L27.2 14V26"
          stroke="#C78A4A"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="13.5" cy="14" r="2.1" fill="#F2B9A0" />
        <circle cx="21" cy="20" r="2.1" fill="#FFD6C2" stroke="#C78A4A" strokeWidth="1" />
        <circle cx="27.2" cy="14" r="2.1" fill="#F6C6A8" />
        <circle cx="27.2" cy="26" r="2.1" fill="#679779" />
      </svg>
    </div>
  );
};
