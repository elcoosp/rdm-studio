/**
 * `/en` — English mirror of the French landing page (`/`).
 * The locale is activated by `RootLayout` from the route props; the page
 * component itself is shared with the FR route and renders its strings
 * through the Lingui catalog (Phase 2).
 */
import LandingPage from "../index/page";

export default function EnLandingPage(): React.ReactElement {
  return <LandingPage />;
}
