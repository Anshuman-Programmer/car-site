import Link from "next/link";
import { profile } from "@/data/profile";
import { AboutContent, AllProjects, ContactContent, ExperienceTimeline, ResumeButton, SkillsContent, secondaryButton, yearsLabel } from "./content";

const sections = [
  { id: "about", label: "About" },
  { id: "projects", label: "Projects" },
  { id: "experience", label: "Experience" },
  { id: "skills", label: "Skills" },
  { id: "contact", label: "Contact" },
];

/**
 * The full portfolio as ordinary semantic HTML. Rendered on the server at
 * /portfolio, and reused as the fallback when WebGL isn't available.
 */
export function ContentView({ notice, showDriveLink = true }: { notice?: React.ReactNode; showDriveLink?: boolean }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#3a2a4d_0%,#17111f_55%)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-gold focus:px-3 focus:py-2 focus:text-ink">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-cream/10 bg-ink/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <a href="#about" className="font-display text-lg font-bold">
            {profile.name}
          </a>
          <nav aria-label="Sections" className="hidden sm:block">
            <ul className="flex gap-1 text-sm">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="rounded-lg px-3 py-1.5 text-cream/75 hover:bg-cream/10 hover:text-cream">
                    {s.label}
                  </a>
                </li>
              ))}
              <li>
                <a href={profile.resumePath} download="Anshuman-Talukdar-resume.pdf" className="rounded-lg px-3 py-1.5 font-semibold text-gold hover:bg-gold/10">
                  Résumé
                </a>
              </li>
            </ul>
          </nav>
          {showDriveLink && (
            <Link href="/" className="rounded-lg border border-cream/15 px-3 py-1.5 text-sm font-semibold hover:bg-cream/10">
              Drive the island →
            </Link>
          )}
        </div>
      </header>

      <main id="main" className="mx-auto max-w-5xl space-y-20 px-4 pb-24 pt-12">
        {notice}
        <section id="about" aria-labelledby="about-h" className="scroll-mt-24">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Portfolio</p>
          <h1 id="about-h" className="mt-2 font-display text-5xl font-extrabold tracking-tight sm:text-6xl">
            {profile.name}
          </h1>
          <p className="mt-3 text-xl font-semibold text-cream/85">
            {profile.headline} · {yearsLabel}
          </p>
          <div className="mt-8 max-w-3xl">
            <AboutContent />
          </div>
        </section>

        <section id="projects" aria-labelledby="projects-h" className="scroll-mt-24">
          <h2 id="projects-h" className="mb-6 font-display text-3xl font-bold">
            Projects &amp; highlights
          </h2>
          <AllProjects />
        </section>

        <section id="experience" aria-labelledby="exp-h" className="scroll-mt-24">
          <h2 id="exp-h" className="mb-6 font-display text-3xl font-bold">
            Experience
          </h2>
          <div className="max-w-3xl">
            <ExperienceTimeline />
          </div>
        </section>

        <section id="skills" aria-labelledby="skills-h" className="scroll-mt-24">
          <h2 id="skills-h" className="mb-6 font-display text-3xl font-bold">
            Skills
          </h2>
          <SkillsContent />
        </section>

        <section id="contact" aria-labelledby="contact-h" className="scroll-mt-24">
          <h2 id="contact-h" className="mb-6 font-display text-3xl font-bold">
            Contact
          </h2>
          <div className="max-w-2xl">
            <ContactContent />
          </div>
        </section>
      </main>
      <footer className="border-t border-cream/10 py-8 text-center text-sm text-cream/55">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <ResumeButton className={secondaryButton} />
          {showDriveLink && (
            <Link href="/" className={secondaryButton}>
              Back to the island
            </Link>
          )}
        </div>
      </footer>
    </div>
  );
}
