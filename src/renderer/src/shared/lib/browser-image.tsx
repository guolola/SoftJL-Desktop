// Renders local images without the Next.js image optimization service.
import type { ImgHTMLAttributes } from "react";
export default function Image({
  priority,
  unoptimized,
  fill,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & {
  priority?: boolean;
  unoptimized?: boolean;
  fill?: boolean;
}) {
  return <img {...props} />;
}
