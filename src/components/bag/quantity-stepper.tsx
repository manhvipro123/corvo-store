import { Minus, Plus } from "lucide-react";

import { updateQuantity } from "@/app/bag/actions";

const stepClass =
  "flex size-10 items-center justify-center transition-colors hover:bg-foreground hover:text-background disabled:pointer-events-none disabled:opacity-30";

/**
 * − quantity + as one form; each button submits its own target quantity,
 * so it works before (or without) JavaScript. 1 → − removes the line.
 */
export function QuantityStepper({
  productId,
  quantity,
  max,
  name,
}: {
  productId: number;
  quantity: number;
  /** Live stock: + is disabled once reached. */
  max: number;
  name: string;
}) {
  return (
    <form
      action={updateQuantity}
      className="border-border inline-flex items-center border"
    >
      <input type="hidden" name="productId" value={productId} />
      <button
        type="submit"
        name="quantity"
        value={quantity - 1}
        aria-label={`Decrease quantity of ${name}`}
        className={stepClass}
      >
        <Minus className="size-3.5" strokeWidth={1.5} aria-hidden />
      </button>
      <output
        aria-label={`Quantity of ${name}`}
        className="text-meta w-8 text-center tabular-nums"
      >
        {quantity}
      </output>
      <button
        type="submit"
        name="quantity"
        value={quantity + 1}
        disabled={quantity >= max}
        aria-label={`Increase quantity of ${name}`}
        className={stepClass}
      >
        <Plus className="size-3.5" strokeWidth={1.5} aria-hidden />
      </button>
    </form>
  );
}
