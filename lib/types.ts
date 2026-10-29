export type PanelId =
  | "about"
  | "projects"
  | "experience"
  | "skills"
  | "contact"
  | "secret";

export type LocationId =
  | "home"
  | "garage"
  | "skills"
  | "tower"
  | "lighthouse"
  | "secret";

export interface ProfileLink {
  label: string;
  href: string;
  /** Short note shown next to the link, e.g. where it came from. */
  note?: string;
}

export interface Profile {
  name: string;
  headline: string;
  tagline: string;
  summary: string[];
  focus: string[];
  email: string | null;
  /** Kept in config but hidden on the public site unless `showPhone` is true. */
  phone: string | null;
  showPhone: boolean;
  /** Not present on the résumé — set this when you want it shown. */
  linkedin: string | null;
  github: string | null;
  website: string | null;
  links: ProfileLink[];
  writing: ProfileLink[];
  resumePath: string;
  languages: string[];
  education: {
    degree: string;
    detail?: string;
    school: string;
    location: string;
    start: string;
    end: string;
  }[];
}

export interface ExperienceEntry {
  id: string;
  company: string;
  role: string;
  location: string;
  /** "YYYY-MM" */
  start: string;
  /** "YYYY-MM" */
  end: string;
  highlights: string[];
  tech: string[];
}

export interface Project {
  id: string;
  name: string;
  kind: "Personal project" | "Open source" | "Work highlight";
  summary: string;
  problem?: string;
  contribution?: string;
  challenges?: string[];
  outcomes?: string[];
  tech: string[];
  liveUrl?: string;
  sourceUrl?: string;
  image?: string;
  /** Things the owner still needs to supply — rendered as a subtle note. */
  todo?: string;
  /** Accent used for the kiosk in the garage and the card in the panel. */
  color: string;
}

export interface SkillCategory {
  id: string;
  title: string;
  blurb: string;
  color: string;
  skills: { name: string; aliases?: string[] }[];
}

export interface Destination {
  id: LocationId;
  name: string;
  short: string;
  /** Prompt text when the car is parked on the pad, e.g. "Browse projects". */
  cta: string;
  panel: PanelId;
  /** World-space anchor (x, z) of the interaction zone. */
  position: [number, number];
  radius: number;
  color: string;
  /** Where the camera sits while the panel is open, relative to `position`. */
  focusOffset: [number, number, number];
  hidden?: boolean;
}

export type QualityMode = "auto" | "high" | "low";
export type Phase = "loading" | "intro" | "driving";
