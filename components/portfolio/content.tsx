import { Download, ExternalLink, GraduationCap, Languages, Mail, MapPin, PenLine, Sparkles } from "lucide-react";
import { profile } from "@/data/profile";
import { durationLabel, experience, experienceSince, formatMonth, totalExperienceYears } from "@/data/experience";
import { projects } from "@/data/projects";
import { skillCategories, skillEvidence } from "@/data/skills";
import type { Project } from "@/lib/types";
import { GithubIcon, LinkedinIcon } from "./icons";

/**
 * Plain, hook-free content blocks. Used by the in-world dialogs, the
 * conventional /portfolio page and the WebGL fallback alike.
 */

export const yearsLabel = `${Math.floor(totalExperienceYears())}+ years`;

function Pill({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full border border-cream/12 bg-cream/[0.06] px-2.5 py-1 text-xs font-medium text-cream/85"
      style={color ? { borderColor: `${color}55`, background: `${color}14` } : undefined}
    >
      {children}
    </span>
  );
}

export function ExtLink({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

const button =
  "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 focus-visible:-translate-y-0.5";
export const primaryButton = `${button} bg-coral text-ink shadow-[0_8px_24px_-10px_#ff7a59] hover:bg-[#ff8d70]`;
export const secondaryButton = `${button} border border-cream/15 bg-cream/[0.06] text-cream hover:bg-cream/[0.12]`;

export function ResumeButton({ className = primaryButton }: { className?: string }) {
  return (
    <a href={profile.resumePath} download="Anshuman-Talukdar-resume.pdf" className={className}>
      <Download className="size-4" aria-hidden />
      Download résumé (PDF)
    </a>
  );
}

// ------------------------------------------------------------------ About

export function AboutContent({ onContact }: { onContact?: () => void }) {
  const current = experience[0];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { k: yearsLabel, v: `building software since ${experienceSince}` },
          { k: `${experience.length - 1} companies`, v: "plus freelance work" },
          { k: "Full-stack", v: "web · mobile · APIs" },
        ].map((s) => (
          <div key={s.k} className="rounded-xl border border-cream/10 bg-cream/[0.04] px-2 py-3">
            <div className="font-display text-lg font-bold text-gold">{s.k}</div>
            <div className="mt-0.5 text-[11px] leading-tight text-cream/60">{s.v}</div>
          </div>
        ))}
      </div>
      <div className="space-y-3 text-[15px] leading-relaxed text-cream/85">
        {profile.summary.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-cream/50">Focus</h3>
        <div className="flex flex-wrap gap-2">
          {profile.focus.map((f) => (
            <Pill key={f}>{f}</Pill>
          ))}
        </div>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl border border-cream/10 bg-cream/[0.03] p-3">
          <dt className="flex items-center gap-2 text-xs uppercase tracking-wider text-cream/50">
            <MapPin className="size-3.5" aria-hidden /> Most recent role
          </dt>
          <dd className="mt-1 font-medium">
            {current.role}, {current.company}
            <span className="block text-xs text-cream/55">
              {formatMonth(current.start)} – {formatMonth(current.end)}
            </span>
          </dd>
        </div>
        <div className="rounded-xl border border-cream/10 bg-cream/[0.03] p-3">
          <dt className="flex items-center gap-2 text-xs uppercase tracking-wider text-cream/50">
            <GraduationCap className="size-3.5" aria-hidden /> Education
          </dt>
          {profile.education.map((e) => (
            <dd key={e.school} className="mt-1 font-medium">
              {e.degree}
              <span className="block text-xs text-cream/55">
                {e.detail} · {e.school}, {formatMonth(e.start)} – {formatMonth(e.end)}
              </span>
            </dd>
          ))}
        </div>
        <div className="rounded-xl border border-cream/10 bg-cream/[0.03] p-3 sm:col-span-2">
          <dt className="flex items-center gap-2 text-xs uppercase tracking-wider text-cream/50">
            <Languages className="size-3.5" aria-hidden /> Languages
          </dt>
          <dd className="mt-1 font-medium">{profile.languages.join(" · ")} — professional proficiency or above</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-3">
        <ResumeButton />
        {onContact ? (
          <button type="button" onClick={onContact} className={secondaryButton}>
            <Mail className="size-4" aria-hidden /> Contact me
          </button>
        ) : (
          <a href="#contact" className={secondaryButton}>
            <Mail className="size-4" aria-hidden /> Contact me
          </a>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Projects

export function ProjectCard({ project, onSelect }: { project: Project; onSelect?: () => void }) {
  const inner = (
    <>
      <span className="absolute inset-y-3 left-0 w-1 rounded-r-full" style={{ background: project.color }} aria-hidden />
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: project.color }}>
        {project.kind}
      </span>
      <span className="mt-1 block font-display text-lg font-bold leading-snug">{project.name}</span>
      <span className="mt-1 block text-sm leading-relaxed text-cream/70">{project.summary}</span>
      <span className="mt-3 flex flex-wrap gap-1.5">
        {project.tech.slice(0, 5).map((t) => (
          <span key={t} className="rounded-md bg-cream/[0.07] px-1.5 py-0.5 text-[11px] text-cream/70">
            {t}
          </span>
        ))}
      </span>
    </>
  );
  const cls =
    "group relative block w-full overflow-hidden rounded-2xl border border-cream/10 bg-cream/[0.035] py-4 pl-5 pr-4 text-left transition hover:border-cream/25 hover:bg-cream/[0.07]";
  return onSelect ? (
    <button type="button" onClick={onSelect} className={cls}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function ProjectDetail({ project }: { project: Project }) {
  const rows: [string, string | undefined][] = [
    ["Problem", project.problem],
    ["My contribution", project.contribution],
  ];
  return (
    <article className="space-y-5">
      <div className="h-1.5 w-16 rounded-full" style={{ background: project.color }} aria-hidden />
      <p className="text-[15px] leading-relaxed text-cream/85">{project.summary}</p>
      {rows
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <section key={k}>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-cream/50">{k}</h4>
            <p className="text-sm leading-relaxed text-cream/80">{v}</p>
          </section>
        ))}
      {project.challenges?.length ? (
        <section>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-cream/50">Engineering challenges</h4>
          <ul className="list-disc space-y-1 pl-5 text-sm text-cream/80">
            {project.challenges.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {project.outcomes?.length ? (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-cream/50">Documented outcomes</h4>
          <ul className="space-y-2">
            {project.outcomes.map((o) => (
              <li key={o} className="flex gap-2 rounded-xl border border-moss/20 bg-moss/[0.06] px-3 py-2 text-sm text-cream/90">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-moss" aria-hidden />
                {o}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-cream/50">Tech</h4>
        <div className="flex flex-wrap gap-2">
          {project.tech.map((t) => (
            <Pill key={t} color={project.color}>
              {t}
            </Pill>
          ))}
        </div>
      </section>
      {(project.liveUrl || project.sourceUrl) && (
        <div className="flex flex-wrap gap-3">
          {project.liveUrl && (
            <ExtLink href={project.liveUrl} className={primaryButton}>
              <ExternalLink className="size-4" aria-hidden /> Live site
            </ExtLink>
          )}
          {project.sourceUrl && (
            <ExtLink href={project.sourceUrl} className={secondaryButton}>
              <GithubIcon className="size-4" /> Source
            </ExtLink>
          )}
        </div>
      )}
      {project.todo && (
        <p className="rounded-xl border border-dashed border-gold/30 bg-gold/[0.05] px-3 py-2 text-xs text-gold/90">
          <span className="font-semibold">To add:</span> {project.todo}
        </p>
      )}
    </article>
  );
}

export function AllProjects() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {projects.map((p) => (
        <div key={p.id} className="rounded-2xl border border-cream/10 bg-cream/[0.03] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: p.color }}>
            {p.kind}
          </p>
          <h3 className="mb-3 mt-1 font-display text-xl font-bold">{p.name}</h3>
          <ProjectDetail project={p} />
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Experience

export function ExperienceTimeline() {
  return (
    <ol className="relative space-y-5 border-l border-cream/12 pl-6">
      {experience.map((e, i) => (
        <li key={e.id} className="relative">
          <span
            className="absolute -left-[31px] top-1.5 size-3.5 rounded-full border-2 border-ink"
            style={{ background: i === 0 ? "#ffd166" : "#ff8fab" }}
            aria-hidden
          />
          <div className="rounded-2xl border border-cream/10 bg-cream/[0.035] p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="font-display text-lg font-bold leading-tight">
                {e.role} <span className="text-cream/50">·</span> <span className="text-gold">{e.company}</span>
              </h3>
              <p className="font-mono text-xs text-cream/60">
                <time dateTime={e.start}>{formatMonth(e.start)}</time> – <time dateTime={e.end}>{formatMonth(e.end)}</time>
              </p>
            </div>
            <p className="mt-0.5 text-xs text-cream/55">
              {e.location} · {durationLabel(e.start, e.end)}
            </p>
            <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-cream/85">
              {e.highlights.map((h) => (
                <li key={h} className="flex gap-2">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-coral" aria-hidden />
                  {h}
                </li>
              ))}
            </ul>
            <details className="group mt-3">
              <summary className="cursor-pointer select-none text-xs font-semibold text-cream/60 hover:text-cream">
                Technologies ({e.tech.length})
              </summary>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {e.tech.map((t) => (
                  <span key={t} className="rounded-md bg-cream/[0.07] px-1.5 py-0.5 text-[11px] text-cream/75">
                    {t}
                  </span>
                ))}
              </div>
            </details>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ------------------------------------------------------------------ Skills

export function SkillsContent() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-cream/65">
        Everything here appears on my résumé. Where a skill shows up in a role or project, that&apos;s listed underneath — no
        made-up percentages.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {skillCategories.map((c) => (
          <section key={c.id} className="rounded-2xl border border-cream/10 bg-cream/[0.035] p-4">
            <h3 className="flex items-center gap-2 font-display text-base font-bold">
              <span className="size-2.5 rounded-sm" style={{ background: c.color }} aria-hidden />
              {c.title}
            </h3>
            <p className="mb-3 mt-1 text-xs text-cream/55">{c.blurb}</p>
            <ul className="flex flex-wrap gap-1.5">
              {c.skills.map((s) => {
                const ev = skillEvidence(s);
                return (
                  <li
                    key={s.name}
                    className="rounded-lg border border-cream/10 bg-ink/40 px-2 py-1 text-xs"
                    title={ev.length ? `Used at: ${ev.join(", ")}` : "Listed in my résumé's skills"}
                  >
                    <span className="font-medium text-cream/90">{s.name}</span>
                    {ev.length > 0 && <span className="ml-1 text-[10px] text-cream/45">· {ev.length}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <p className="text-xs text-cream/45">The small number is how many of my roles and projects list that skill — hover for names.</p>
    </div>
  );
}

// ------------------------------------------------------------------ Contact

export function ContactContent({ copyButton }: { copyButton?: React.ReactNode }) {
  const links = [
    profile.github && { label: "GitHub", href: profile.github, icon: <GithubIcon className="size-5" />, note: "github.com/Anshuman-Programmer" },
    profile.linkedin && { label: "LinkedIn", href: profile.linkedin, icon: <LinkedinIcon className="size-5" />, note: "" },
    ...profile.links.map((l) => ({ label: l.label, href: l.href, icon: <ExternalLink className="size-5" aria-hidden />, note: l.href.replace(/^https?:\/\//, "").replace(/\/$/, "") })),
  ].filter(Boolean) as { label: string; href: string; icon: React.ReactNode; note: string }[];

  return (
    <div className="space-y-6">
      {profile.email && (
        <div className="rounded-2xl border border-coral/25 bg-gradient-to-br from-coral/[0.12] to-blossom/[0.06] p-5">
          <p className="text-sm text-cream/70">The fastest way to reach me is email.</p>
          <p className="mt-1 break-all font-display text-xl font-bold">{profile.email}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={`mailto:${profile.email}?subject=${encodeURIComponent("Hello from your portfolio")}`} className={primaryButton}>
              <Mail className="size-4" aria-hidden /> Send an email
            </a>
            {copyButton}
          </div>
        </div>
      )}
      {profile.showPhone && profile.phone && <p className="text-sm text-cream/70">Phone: {profile.phone}</p>}
      <ul className="grid gap-2 sm:grid-cols-2">
        {links.map((l) => (
          <li key={l.href}>
            <ExtLink
              href={l.href}
              className="flex items-center gap-3 rounded-xl border border-cream/10 bg-cream/[0.04] p-3 transition hover:border-cream/25 hover:bg-cream/[0.08]"
            >
              <span className="text-cream/80">{l.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{l.label}</span>
                {l.note && <span className="block truncate text-xs text-cream/50">{l.note}</span>}
              </span>
            </ExtLink>
          </li>
        ))}
      </ul>
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cream/50">
          <PenLine className="size-3.5" aria-hidden /> Writing
        </h3>
        <ul className="space-y-1.5 text-sm">
          {profile.writing.map((w) => (
            <li key={w.href}>
              <ExtLink href={w.href} className="text-cream/85 underline decoration-cream/25 underline-offset-4 hover:decoration-gold">
                {w.label}
              </ExtLink>
            </li>
          ))}
        </ul>
      </div>
      <ResumeButton className={secondaryButton} />
    </div>
  );
}

// ------------------------------------------------------------------ Secret

export function SecretContent() {
  return (
    <div className="space-y-4 font-mono text-sm">
      <div className="rounded-xl border border-[#3dff8a]/30 bg-[#04170b] p-4 text-[#b9ffd2]">
        <p>$ whoami</p>
        <p className="text-[#7dffb0]">explorer — you left the road and found the terminal.</p>
        <p className="mt-3">$ cat fun-fact.txt</p>
        <p className="text-[#7dffb0]">
          This island is generated from a fixed seed. Every tree, rock and flower lands in the same place on every load, and the
          car drives on the exact heightfield you see — about 66,000 height samples baked once when the page opens.
        </p>
        <p className="mt-3">$ echo $NEXT_STOP</p>
        <p className="text-[#7dffb0]">the lighthouse, if you want to say hi.</p>
      </div>
    </div>
  );
}
