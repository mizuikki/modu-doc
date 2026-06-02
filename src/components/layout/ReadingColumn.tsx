import type { ReactNode } from "react";

type ReadingColumnProps = {
  children: ReactNode;
  className?: string;
};

export function ReadingColumn({ children, className }: ReadingColumnProps) {
  const mergedClassName = className ? `reading-column ${className}` : "reading-column";
  return <div className={mergedClassName}>{children}</div>;
}
