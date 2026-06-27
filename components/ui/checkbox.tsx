"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"

import { cn } from "@/lib/utils"
import { CheckIcon, MinusIcon } from "lucide-react"

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-[18px] shrink-0 items-center justify-center rounded-[4px] bg-white",
        "border-2 border-slate-500 shadow-sm transition-colors outline-none",
        "after:absolute after:-inset-x-3 after:-inset-y-2",
        "hover:border-slate-700",
        "focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-200",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-checked:border-emerald-700 data-checked:bg-emerald-600 data-checked:text-white",
        "data-indeterminate:border-emerald-700 data-indeterminate:bg-emerald-600 data-indeterminate:text-white",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5 [&>svg]:stroke-[3]"
        render={(props, state) => (
          <span {...props}>
            {state.indeterminate ? <MinusIcon /> : <CheckIcon />}
          </span>
        )}
      />
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
