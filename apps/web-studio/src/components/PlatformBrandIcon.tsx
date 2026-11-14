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

interface BrandAssetSpec {
  src: string;
  label: string;
  boxClass: string;
  imgClass: string;
}

const BRAND_ASSET_MAP: Record<string, BrandAssetSpec> = {
  higgsfield: {
    src: '/brands/higgsfield.png',
    label: 'Higgsfield',
    boxClass: 'bg-[#DFFF00]',
    imgClass: 'w-full h-full object-cover',
  },
  dreamina: {
    src: '/brands/dreamina.png',
    label: 'Dreamina',
    boxClass: 'bg-[#081523]',
    imgClass: 'w-full h-full object-cover',
  },
  seedance: {
    src: '/brands/dreamina.png',
    label: 'Dreamina',
    boxClass: 'bg-[#081523]',
    imgClass: 'w-full h-full object-cover',
  },
  kling: {
    src: '/brands/kling.png',
    label: 'Kling AI',
    boxClass: 'bg-[#081D1A]',
    imgClass: 'w-full h-full object-cover',
  },
  sume: {
    src: '/brands/sume.png',
    label: 'Sume',
    boxClass: 'bg-[#0B2239] border border-white/10 p-[12%]',
    imgClass: 'w-full h-full object-contain',
  },
  elevenlabs: {
    src: '/brands/elevenlabs.svg',
    label: 'ElevenLabs',
    boxClass: 'bg-white',
    imgClass: 'w-full h-full object-cover',
  },
  openai: {
    src: '/brands/openai.svg',
    label: 'OpenAI',
    boxClass: 'bg-[#0e0e0e] border border-white/15 p-[18%]',
    imgClass: 'w-full h-full object-contain invert',
  },
  fal: {
    src: '/brands/fal.png',
    label: 'Fal.ai',
    boxClass: 'bg-[#17152e]',
    imgClass: 'w-full h-full object-cover',
  },
  replicate: {
    src: '/brands/replicate.png',
    label: 'Replicate',
    boxClass: 'bg-[#141414]',
    imgClass: 'w-full h-full object-cover',
  },
  openart: {
    src: '/brands/openart.png',
    label: 'OpenArt',
    boxClass: 'bg-white p-[14%]',
    imgClass: 'w-full h-full object-contain',
  },
  imagineart: {
    src: '/brands/imagineart.png',
    label: 'ImagineArt',
    boxClass: 'bg-[#17130E]',
    imgClass: 'w-full h-full object-cover',
  },
  comfyui: {
    src: '/brands/comfyui.svg',
    label: 'ComfyUI',
    boxClass: 'bg-[#211927]',
    imgClass: 'w-full h-full object-cover',
  },
  'google-flow': {
    src: '/brands/google.svg',
    label: 'Google Flow',
    boxClass: 'bg-white',
    imgClass: 'w-full h-full object-cover',
  },
  'gemini-api': {
    src: '/brands/google.svg',
    label: 'Google Gemini',
    boxClass: 'bg-white',
    imgClass: 'w-full h-full object-cover',
  },
  'gemini-omni': {
    src: '/brands/google.svg',
    label: 'Google Gemini Omni',
    boxClass: 'bg-white',
    imgClass: 'w-full h-full object-cover',
  },
  google: {
    src: '/brands/google.svg',
    label: 'Google',
    boxClass: 'bg-white',
    imgClass: 'w-full h-full object-cover',
  },
  'custom-mcp': {
    src: '/brands/mcp.svg',
    label: 'MCP Server',
    boxClass: 'bg-[#141414] border border-white/15',
    imgClass: 'w-full h-full object-cover',
  },
};

const DEFAULT_BRAND_SPEC: BrandAssetSpec = BRAND_ASSET_MAP['custom-mcp'];

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
  const key = String(platformId || 'custom-mcp').toLowerCase();
  const spec = BRAND_ASSET_MAP[key] || DEFAULT_BRAND_SPEC;

  return (
    <span
      data-component="PlatformBrandIcon"
      data-platform={platformId}
      className={`${SIZE_CLASSES[size]} inline-flex items-center justify-center shrink-0 overflow-hidden select-none ${spec.boxClass} ${className}`}
      aria-hidden="true"
    >
      <img
        src={spec.src}
        alt={spec.label}
        draggable={false}
        decoding="async"
        className={spec.imgClass}
      />
    </span>
  );
};
