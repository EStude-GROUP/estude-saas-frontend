import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function TableScrollArea({
  className,
  role = "region",
  tabIndex = 0,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div
    {...props}
    data-table-scroll
    role={role}
    tabIndex={tabIndex}
    aria-label={label ?? (labelledBy ? undefined : "Bảng dữ liệu")}
    aria-labelledby={labelledBy}
    className={cn("data-table-scroll min-h-0 w-full shrink overflow-auto overscroll-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-200", className)}
  />;
}
