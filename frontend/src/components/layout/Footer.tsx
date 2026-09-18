import Container from "@/components/common/Container";
import { COLORS, TYPOGRAPHY } from "@/constants";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 py-8">
      <Container className={`text-center ${TYPOGRAPHY.small} ${COLORS.text.muted}`}>
        © {new Date().getFullYear()} MedhOrbit

      </Container>
    </footer>
  );
}
