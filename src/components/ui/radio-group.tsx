"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface RadioGroupProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
  className?: string
}

function RadioGroup({ value, onValueChange, children, className }: RadioGroupProps) {
  return (
    <div
      role="radiogroup"
      data-value={value}
      className={cn("flex flex-col gap-2", className)}
    >
      {React.Children.map(children, child => {
        if (!React.isValidElement(child)) return child
        return React.cloneElement(child as React.ReactElement<RadioGroupItemProps>, {
          selectedValue: value,
          onSelect: onValueChange,
        })
      })}
    </div>
  )
}

interface RadioGroupItemProps {
  value: string
  disabled?: boolean
  className?: string
  id?: string
  children?: React.ReactNode
  /** @internal — injected by RadioGroup */
  selectedValue?: string
  /** @internal — injected by RadioGroup */
  onSelect?: (value: string) => void
}

function RadioGroupItem({
  value,
  disabled = false,
  className,
  id,
  children,
  selectedValue,
  onSelect,
}: RadioGroupItemProps) {
  const isSelected = value === selectedValue

  return (
    <button
      id={id}
      type="button"
      role="radio"
      aria-checked={isSelected}
      disabled={disabled}
      onClick={() => onSelect?.(value)}
      className={cn(
        "inline-flex items-center gap-2 text-left",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
          "focus-visible:ring-3 focus-visible:ring-ring/50",
          isSelected ? "border-primary" : "border-input",
        )}
      >
        {isSelected && (
          <span className="block h-2 w-2 rounded-full bg-primary" />
        )}
      </span>
      {children}
    </button>
  )
}

export { RadioGroup, RadioGroupItem }
export type { RadioGroupProps, RadioGroupItemProps }
