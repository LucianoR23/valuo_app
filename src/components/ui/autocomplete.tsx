"use client"

import * as React from "react"
import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete"
import { cn } from "@/lib/utils"
import { fieldControl } from "@/components/ui/field-styles"

/**
 * A text field that offers earlier values while typing (plan 3.8). The
 * text stays free: the list only helps. Matching ignores case and accents.
 * `onValueChange` gets `picked` true when an item of the list was chosen.
 */
function Autocomplete({
  items,
  value,
  onValueChange,
  limit = 6,
  className,
  ...inputProps
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "defaultValue"> & {
  items: readonly string[]
  value: string
  onValueChange: (value: string, picked: boolean) => void
  /** How many items the list shows at most. */
  limit?: number
}) {
  // Opens only while some item fits what is typed: an empty popup would
  // still hide the rest of the page from screen readers.
  const [open, setOpen] = React.useState(false)
  const filter = AutocompletePrimitive.useFilter({ sensitivity: "base" })
  const query = value.trim()
  const fits = query !== "" && items.some((item) => item !== value && filter.contains(item, query))
  return (
    <AutocompletePrimitive.Root
      items={items}
      value={value}
      limit={limit}
      open={open && fits}
      onOpenChange={setOpen}
      onValueChange={(v, details) => onValueChange(v, details.reason === "item-press")}
    >
      <AutocompletePrimitive.Input
        data-slot="autocomplete-input"
        className={cn(fieldControl, className)}
        {...inputProps}
      />
      <AutocompletePrimitive.Portal>
        <AutocompletePrimitive.Positioner className="isolate z-50 outline-none" sideOffset={4}>
          <AutocompletePrimitive.Popup
            data-slot="autocomplete-content"
            className={cn(
              "z-50 max-h-(--available-height) w-(--anchor-width) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
              "data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95",
            )}
          >
            <AutocompletePrimitive.List>
              {(item: string) => (
                <AutocompletePrimitive.Item
                  key={item}
                  value={item}
                  className="flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none transition-colors data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  {item}
                </AutocompletePrimitive.Item>
              )}
            </AutocompletePrimitive.List>
          </AutocompletePrimitive.Popup>
        </AutocompletePrimitive.Positioner>
      </AutocompletePrimitive.Portal>
    </AutocompletePrimitive.Root>
  )
}

export { Autocomplete }
