import type { Metadata } from "next";
import { ContentView } from "@/components/portfolio/ContentView";
import { PersonJsonLd } from "@/components/portfolio/PersonJsonLd";
import { profile } from "@/data/profile";

export const metadata: Metadata = {
  title: "Portfolio",
  description: `${profile.name} — ${profile.headline}. Projects, experience, skills and contact details.`,
};

export default function PortfolioPage() {
  return (
    <>
      <PersonJsonLd />
      <ContentView />
    </>
  );
}
