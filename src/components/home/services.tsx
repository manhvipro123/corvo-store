import { Container } from "@/components/ui/container";

const services = [
  {
    title: "Complimentary shipping",
    body: "Free express delivery on every order, tracked from dispatch to door.",
  },
  {
    title: "Easy returns",
    body: "Return unworn pieces within 30 days at no cost.",
  },
  {
    title: "Signature packaging",
    body: "Every order arrives wrapped, with a handwritten note on request.",
  },
];

/** Quiet service strip above the footer: hairline-divided, left-aligned. */
export function Services() {
  return (
    <section aria-label="Services" className="border-border border-t">
      <Container>
        <ul className="divide-border grid divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
          {services.map((service) => (
            <li
              key={service.title}
              className="flex flex-col gap-2 py-6 md:px-6 md:py-10 md:first:pl-0 md:last:pr-0"
            >
              <h3 className="text-label">{service.title}</h3>
              <p className="text-meta text-muted max-w-xs">{service.body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
