import { cva } from "class-variance-authority"

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[#d3da0c] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-[#d3da0c] text-black hover:bg-[#bbc10b] hover:shadow-glow active:scale-95",
        destructive:
          "bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-500",
        outline:
          "border-2 border-[#d3da0c] bg-transparent text-[#d3da0c] hover:bg-[#d3da0c] hover:text-black",
        secondary:
          "bg-white/10 text-white hover:bg-white/20 border border-white/20",
        ghost:
          "hover:bg-white/5 hover:text-[#d3da0c] text-white",
        link: "text-[#d3da0c] underline-offset-4 hover:underline hover:text-[#bbc10b]",
        lime: "bg-[#d3da0c] text-black font-semibold hover:bg-[#bbc10b] hover:shadow-glow active:scale-95",
      },
      size: {
        default: "h-10 px-6 py-2",
        sm: "h-8 rounded-md px-4 text-xs",
        lg: "h-12 rounded-md px-8 text-base",
        xl: "h-14 rounded-lg px-10 text-lg font-semibold",
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
