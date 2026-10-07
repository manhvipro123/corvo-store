"use client";

/**
 * A date in the viewer's own time zone (an order placed at 1am local time
 * shouldn't show the previous day's UTC date). The server renders its own
 * zone first; the browser re-renders it in the viewer's.
 */
export function OrderDate({
  date,
  dateStyle = "medium",
  timeStyle,
}: {
  date: Date;
  dateStyle?: "medium" | "long";
  /** Also show the time, e.g. in stock history. */
  timeStyle?: "short";
}) {
  return (
    <time dateTime={date.toISOString()} suppressHydrationWarning>
      {new Intl.DateTimeFormat("en-US", { dateStyle, timeStyle }).format(date)}
    </time>
  );
}
