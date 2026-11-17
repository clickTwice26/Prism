import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

// Decorative Hugeicons glyph; the surrounding control carries the label.
export function Icon({ icon, size = 22 }: { icon: IconSvgElement; size?: number }) {
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={1.8} aria-hidden />;
}
