const wholeDollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const withCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** Formats whole cents as USD: "$2,650", or "$12.50" when there are cents. */
export function formatPrice(cents: number) {
  return cents % 100 === 0
    ? wholeDollars.format(cents / 100)
    : withCents.format(cents / 100);
}
