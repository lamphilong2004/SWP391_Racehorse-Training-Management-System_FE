# Public landing: equestrian identity

Landing-only improvement requested by Long on 2026-11-02. Reuses the existing public route, shared typography, navy/emerald tokens and icon system. No workspace styles, login/RBAC code, Backend or SQL changed. Existing WIP is preserved; no commit, push, merge or deployment performed.

## Design and content

- Full-width editorial hero: bay horse at a stable doorway, readable navy overlay, emerald headline and primary login action. Navigation anchors and real `/login` destinations retained.
- Three core module cards, seven role descriptions, shared training/medical context and a second crop of the same horse photograph in the final access section.
- Removed fake horse identities and simulated live pulse/speed cards from the public page. At Long's request the visible illustration caption is removed; image provenance stays documented here and imagery is not a business record.
- Follow-up palette correction: navy header/hero/footer, one sage-tinted content background, white cards and emerald accents throughout. Removed blue/violet module decorations and the mismatched monochrome CTA portrait. Semantic availability badges keep their safety colors. Changes remain scoped to the public page.
- Approved follow-up: content background `#F2F6F3`, a restrained sage fade at the top of the section immediately below the horse image, green-gray borders and white feature cards with subtle elevation. Navy titles and emerald accents remain consistent throughout; text contrast and the photograph are preserved. CSS only; no new animation or runtime behavior.
- Daily care no longer described as deferred, consistent with approved Flow 4. Preventive care/reports remain labelled planned. Removed unsupported 3D-only wording; no new business functionality promised.
- Explicit focus, wrapping layouts, reduced-motion behavior, eager high-priority hero and lazy lower image. No remote image dependency, business API fetch, sample store or new package.

## Images

`public/assets/landing-horse.webp`: generated fictional editorial asset using built-in image_gen (not CLI), 1536×1024, 150,786 bytes. PNG converted to WebP quality84 without visual retouching; optimized asset lives in the repository, not only the generator cache. No famous horse identity or ownership claim. Both landing images reuse this file; the existing login image is untouched.

Final generation prompt:

> Use case: photorealistic-natural. Create one premium editorial photograph asset for the Racehorse equestrian management website landing page, not a UI mockup. A healthy elegant bay thoroughbred horse with black mane standing in a clean timber stable doorway, green paddock softly visible in background, natural morning light, warm realistic chestnut coat, tasteful dark navy shadows and emerald surroundings. Wide landscape composition 3:2. Horse head, ears and upper body clearly visible in center-right with generous breathing room; anatomy correct, calm animal, no jockey, no race crowd. Professional equestrian photography with refined natural textures and depth, not stylized illustration. No lettering, no logos, no watermark, no fabricated UI or metrics. This is decorative fictional imagery, no famous horse identity. Save usable local output for the web project.

## Verification

- Landing/router tests: 7/7 PASS. Local image/alt/priority, four actual login links, all anchors, all seven roles, no fake metric cards, production route and return-to-landing.
- TypeScript, ESLint, Vite production build, production bundle guard and diff checks PASS. An unsupported Testing Library `exact` option in the new test was corrected before final typecheck PASS; no assertion weakened.
- Temporary real browser: 1440×900, 1280×800, 1024×768, 390×844; image decode, no document overflow, no page errors/failed HTTP, working anchor and `/login` navigation. No business requests or login needed. Lazy image checked after scrolling into view; browser closed after checks.
- Evidence/screenshots local in `.preview-local/racehorse-training/landing-*`. One existing FE preview 5214 retained; BE/SQL untouched. No full suite or business-flow replay for presentation-only changes.
