import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn, useOutsideClick } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export function SideBorderButton({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  return (
    <Button
      className={cn("hover:bg-transparent border-2 border-l-cyan-700 border-r-cyan-700 hover:border-l-cyan-600 hover:border-r-cyan-600 border-t-0 border-b-0 rounded-none", className)}
      variant={variant}
      size={size}
      {...props}
    />
  )
}

export function DoubleClickButton({
  onAccept,
  className,
  confirmClassName,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  } & {onAccept: ()=>any, confirmClassName?: string}) {
  const [clicked, setClicked] = React.useState(false)
  
  const wrapRef = React.useRef(null)

  useOutsideClick(wrapRef, ()=>setClicked(false))

  if (clicked) return (
    <Button
      className={cn(className, "dark:border-red-700 dark:bg-red-950 dark:hover:border-red-500 dark:hover:bg-red-950", confirmClassName)}
      variant={variant}
      size={size}
      ref={wrapRef}
      {...props}
      onClick={()=>{
        onAccept()
        setClicked(false)
      }}
    />
  )
  return (
    <Button
      className={className}
      variant={variant}
      size={size}
      {...props}
      onClick={()=>setClicked(true)}
    />
  )
}

export { Button, buttonVariants }
