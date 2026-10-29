import type { SkillCategory } from "@/lib/types";
import { experience } from "./experience";
import { projects } from "./projects";

/**
 * Every skill below appears on the résumé (skills section, a role's tech list, or a project).
 * "Used at" evidence is computed from experience.ts and projects.ts — no ratings or percentages.
 */
export const skillCategories: SkillCategory[] = [
  {
    id: "frontend",
    title: "Frontend",
    blurb: "Component-driven interfaces, state management and styling systems.",
    color: "#ff8a5c",
    skills: [
      { name: "React" },
      { name: "Next.js" },
      { name: "TypeScript" },
      { name: "JavaScript" },
      { name: "Redux" },
      { name: "Tailwind CSS" },
      { name: "SCSS / SASS", aliases: ["SCSS", "SASS"] },
      { name: "HTML & CSS" },
      { name: "MUI" },
      { name: "shadcn/ui" },
      { name: "Bootstrap" },
      { name: "GatsbyJS" },
      { name: "Framer Motion" },
      { name: "Vite, Webpack & Babel" },
    ],
  },
  {
    id: "mobile",
    title: "Mobile",
    blurb: "Cross-platform apps shipped for several companies and clients.",
    color: "#ff5d8f",
    skills: [{ name: "React Native" }, { name: "Expo" }, { name: "Cordova" }],
  },
  {
    id: "backend",
    title: "Backend",
    blurb: "APIs and services in Node.js and Python.",
    color: "#ffd166",
    skills: [
      { name: "Node.js" },
      { name: "Express.js" },
      { name: "Python" },
      { name: "Django" },
      { name: "Django REST Framework" },
      { name: "FastAPI" },
      { name: "Flask" },
      { name: "GraphQL" },
      { name: "REST APIs" },
      { name: "WebSockets & Socket.io" },
      { name: "OAuth, JWT & Passport.js" },
      { name: "Microservices" },
    ],
  },
  {
    id: "data",
    title: "Databases",
    blurb: "Relational, document and managed backends.",
    color: "#5fd4c4",
    skills: [
      { name: "PostgreSQL" },
      { name: "MongoDB" },
      { name: "Redis" },
      { name: "Firebase" },
      { name: "Supabase" },
      { name: "FaunaDB" },
      { name: "Prisma" },
      { name: "Sequelize" },
    ],
  },
  {
    id: "cloud",
    title: "Cloud & Infrastructure",
    blurb: "Containers, deployment pipelines and the major clouds.",
    color: "#4cc9f0",
    skills: [
      { name: "Docker" },
      { name: "Kubernetes", aliases: ["kubectl"] },
      { name: "AWS" },
      { name: "GCP" },
      { name: "Azure" },
      { name: "CI/CD" },
      { name: "Linux" },
      { name: "Nginx" },
    ],
  },
  {
    id: "ai",
    title: "AI & Integrations",
    blurb: "LLM, voice, real-time and payments integrations.",
    color: "#b388ff",
    skills: [
      { name: "OpenAI", aliases: ["OpenAI API"] },
      { name: "DeepSeek" },
      { name: "LangChain" },
      { name: "RAG" },
      { name: "Model Context Protocol" },
      { name: "Retell" },
      { name: "LiveKit" },
      { name: "Stripe" },
    ],
  },
  {
    id: "tooling",
    title: "Testing & Tooling",
    blurb: "Test frameworks, browser automation and team tooling.",
    color: "#9be564",
    skills: [
      { name: "Jest" },
      { name: "Cypress" },
      { name: "Playwright" },
      { name: "Puppeteer" },
      { name: "Mocha" },
      { name: "Git" },
      { name: "Jira" },
      { name: "Nx monorepos", aliases: ["Nx"] },
      { name: "bit.dev" },
      { name: "Figma" },
    ],
  },
  {
    id: "practice",
    title: "Architecture & Practice",
    blurb: "How I work on a team, taken from the roles on my résumé.",
    color: "#f7b2bd",
    skills: [
      { name: "Architecture & design decisions" },
      { name: "Leading a team of three developers" },
      { name: "Client communication & POC demos" },
      { name: "Sprint delivery & planning" },
      { name: "SEO" },
    ],
  },
];

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Companies and projects whose tech list mentions the skill. */
export function skillEvidence(skill: { name: string; aliases?: string[] }): string[] {
  const keys = [skill.name, ...(skill.aliases ?? [])].map(norm);
  const hit = (list: string[]) => list.some((t) => keys.includes(norm(t)));
  return [
    ...experience.filter((e) => hit(e.tech)).map((e) => e.company),
    ...projects.filter((p) => hit(p.tech)).map((p) => p.name),
  ];
}
