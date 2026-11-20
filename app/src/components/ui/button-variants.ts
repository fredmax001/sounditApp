import { cva } from "class-variance-authority"

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[#d3da0c] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default:
          "bg-[#020B00] text-[#D3DA0C] hover:bg-[#020B00]/90 dark:bg-[#d3da0c] dark:text-[#020B00] dark:hover:bg-[#bbc10b] dark:hover:shadow-glow active:scale-95 shadow-sm",
        destructive:
          "bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-500",
        outline:
          "border-2 border-[#020B00] dark:border-[#d3da0c] bg-transparent text-[#020B00] dark:text-[#d3da0c] hover:bg-[#020B00] hover:text-[#D3DA0C] dark:hover:bg-[#d3da0c] dark:hover:text-black",
        secondary:
          "bg-[#D3DA0C] text-[#020B00] hover:bg-[#bbc10b] dark:bg-white/10 dark:text-white dark:hover:bg-white/20 border border-black/10 dark:border-white/20",
        ghost:
          "hover:bg-black/5 dark:hover:bg-white/5 text-[#020B00] dark:text-white hover:text-[#d3da0c]",
        link: "text-[#020B00] dark:text-[#d3da0c] underline-offset-4 hover:underline hover:text-[#d3da0c] dark:hover:text-[#bbc10b]",
        lime: "bg-[#d3da0c] text-black font-semibold hover:bg-[#bbc10b] hover:shadow-glow active:scale-95",
      },
      size: {
        default: "min-h-10 px-[1.5em] py-[0.55em]",
        sm: "min-h-8 rounded-md px-[1.15em] py-[0.45em] text-xs",
        lg: "min-h-12 rounded-md px-[1.75em] py-[0.65em] text-base",
        xl: "min-h-14 rounded-lg px-[2em] py-[0.75em] text-lg font-semibold",
        icon: "size-10",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
