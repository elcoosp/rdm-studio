import { makeDocsCollections } from '@elcoosp/docs-toolkit/collections';

// The docs collection (Starlight docsSchema extended with `status`/`since`),
// auto-sidebar, keep-a-changelog, and the toolkit-extended i18n collection.
// The default changelog path is `../CHANGELOG.md` (a single-app tree); this
// monorepo keeps the Keep-a-Changelog file at the repo root, two levels up.
export const collections = makeDocsCollections({
  changelogPath: '../../CHANGELOG.md',
});
