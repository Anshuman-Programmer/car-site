import type { Profile } from "@/lib/types";

/**
 * Source of truth: Anshuman-Talukdar-resume.html / .pdf (July 2026 version).
 * Edit this file to change what the site says — the 3D world never hardcodes copy.
 */
export const profile: Profile = {
  name: "Anshuman Talukdar",
  headline: "Senior Software Developer · Full-Stack",
  tagline: "Take a drive through my work.",
  summary: [
    "I build products end to end — React and Next.js frontends, Node.js and Python (Django, FastAPI, Flask) backends, and cross-platform mobile apps with React Native and Cordova.",
    "Most recently I was a Senior Software Developer at Quilo Solutions, working closely with the CEO on product development, leading a team of three developers, and owning architecture decisions across several products.",
    "Before that I single-handedly migrated a business's Chrome extensions from Manifest V2 to V3 at Ticket Broker List, and lifted SEO audit scores from 6% to 98% for several websites at Infoware.",
  ],
  focus: [
    "Full-stack product engineering",
    "Frontend architecture (React, Next.js, TypeScript)",
    "Python & Node.js APIs",
    "Cross-platform mobile",
    "AI & real-time integrations (OpenAI, Retell, LiveKit)",
  ],
  email: "anshumantalukdar02@gmail.com",
  phone: "848-643-1724",
  showPhone: false,
  // The résumé does not list a LinkedIn URL. Add yours here to show it.
  linkedin: null,
  // Derived from the open-source repository links on the résumé.
  github: "https://github.com/Anshuman-Programmer",
  website: "https://anshumantalukdar.netlify.app/",
  links: [
    { label: "Personal website", href: "https://anshumantalukdar.netlify.app/" },
    { label: "Alternative portfolio", href: "https://anshuman-site.vercel.app/" },
  ],
  writing: [
    { label: "Blog", href: "https://anshuman-site.vercel.app/blog" },
    {
      label: "Integrating Clerk Authentication with Next.js & Syncing Users to Database",
      href: "https://anshuman-site.vercel.app/blog/integrating-clerk-authentication-nextjs-syncing-users-database",
    },
  ],
  resumePath: "/resume.pdf",
  languages: ["English", "Hindi", "Assamese"],
  education: [
    {
      degree: "Bachelor of Computer Science",
      detail: "Major in Computer Engineering",
      school: "Kaziranga University",
      location: "Jorhat, Assam",
      start: "2020-06",
      end: "2024-06",
    },
  ],
};
