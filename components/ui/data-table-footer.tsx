"use client";

import { useRef } from "react";
import { CustomSelect } from "@/components/ui/form-control";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/cn";

const defaultPageSizeOptions = [10, 20, 50, 100];

interface DataTableFooterProps {
  rowCount: number;
  totalItems: number;
  itemLabel?: string;
  page: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions?: readonly number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  className?: string;
}

export function DataTableFooter({
  rowCount,
  totalItems,
  itemLabel = "mục",
  page,
  totalPages,
  pageSize,
  pageSizeOptions = defaultPageSizeOptions,
  onPageChange,
  onPageSizeChange,
  className,
}: DataTableFooterProps) {
  const footerRef = useRef<HTMLElement>(null);
  function resetTableScroll() {
    const viewport = footerRef.current?.parentElement?.querySelector<HTMLElement>("[data-table-scroll]");
    if (viewport) viewport.scrollTop = 0;
  }
  if (rowCount === 0) return null;

  const options = pageSizeOptions.map((size) => ({
    value: String(size),
    label: `${size} dòng`,
  }));

  return (
    <footer
      ref={footerRef}
      className={cn(
        "flex shrink-0 flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <CustomSelect
          className="w-32"
          buttonClassName="h-9 !rounded-lg"
          placement="top"
          value={String(pageSize)}
          options={options}
          ariaLabel="Số dòng mỗi trang"
          onValueChange={(value) => { resetTableScroll(); onPageSizeChange(Number(value)); }}
        />
        <span>
          Tổng cộng <strong className="text-slate-800">{totalItems}</strong>{" "}
          {itemLabel}
        </span>
      </div>
      <Pagination page={page} totalPages={totalPages} onChange={(value) => { resetTableScroll(); onPageChange(value); }} />
    </footer>
  );
}
