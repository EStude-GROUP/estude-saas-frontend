"use client";

import { useEffect, useRef, type FormEvent } from "react";
import { Search, X } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/form-control";
import { cn } from "@/lib/cn";

export interface DebouncedSearchInputProps
  extends Omit<InputProps, "icon" | "onChange" | "type" | "value"> {
  value: string;
  onValueChange: (value: string) => void;
  onSearch: (value: string) => void;
  debounceMs?: number;
}

export function DebouncedSearchInput({
  value,
  onValueChange,
  onSearch,
  debounceMs = 500,
  className,
  containerClassName,
  ...props
}: DebouncedSearchInputProps) {
  const onSearchRef = useRef(onSearch);
  const lastSearchRef = useRef(value.trim());

  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  useEffect(() => {
    const normalizedValue = value.trim();
    if (normalizedValue === lastSearchRef.current) return;

    const timeoutId = window.setTimeout(() => {
      if (normalizedValue === lastSearchRef.current) return;
      lastSearchRef.current = normalizedValue;
      onSearchRef.current(normalizedValue);
    }, debounceMs);

    return () => window.clearTimeout(timeoutId);
  }, [debounceMs, value]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedValue = value.trim();
    lastSearchRef.current = normalizedValue;
    onSearchRef.current(normalizedValue);
  }

  return (
    <form className={cn("search-field relative", containerClassName)} onSubmit={handleSubmit} role="search">
      <Input
        {...props}
        icon={Search}
        type="search"
        className={cn(
          "pr-12 [&::-webkit-search-cancel-button]:hidden",
          className,
        )}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
      {value ? (
        <button
          type="button"
          aria-label="Xóa nội dung tìm kiếm"
          onClick={() => onValueChange("")}
          className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-brand-700 transition-colors hover:bg-blue-100 hover:text-brand-800 focus-visible:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <X className="size-4" strokeWidth={3} />
        </button>
      ) : null}
    </form>
  );
}
