import type { ExperienceEntry } from "@/lib/types";

/**
 * Most recent first. Dates, titles and locations are copied from the résumé.
 * Tech lists are the résumé's per-role lists, de-duplicated and split where two
 * names had run together (e.g. "Expo Tailwind CSS" → "Expo", "Tailwind CSS").
 */
export const experience: ExperienceEntry[] = [
  {
    id: "quilo",
    company: "Quilo Solutions",
    role: "Senior Software Developer",
    location: "New York, USA",
    start: "2025-04",
    end: "2026-08",
    highlights: [
      "Worked closely with the CEO on product development as part of the core engineering team, contributing to multiple products.",
      "Led a team of three developers — assigning work and keeping delivery on schedule.",
      "Owned architectural design decisions to keep solutions scalable and maintainable across projects.",
    ],
    tech: [
      "React", "Next.js", "TypeScript", "JavaScript", "React Native", "Tailwind CSS", "Redux",
      "SCSS", "Node.js", "Express.js", "Cordova", "Python", "Django", "Django REST Framework",
      "Flask", "FastAPI", "Retell", "LiveKit", "Stripe", "OpenAI", "DeepSeek", "Docker",
      "kubectl", "PostgreSQL",
    ],
  },
  {
    id: "ticket-broker-list",
    company: "Ticket Broker List",
    role: "Senior Software Developer",
    location: "New York, USA",
    start: "2023-03",
    end: "2025-01",
    highlights: [
      "Planned and designed the application architecture with the development team, analysing requirements with scalability and robustness in mind.",
      "Single-handedly migrated the business's Chrome extensions from Manifest V2 to V3 — analysing required changes, refactoring code, and ensuring compatibility.",
      "Met with clients daily and presented proof-of-concept demos of the application's capabilities.",
      "Built and shipped mobile apps with React Native (Expo) and Cordova across several projects.",
    ],
    tech: [
      "React", "Next.js", "TypeScript", "JavaScript", "React Native", "Expo", "Tailwind CSS",
      "Redux", "SCSS", "Node.js", "Express.js", "Cordova", "Python", "Django",
      "Django REST Framework", "FastAPI", "Flask", "Bootstrap", "PostgreSQL", "Docker",
      "kubectl", "Git", "Jira",
    ],
  },
  {
    id: "infoware",
    company: "Infoware",
    role: "Software Developer",
    location: "Gujarat, India",
    start: "2022-11",
    end: "2023-02",
    highlights: [
      "Improved SEO for several prominent websites, raising their audit score from 6% to 98% — followed by an approximate 34% increase in traffic.",
      "Helped plan and design the application architecture and integrated key business features.",
      "Kept sprint milestones on schedule by tracking progress and clearing roadblocks with the team.",
    ],
    tech: [
      "React", "Next.js", "TypeScript", "JavaScript", "React Native", "Expo", "MUI", "Redux",
      "SCSS", "Node.js", "Express.js", "Python", "Django", "Django REST Framework",
    ],
  },
  {
    id: "techstuff",
    company: "TechStuff",
    role: "React Engineer",
    location: "Madhya Pradesh, India",
    start: "2022-07",
    end: "2022-10",
    highlights: [
      "Built modular, reusable solutions with bit.dev, FaunaDB and GraphQL.",
      "Managed multiple applications in a single Nx monorepo to keep code sharing consistent.",
    ],
    tech: [
      "React", "Next.js", "TypeScript", "JavaScript", "MUI", "Redux", "SCSS", "Node.js",
      "Express.js", "Python", "Cordova", "GraphQL", "FaunaDB", "bit.dev", "Nx",
    ],
  },
  {
    id: "smilebots",
    company: "Smilebots",
    role: "Associate Application Developer",
    location: "Chhattisgarh, India",
    start: "2021-07",
    end: "2022-07",
    highlights: [
      "Worked directly with the client to add features and implement changes.",
      "Managed main-branch merges and maintenance.",
      "Ran project orientations for new team members.",
    ],
    tech: [
      "React", "TypeScript", "JavaScript", "MUI", "Redux", "SCSS", "Node.js", "Express.js",
      "Python", "Cordova",
    ],
  },
  {
    id: "freelance",
    company: "Freelance",
    role: "Software Developer",
    location: "Remote",
    start: "2020-01",
    end: "2021-06",
    highlights: [
      "Delivered frontend work for client projects including Forest Night, Sincity Map and Voxis.",
      "Built and maintained cross-platform mobile apps with React Native (Expo) and Cordova.",
    ],
    tech: [
      "React", "Next.js", "TypeScript", "JavaScript", "Tailwind CSS", "Redux", "SCSS",
      "Node.js", "Express.js", "Python", "Cordova", "Django", "Django REST Framework",
      "FastAPI", "Bootstrap", "PostgreSQL", "Docker", "kubectl", "Git", "Jira", "shadcn/ui",
    ],
  },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

function monthIndex(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return y * 12 + (m - 1);
}

export function durationLabel(start: string, end: string): string {
  const months = monthIndex(end) - monthIndex(start) + 1;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y} yr${y > 1 ? "s" : ""}` : "", m ? `${m} mo` : ""].filter(Boolean).join(" ");
}

/** Total months covered by roles (overlaps merged), so the headline number is derived, not typed. */
export function totalExperienceYears(entries: ExperienceEntry[] = experience): number {
  const ranges = entries
    .map((e) => [monthIndex(e.start), monthIndex(e.end)] as const)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const [s, e] of ranges) {
    if (!cur || s > cur[1] + 1) {
      if (cur) total += cur[1] - cur[0] + 1;
      cur = [s, e];
    } else cur[1] = Math.max(cur[1], e);
  }
  if (cur) total += cur[1] - cur[0] + 1;
  return total / 12;
}

export const experienceSince = experience[experience.length - 1].start.slice(0, 4);
