// Lucide icon paths used by the design, as inline SVG on currentColor.

type IconProps = { size?: number; strokeWidth?: number };

function Svg({ size = 14, strokeWidth = 2.5, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const SHIELD =
  "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z";

export const Shield = (p: IconProps) => (
  <Svg {...p}>
    <path d={SHIELD} />
  </Svg>
);

export const ShieldCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d={SHIELD} />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);

export const Lock = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="11" width="18" height="11" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Svg>
);

export const Check = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
);
