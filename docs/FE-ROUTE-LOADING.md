# Fast-track route loading

Integration-only follow-up to CORE-052 checkpoint e098202333ffb4918e193b474a7482e98a938eb5. Maps to CORE-008 route integration and CORE-002 load-performance integration under Leader's fast-track directive; ownership, tracker status, feature source and business rules are unchanged.

DeferredPages wraps the existing Program, Evaluation/Performance, Groom, Rider and Medical pages in a shared Design System loading state. Lazy boundaries sit inside the existing auth/role guards and Medical/Core046 providers. IncidentRoutes uses the same deferred exports so eager imports do not pull the entire medical feature into login. No dependencies, tokens, sample mode, API semantics or feature implementation were replaced.

Final author checks: focused128/128 and full462/462, then lint/typecheck/build/diff passed sequentially with one test worker. An earlier full run461/462 had a5000ms CORE-022 reset-test timeout; targeted reproduction1/1 and the subsequent full suite passed without code/test/timeout changes. Preserve all three logs under workspace `.preview-local/official-fe-audit/fasttrack-*`; this is not an Independent Gate result.

Build: entry312.08kB (Vite gzip93.30kB), versus622.43kB before this batch. AST traversal of static imports finds480,404 initial JS bytes across entry, routePaths and authApi; dynamic feature chunks are additional when navigated to. Thus312kB is not the total initial download. No chunk exceeds500kB and no warning threshold was changed. CSS/fonts and browser caching/network timing are separate from this measurement.

Fresh browser sample smoke loaded Program wizard, Groom precheck/tasks, Rider, Vet Medical, Trainer Evaluation/Performance, Owner workspace and CM Dashboard/Audit with no captured warning/error entries. No real BE/SQL/E2E claim. Screenshots: fasttrack-dashboard-1440.png and fasttrack-audit-1440.png. Normal auth and explicit sample harness remain separate configurations of this same app.

CORE-052 Gate and F5 formal path exception remain pending. CORE-025/041 still need a published exact owner handoff; do not replace them. Required missing three-flow UI remains listed in FE-COVERAGE-MATRIX.md.

Final desktop QA found a15px scrollbar-width overflow in the sample harness at actual1280px. The shared shell now releases its minimum width only at desktop viewports >=1280px, fitting its containing block rather than forcing the scrollbar-inclusive viewport width. Smaller viewports retain the existing desktop minimum; no mobile design is introduced. After the fix, Audit document/client widths both1265 and main scroll/client widths both1010 at innerWidth1280; Dashboard also fits1280. Actual1440 verification fits as well. Earlier viewport captures are superseded by fasttrack-*-fixed.png and the final desktop check logs; a browser-scoped viewport override had targeted a different active tab in an earlier capture.
