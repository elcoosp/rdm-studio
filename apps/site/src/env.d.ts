/// <reference types="vite/client" />

// Side-effect stylesheet imports (the bundler hashes them and injects the
// <link> into every page's head — nothing to import).
declare module "*.css";
