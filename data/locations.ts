import type { Destination } from "@/lib/types";

/**
 * Portfolio destinations on the island. Positions are world (x, z) in metres;
 * north is -z. The road network in lib/world/layout.ts is laid out around these.
 */
export const destinations: Destination[] = [
  {
    id: "home",
    name: "Home Base",
    short: "About me",
    cta: "Read about me",
    panel: "about",
    position: [-10, 72],
    radius: 13,
    color: "#ffb26b",
    focusOffset: [16, 9, -6],
  },
  {
    id: "garage",
    name: "Project Garage",
    short: "Featured projects",
    cta: "Browse projects",
    panel: "projects",
    position: [86, -6],
    radius: 15,
    color: "#ff6b8b",
    focusOffset: [-20, 10, 12],
  },
  {
    id: "skills",
    name: "Skills Grove",
    short: "Technical skills",
    cta: "Explore skills",
    panel: "skills",
    position: [22, -82],
    radius: 14,
    color: "#7ee0b5",
    focusOffset: [14, 12, 22],
  },
  {
    id: "tower",
    name: "Experience Tower",
    short: "Career timeline",
    cta: "View career timeline",
    panel: "experience",
    position: [-66, -66],
    radius: 13,
    color: "#ffd166",
    focusOffset: [20, 12, 18],
  },
  {
    id: "lighthouse",
    name: "Contact Lighthouse",
    short: "Get in touch",
    cta: "Get in touch",
    panel: "contact",
    position: [-112, 4],
    radius: 14,
    color: "#7fb7ff",
    focusOffset: [22, 12, 14],
  },
  {
    id: "secret",
    name: "Hidden Terminal",
    short: "You found something",
    cta: "Peek at the terminal",
    panel: "secret",
    position: [-30, -98],
    radius: 8,
    color: "#5dff9d",
    focusOffset: [8, 5, 9],
    hidden: true,
  },
];

export const destinationById = Object.fromEntries(destinations.map((d) => [d.id, d])) as Record<
  Destination["id"],
  Destination
>;
