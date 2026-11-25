import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field";

import { cn } from "@/lib/cn";

/**
 * Stepped numeric input (Base UI NumberField) for `X/Y/Z`, `θx`, `ky/kz`
 * and load magnitudes: mono data font, hairline chrome, −/+ steppers.
 */
export function NumberFieldRoot(props: NumberFieldPrimitive.Root.Props) {
  return <NumberFieldPrimitive.Root {...props} />;
}

export function NumberFieldInput({ className, ...props }: NumberFieldPrimitive.Input.Props) {
  return (
    <NumberFieldPrimitive.Input
      className={cn(
        "font-data h-8 w-full rounded-[4px] border border-hairline bg-panel px-2 text-[12px] text-ink-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ring",
        className,
      )}
      {...props}
    />
  );
}

export function NumberFieldGroup({ className, ...props }: NumberFieldPrimitive.Group.Props) {
  return (
    <NumberFieldPrimitive.Group className={cn("flex items-center gap-1", className)} {...props} />
  );
}

function StepperButton({ className, ...props }: React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "flex size-6 items-center justify-center rounded-[3px] border border-hairline text-[12px] text-ink-secondary hover:border-border-subtle hover:text-ink-primary",
        className,
      )}
      {...props}
    />
  );
}

export function NumberFieldDecrement({
  className,
  ...props
}: NumberFieldPrimitive.Decrement.Props) {
  return (
    <NumberFieldPrimitive.Decrement render={<StepperButton />} className={className} {...props} />
  );
}

export function NumberFieldIncrement({
  className,
  ...props
}: NumberFieldPrimitive.Increment.Props) {
  return (
    <NumberFieldPrimitive.Increment render={<StepperButton />} className={className} {...props} />
  );
}
