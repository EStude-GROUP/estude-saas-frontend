"use client";

import { Children, Fragment, forwardRef, isValidElement, useId, useImperativeHandle, useRef, useState, type ReactNode, type SelectHTMLAttributes } from "react";
import { CustomSelect, type CustomSelectOption } from "./custom-select";
import { useControlLabel } from "./use-control-label";
import { cn } from "@/lib/cn";

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "multiple"> {
  containerClassName?: string;
  label?: string;
  hint?: string;
  error?: string;
}

function text(node: ReactNode): string {
  return Children.toArray(node).map((child) => isValidElement<{ children?: ReactNode }>(child) ? text(child.props.children) : String(child)).join("").replace(/\s+/g, " ").trim();
}

function optionsFrom(children: ReactNode, disabled = false): CustomSelectOption[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean; label?: string }>(child)) return [];
    if (child.type === Fragment || child.type === "optgroup") return optionsFrom(child.props.children, disabled || Boolean(child.props.disabled));
    if (child.type !== "option") return [];
    const label = child.props.label ?? text(child.props.children);
    return [{ value: String(child.props.value ?? label), label, disabled: disabled || child.props.disabled }];
  });
}

// Compatibility API for existing forms; the visible control is CustomSelect.
// A hidden native field preserves FormData, validity, refs and change events.
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { children, className, containerClassName, label, hint, error, id, value, defaultValue, onChange, onInvalid, ...props }, ref,
) {
  const generatedId = useId();
  const native = useRef<HTMLSelectElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = optionsFrom(children);
  const [local, setLocal] = useState(() => String(defaultValue ?? options[0]?.value ?? ""));
  const [invalid, setInvalid] = useState(false);
  const controlId = id ?? generatedId;
  const inheritedLabel = useControlLabel(native, props["aria-label"]);
  useImperativeHandle(ref, () => native.current!);

  return <span data-custom-control className={cn("relative block min-w-0", containerClassName)}>
    <select {...props} ref={native} value={value} defaultValue={defaultValue} tabIndex={-1} aria-hidden="true" className="pointer-events-none sr-only"
      onChange={(event) => { setLocal(event.target.value); setInvalid(false); onChange?.(event); }}
      onInvalid={(event) => { event.preventDefault(); setInvalid(true); trigger.current?.focus(); onInvalid?.(event); }}>
      {children}
    </select>
    <CustomSelect id={controlId} triggerRef={trigger} label={label} ariaLabel={inheritedLabel} ariaLabelledBy={props["aria-labelledby"]} ariaDescribedBy={hint || error || invalid ? `${controlId}-hint` : props["aria-describedby"]}
      invalid={Boolean(error) || invalid} value={value === undefined ? local : String(value)} options={options} disabled={props.disabled} buttonClassName={className}
      onValueChange={(next) => {
        if (!native.current) return;
        native.current.value = next;
        native.current.dispatchEvent(new Event("change", { bubbles: true }));
      }} />
    {(hint || error || invalid) && <span id={`${controlId}-hint`} className={`mt-1.5 block text-xs ${error || invalid ? "text-rose-600" : "text-slate-400"}`}>{error ?? (invalid ? "Vui lòng chọn một giá trị." : hint)}</span>}
  </span>;
});
