import type { Project } from "@/lib/types";

/**
 * Only projects documented on the résumé (or its linked repositories) appear here.
 * Add a project by appending an object — the garage builds a kiosk for each of the
 * first six entries automatically. Fields you leave out are simply not rendered.
 */
export const projects: Project[] = [
  {
    id: "mv3-migration",
    name: "Chrome Extensions: MV2 → MV3",
    kind: "Work highlight",
    summary:
      "Migration of Ticket Broker List's business Chrome extensions from Manifest V2 to Manifest V3.",
    problem:
      "The business's Chrome extensions were built on Manifest V2 and needed to move to the Manifest V3 platform.",
    contribution:
      "Executed the entire migration single-handedly — analysing the required changes, refactoring the code, and ensuring compatibility with the new version.",
    tech: ["Chrome Extensions", "Manifest V3", "JavaScript"],
    color: "#ff7a59",
  },
  {
    id: "seo-overhaul",
    name: "SEO Overhaul",
    kind: "Work highlight",
    summary: "Search engine optimisation work for several prominent websites at Infoware.",
    contribution: "Accountable for improving SEO across the sites.",
    outcomes: [
      "SEO audit score raised from 6% to 98%.",
      "Traffic increased by approximately 34% afterwards.",
    ],
    tech: ["SEO"],
    todo: "Site names and audit tool aren't on the résumé — add them if you can share them.",
    color: "#7cd38a",
  },
  {
    id: "rtube",
    name: "Rtube",
    kind: "Personal project",
    summary:
      "A YouTube clone built on the YouTube Data API v3 for browsing and watching videos.",
    contribution: "Built the app with Google authentication and Firebase.",
    tech: ["React", "Redux", "Firebase", "Google Auth", "SCSS", "Axios", "YouTube Data API v3"],
    todo: "Add a live demo or repository link when available.",
    color: "#ff4d6d",
  },
  {
    id: "mira",
    name: "Mira",
    kind: "Open source",
    summary: "An open-source Next.js application published on GitHub with a live deployment.",
    tech: ["Next.js", "TypeScript", "Tailwind CSS"],
    liveUrl: "https://mira-chi-beryl.vercel.app",
    sourceUrl: "https://github.com/Anshuman-Programmer/mira",
    todo: "The repository has no description yet — add a one-line summary of what Mira does.",
    color: "#9b7bff",
  },
  {
    id: "design-wave",
    name: "Design Wave",
    kind: "Open source",
    summary: "An open-source Next.js and TypeScript project published on GitHub.",
    tech: ["Next.js", "TypeScript", "Tailwind CSS"],
    sourceUrl: "https://github.com/Anshuman-Programmer/design-wave",
    todo: "The repository has no description yet — add a one-line summary of what it does.",
    color: "#4cc9f0",
  },
  {
    id: "medusa",
    name: "Medusa.js Contribution",
    kind: "Open source",
    summary: "Contribution to Medusa, the open-source headless commerce platform.",
    tech: ["TypeScript", "Node.js"],
    sourceUrl: "https://github.com/medusajs/medusa",
    todo: "Link the specific pull request(s) to show exactly what you contributed.",
    color: "#f4a259",
  },
  {
    id: "portfolio-gatsby",
    name: "Portfolio Website",
    kind: "Personal project",
    summary: "A professional portfolio showcasing projects and skills.",
    tech: ["GatsbyJS", "SCSS", "Framer Motion"],
    liveUrl: "https://anshumantalukdar.netlify.app/",
    color: "#ffd166",
  },
];
