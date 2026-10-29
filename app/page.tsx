import { PortfolioShell } from "@/components/portfolio/PortfolioShell";
import { PersonJsonLd } from "@/components/portfolio/PersonJsonLd";

export default function Home() {
  return (
    <>
      <PersonJsonLd />
      <PortfolioShell />
    </>
  );
}
