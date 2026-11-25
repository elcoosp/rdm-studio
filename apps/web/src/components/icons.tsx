/**
 * Custom 1.5px-stroke engineering icon set (DESIGN.md ergonomics: surgical
 * stroke icons, no emoji). Only the icons active routes need are defined;
 * later-milestone icons stay omitted until their milestone.
 */
interface IconProps {
  size?: number;
  className?: string;
}

function base(size: number | undefined) {
  return {
    width: size ?? 16,
    height: size ?? 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

export function IconFrame(props: IconProps) {
  return (
    <svg {...base(props.size)} className={props.className} aria-hidden="true">
      <path d="M5 19V8l7-4 7 4v11" />
      <path d="M3 19h18" />
    </svg>
  );
}

export function IconSupport(props: IconProps) {
  return (
    <svg {...base(props.size)} className={props.className} aria-hidden="true">
      <path d="M12 4v8" />
      <path d="M6 12h12" />
      <path d="M8 12l-3 5M12 12v5M16 12l3 5" />
    </svg>
  );
}

export function IconLoad(props: IconProps) {
  return (
    <svg {...base(props.size)} className={props.className} aria-hidden="true">
      <path d="M12 3v10" />
      <path d="M8 9l4 4 4-4" />
      <path d="M4 17h16" />
      <path d="M6 17l-2 3M10 17l-2 3M14 17l-2 3M18 17l-2 3" />
    </svg>
  );
}

export function IconResults(props: IconProps) {
  return (
    <svg {...base(props.size)} className={props.className} aria-hidden="true">
      <path d="M4 20V9M10 20V4M16 20v-8M22 20H2" />
    </svg>
  );
}

export function IconReport(props: IconProps) {
  return (
    <svg {...base(props.size)} className={props.className} aria-hidden="true">
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  );
}

export function IconPlay(props: IconProps) {
  return (
    <svg {...base(props.size)} className={props.className} aria-hidden="true">
      <path d="M7 5l12 7-12 7z" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props.size)} className={props.className} aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <svg {...base(props.size)} className={props.className} aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" />
    </svg>
  );
}
