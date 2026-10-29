"use client";

import { useCallback, useState } from "react";
import { ArrowLeft, Briefcase, Check, Copy, FolderGit2, Mail, Terminal, TreePine, User } from "lucide-react";
import { usePortfolio } from "@/lib/store";
import { projects } from "@/data/projects";
import { profile } from "@/data/profile";
import { destinations } from "@/data/locations";
import type { PanelId } from "@/lib/types";
import { PanelDialog } from "./PanelDialog";
import {
  AboutContent,
  ContactContent,
  ExperienceTimeline,
  ProjectCard,
  ProjectDetail,
  SecretContent,
  SkillsContent,
  secondaryButton,
} from "./content";

const META: Record<PanelId, { title: string; icon: React.ReactNode; wide?: boolean }> = {
  about: { title: profile.name, icon: <User className="size-5" aria-hidden /> },
  projects: { title: "Featured projects", icon: <FolderGit2 className="size-5" aria-hidden />, wide: true },
  experience: { title: "Experience", icon: <Briefcase className="size-5" aria-hidden />, wide: true },
  skills: { title: "Technical skills", icon: <TreePine className="size-5" aria-hidden />, wide: true },
  contact: { title: "Let's talk", icon: <Mail className="size-5" aria-hidden /> },
  secret: { title: "~/secret", icon: <Terminal className="size-5" aria-hidden /> },
};

function CopyEmail() {
  const [copied, setCopied] = useState(false);
  if (!profile.email) return null;
  return (
    <button
      type="button"
      className={secondaryButton}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(profile.email!);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      <span aria-live="polite">{copied ? "Copied" : "Copy address"}</span>
    </button>
  );
}

function ProjectsBody() {
  const selected = usePortfolio((s) => s.selectedProject);
  const select = usePortfolio((s) => s.selectProject);
  const project = projects.find((p) => p.id === selected);
  if (project) {
    return (
      <div className="animate-rise">
        <button
          type="button"
          onClick={() => select(null)}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-cream/70 hover:text-cream"
        >
          <ArrowLeft className="size-4" aria-hidden /> All projects
        </button>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: project.color }}>
          {project.kind}
        </p>
        <h3 className="mb-4 mt-1 font-display text-2xl font-bold">{project.name}</h3>
        <ProjectDetail project={project} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-cream/65">
        Work highlights and personal or open-source projects from my résumé. Pick one for details — or drive up to a kiosk in
        the garage.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} onSelect={() => select(p.id)} />
        ))}
      </div>
    </div>
  );
}

export function Panels() {
  const active = usePortfolio((s) => s.activePanel);
  const close = usePortfolio((s) => s.closePanel);
  const openPanel = usePortfolio((s) => s.openPanel);
  const onClose = useCallback(() => close(), [close]);
  if (!active) return null;
  const meta = META[active];
  const dest = destinations.find((d) => d.panel === active);
  return (
    <PanelDialog
      open
      onClose={onClose}
      title={meta.title}
      eyebrow={dest ? `${dest.name} · ${dest.short}` : undefined}
      accent={dest?.color}
      icon={meta.icon}
      wide={meta.wide}
    >
      {active === "about" && <AboutContent onContact={() => openPanel("contact")} />}
      {active === "projects" && <ProjectsBody />}
      {active === "experience" && <ExperienceTimeline />}
      {active === "skills" && <SkillsContent />}
      {active === "contact" && <ContactContent copyButton={<CopyEmail />} />}
      {active === "secret" && <SecretContent />}
    </PanelDialog>
  );
}
