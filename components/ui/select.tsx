"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

// Styled with this app's own tokens (slate surfaces, white-alpha borders, a
// purple accent) rather than the shadcn CSS variables it shipped with.
//
// Those variables - popover, accent-foreground, border-input, muted - are not
// defined in globals.css, so every colour in here resolved to nothing. That is
// why the component existed but no screen used one: the alternative was a
// native <select>, whose option list cannot be themed at all and renders the
// OS default, which on a dark page means a bright blue highlight bar.

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={`flex h-11 w-full items-center justify-between gap-2 rounded-[var(--r-md)]
      border border-[var(--border)] bg-[var(--bg-subtle)] px-3.5 text-left text-sm text-[var(--text-1)]
      data-[placeholder]:text-[var(--text-5)]
      hover:border-[var(--border-hover)]
      focus:outline-none focus-visible:border-[var(--accent-border)] focus-visible:shadow-[0_0_0_3px_var(--accent-subtle)]
      data-[state=open]:border-[var(--accent-border)] data-[state=open]:shadow-[0_0_0_3px_var(--accent-subtle)]
      disabled:cursor-not-allowed disabled:opacity-50
      transition-[border-color,box-shadow] cursor-pointer [&>span]:truncate [&[data-state=open]>svg]:rotate-180 ${className || ''}`}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 text-slate-500 transition-transform duration-200" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={`flex cursor-default items-center justify-center py-1 text-slate-500 ${className || ''}`}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={`flex cursor-default items-center justify-center py-1 text-slate-500 ${className || ''}`}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      // Above modals (z-[9999]), since several dropdowns live inside one.
      className={`relative z-[10000] max-h-[min(24rem,var(--radix-select-content-available-height))] min-w-[8rem] overflow-hidden rounded-[var(--r-md)]
        border border-[var(--border-hover)] bg-[var(--bg-raised)] text-[var(--text-2)]
        shadow-[0_16px_48px_rgba(0,0,0,0.55)]
        data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ${
        position === "popper"
          ? "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1"
          : ""
      } ${className || ''}`}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={`p-1 ${
          position === "popper"
            ? "w-full min-w-[var(--radix-select-trigger-width)]"
            : ""
        }`}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={`py-1.5 pl-8 pr-2 text-xs font-semibold uppercase tracking-wider text-slate-600 ${className || ''}`}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={`relative flex w-full cursor-pointer select-none items-center rounded-[calc(var(--r-md)-2px)] py-2 pl-8 pr-2.5 text-sm text-[var(--text-2)] outline-none
      data-[highlighted]:bg-white/[0.06] data-[highlighted]:text-white
      data-[state=checked]:text-white data-[state=checked]:font-medium
      data-[disabled]:pointer-events-none data-[disabled]:opacity-50
      transition-colors ${className || ''}`}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-3.5 w-3.5 text-indigo-300" />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={`-mx-1 my-1 h-px bg-white/[0.06] ${className || ''}`}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

// ─── AppSelect ───────────────────────────────────────────────────────────────
// The drop-in for a native <select>: a value, a change handler and a list of
// options. Use this rather than <select> anywhere in the app: a native option
// list is drawn by the OS and cannot follow the theme.
//
// Radix reserves the empty string (it means "no value"), but plenty of our
// selects use "" for "none" or "all". Those are mapped to a private sentinel
// on the way in and back to "" on the way out, so callers never notice.
const EMPTY = "__app_select_empty__"

export interface SelectOption {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

export function AppSelect({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  contentClassName,
  disabled,
  icon,
  "aria-label": ariaLabel,
  id,
}: {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  contentClassName?: string
  disabled?: boolean
  /** Optional leading icon inside the trigger (e.g. a filter glyph). */
  icon?: React.ReactNode
  "aria-label"?: string
  id?: string
}) {
  const toRadix = (v: string) => (v === "" ? EMPTY : v)
  return (
    <Select
      value={toRadix(value)}
      onValueChange={v => onValueChange(v === EMPTY ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} className={className}>
        <span className="flex min-w-0 items-center gap-2">
          {icon && <span className="flex-shrink-0 text-[var(--text-4)] [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
          <span className="truncate"><SelectValue placeholder={placeholder} /></span>
        </span>
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {options.map(o => (
          <SelectItem key={o.value || EMPTY} value={toRadix(o.value)} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}