import type {
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

export function Table({
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn(
        "data-table w-full text-left text-[14px] text-slate-700 [&_td]:!text-[14px] [&_th]:!text-[14px]",
        className,
      )}
      {...props}
    />
  );
}

export function TableHeader({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "sticky top-0 z-10 h-[var(--table-header-height)] bg-slate-50 text-[14px] uppercase tracking-wide text-slate-500",
        className,
      )}
      {...props}
    />
  );
}

export function TableBody({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn("divide-y divide-slate-100", className)} {...props} />
  );
}

export function TableHead({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-4 py-2.5 !text-[14px] font-bold",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("px-4 py-2 !text-[14px] text-slate-700", className)}
      {...props}
    />
  );
}

export function TableLoadingBarRow({ colSpan }: { colSpan: number }) {
  return (
    <tr data-table-loading aria-label="Đang tải dữ liệu">
      <TableCell colSpan={colSpan} className="!p-0">
        <div className="table-loading-track" role="progressbar">
          <span className="table-loading-indicator" />
        </div>
      </TableCell>
    </tr>
  );
}

export function TableEmptyRow({
  colSpan,
  message = "Không có dữ liệu!",
  icon = <TriangleAlert className="size-6 shrink-0 text-slate-950" />,
}: {
  colSpan: number;
  message?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <tr>
      <TableCell
        colSpan={colSpan}
        className="px-7 py-4 text-left text-sm font-medium text-slate-900"
      >
        <span className="flex items-center gap-3">
          {icon}
          {message}
        </span>
      </TableCell>
    </tr>
  );
}
