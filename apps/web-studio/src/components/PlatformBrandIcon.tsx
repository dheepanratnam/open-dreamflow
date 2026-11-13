import React from 'react';
import type { PlatformId } from '../types/studio';

export type BrandIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<BrandIconSize, string> = {
  xs: 'w-3.5 h-3.5 rounded-[4px]',
  sm: 'w-4 h-4 rounded-[5px]',
  md: 'w-6 h-6 rounded-[7px]',
  lg: 'w-9 h-9 rounded-[10px]',
  xl: 'w-12 h-12 rounded-[14px]',
};

interface PlatformBrandIconProps {
  platformId: PlatformId | string;
  size?: BrandIconSize;
  className?: string;
}

export const PlatformBrandIcon: React.FC<PlatformBrandIconProps> = ({
  platformId,
  size = 'md',
  className = '',
}) => {
  const box = `${SIZE_CLASSES[size]} inline-flex items-center justify-center shrink-0 overflow-hidden select-none ${className}`;

  switch (platformId) {
    case 'higgsfield':
      return (
        <span
          data-component="PlatformBrandIcon"
          data-platform={platformId}
          className={`${box} bg-[#DFFF00] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.18)]`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="w-[72%] h-[72%]" fill="none">
            <path
              d="M4.5 4.5h4.2v5.4h6.6V4.5h4.2v15h-4.2v-5.7H8.7v5.7H4.5v-15z"
              fill="#0B0B0B"
            />
            <circle cx="19" cy="5.2" r="1.4" fill="#0B0B0B" />
          </svg>
        </span>
      );

    case 'kling':
      return (
        <span
          className={`${box} bg-gradient-to-br from-[#062E2B] to-[#0A191E] border border-[#10B981]/40`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="w-[70%] h-[70%]" fill="none">
            <circle cx="12" cy="12" r="8.2" stroke="#22D3EE" strokeWidth="1.5" strokeOpacity="0.45" />
            <path
              d="M8 6.5v11M8.5 12l6.8-5.5M10.8 10.6L16.2 17.5"
              stroke="#34D399"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      );

    case 'dreamina':
      return (
        <span
          className={`${box} bg-gradient-to-br from-[#0B1E36] via-[#102A45] to-[#081523] border border-[#20D5EC]/40`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="w-[72%] h-[72%]" fill="none">
            <path
              d="M12 3.2c.6 4.7 4.1 8.2 8.8 8.8-4.7.6-8.2 4.1-8.8 8.8-.6-4.7-4.1-8.2-8.8-8.8 4.7-.6 8.2-4.1 8.8-8.8Z"
              fill="url(#dreaminaStar)"
            />
            <circle cx="17.8" cy="6.2" r="1.3" fill="#67E8F9" />
            <defs>
              <linearGradient id="dreaminaStar" x1="3" y1="3" x2="21" y2="21">
                <stop stopColor="#20D5EC" />
                <stop offset="1" stopColor="#60A5FA" />
              </linearGradient>
            </defs>
          </svg>
        </span>
      );

    case 'google-flow':
      return (
        <span
          className={`${box} bg-[#18181B] border border-white/15`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="w-[72%] h-[72%]" fill="none">
            <path
              d="M20.2 12.2c0-.65-.06-1.28-.17-1.88H12v3.56h4.6a3.94 3.94 0 0 1-1.7 2.58v2.14h2.75c1.61-1.48 2.55-3.66 2.55-6.4Z"
              fill="#4285F4"
            />
            <path
              d="M12 20.5c2.3 0 4.23-.76 5.65-2.06l-2.75-2.14c-.76.51-1.74.82-2.9.82-2.23 0-4.12-1.5-4.8-3.52H4.36v2.21A8.5 8.5 0 0 0 12 20.5Z"
              fill="#34A853"
            />
            <path
              d="M7.2 13.6A5.1 5.1 0 0 1 6.93 12c0-.56.1-1.1.27-1.6V8.19H4.36A8.5 8.5 0 0 0 3.5 12c0 1.37.33 2.67.86 3.81l2.84-2.21Z"
              fill="#FBBC05"
            />
            <path
              d="M12 6.88c1.25 0 2.38.43 3.26 1.28l2.44-2.44C16.22 4.34 14.3 3.5 12 3.5a8.5 8.5 0 0 0-7.64 4.69l2.84 2.21c.68-2.02 2.57-3.52 4.8-3.52Z"
              fill="#EA4335"
            />
          </svg>
        </span>
      );

    case 'sume':
      return (
        <span
          className={`${box} bg-[#00AFFF] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)]`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="w-[70%] h-[70%]" fill="none">
            <rect x="6" y="5.5" width="12" height="3.2" rx="1" fill="#06141E" />
            <rect x="6" y="8.7" width="4" height="2.8" fill="#06141E" />
            <rect x="6" y="10.4" width="12" height="3.2" rx="1" fill="#06141E" />
            <rect x="14" y="13.5" width="4" height="2.6" fill="#06141E" />
            <rect x="6" y="15.3" width="12" height="3.2" rx="1" fill="#06141E" />
          </svg>
        </span>
      );

    case 'elevenlabs':
      return (
        <span
          className={`${box} bg-[#0B0B0C] border border-white/25`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="w-[62%] h-[62%]" fill="none">
            <rect x="6.5" y="5" width="3.6" height="14" rx="0.8" fill="#FFFFFF" />
            <rect x="13.9" y="5" width="3.6" height="14" rx="0.8" fill="#FFFFFF" />
          </svg>
        </span>
      );

    case 'openart':
      return (
        <span
          className={`${box} bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-sky-400/35`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="w-[70%] h-[70%]" fill="none">
            <circle cx="12" cy="12" r="6.5" stroke="#38BDF8" strokeWidth="2.3" />
            <circle cx="15.5" cy="8.5" r="2" fill="#FDE047" />
          </svg>
        </span>
      );

    case 'imagineart':
      return (
        <span
          className={`${box} bg-gradient-to-br from-[#272017] to-[#17130E] border border-amber-400/35`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="w-[72%] h-[72%]" fill="none">
            <path
              d="M5 17.5 15.8 6.7a1.7 1.7 0 0 1 2.4 2.4L7.4 19.9 4.2 20.5 5 17.5Z"
              stroke="#FBBF24"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path d="M9 5.5v3M7.5 7h3" stroke="#FDE68A" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
      );

    case 'openai':
      return (
        <span
          className={`${box} bg-[#10A37F]/15 border border-[#10A37F]/45`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="w-[72%] h-[72%]" fill="none">
            <circle cx="12" cy="12" r="7.5" stroke="#10A37F" strokeWidth="1.5" strokeDasharray="3.5 1.8" />
            <polygon
              points="12,5.8 17.4,8.9 17.4,15.1 12,18.2 6.6,15.1 6.6,8.9"
              stroke="#34D399"
              strokeWidth="1.6"
              fill="none"
            />
            <circle cx="12" cy="12" r="2.1" fill="#34D399" />
          </svg>
        </span>
      );

    case 'fal':
      return (
        <span
          className={`${box} bg-gradient-to-br from-[#312E81] to-[#1E1B4B] border border-indigo-400/40`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="w-[70%] h-[70%]" fill="none">
            <path
              d="M13.5 3.8 6.5 13h5l-1 7.2L17.5 11h-5l1-7.2Z"
              fill="#A5B4FC"
              stroke="#E0E7FF"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      );

    case 'replicate':
      return (
        <span
          className={`${box} bg-[#1C1C1F] border border-white/25`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="w-[68%] h-[68%]" fill="none">
            <path
              d="M6.5 18.5V6h6.4a3.6 3.6 0 0 1 0 7.2H6.5M12.4 13.2l4.8 5.3"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      );

    case 'comfyui':
      return (
        <span
          className={`${box} bg-[#101B2D] border border-blue-400/40`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="w-[74%] h-[74%]" fill="none">
            <rect x="4" y="6" width="5.5" height="4.5" rx="1" fill="#60A5FA" />
            <rect x="14.5" y="4.5" width="5.5" height="4.5" rx="1" fill="#93C5FD" />
            <rect x="14.5" y="14.5" width="5.5" height="4.5" rx="1" fill="#34D399" />
            <path
              d="M9.5 8.2h2.5c1 0 1-1.5 2.5-1.5M9.5 8.8h2.5c1 0 1 8 2.5 8"
              stroke="#93C5FD"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </span>
      );

    case 'custom-mcp':
    default:
      return (
        <span
          className={`${box} bg-[#182226] border border-[#20D5EC]/40`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="w-[70%] h-[70%]" fill="none">
            <path
              d="M9 6v4M15 6v4M7.5 10h9v2.2a4.5 4.5 0 0 1-9 0V10ZM12 16.7v2.8"
              stroke="#20D5EC"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      );
  }
};
