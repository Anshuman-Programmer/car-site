import { profile } from "@/data/profile";
import { experience } from "@/data/experience";

/** schema.org Person, built only from fields present in the profile data. */
export function PersonJsonLd() {
  const sameAs = [profile.github, profile.linkedin, ...profile.links.map((l) => l.href)].filter(Boolean);
  const data = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    jobTitle: experience[0].role,
    email: profile.email ? `mailto:${profile.email}` : undefined,
    url: profile.website ?? undefined,
    sameAs,
    alumniOf: profile.education.map((e) => ({ "@type": "CollegeOrUniversity", name: e.school })),
    knowsLanguage: profile.languages,
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
