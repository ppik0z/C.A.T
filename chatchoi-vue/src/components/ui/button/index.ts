import { cva, type VariantProps } from 'class-variance-authority';

export { default as Button } from './Button.vue';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_span.material-symbols-outlined]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-on-primary shadow-sm hover:bg-primary/90 active:scale-[0.98]',
        destructive: 'bg-error text-on-error shadow-sm hover:bg-error/90 active:scale-[0.98]',
        outline: 'border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-high',
        secondary: 'bg-surface-container-high text-on-surface hover:bg-outline-variant/25',
        ghost: 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
        link: 'h-auto p-0 text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-5',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
