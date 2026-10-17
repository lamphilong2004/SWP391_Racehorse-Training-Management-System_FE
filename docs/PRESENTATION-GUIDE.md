# Presentation guide — official website, UI-first stage

Branch `feat/dev-ui-harness`. This is the product website (React screens of the official FE), run in a local
**presentation mode**. It is not a separate demo application.

What to say when presenting:
- The screens and interactions are real React product code following the approved Figma.
- The data is **illustrative**: it lives in the browser through the Sample Adapter, which follows the approved API contracts.
- The backend / SQL Server are **not yet fully integrated**. Real authentication (CORE-007) and business APIs are wired later by replacing the adapter. No screen is rewritten.

## 1. Start (after a reboot)

```bash
cd "D:\FPT\Kì_9\SWP391\Racehorse Training & Management System\ui-demo"
npm run dev:present
```

Open **http://localhost:5190/login**. Presentation mode shows no developer toolbar and no technical banners.
Developers use `npm run dev:harness` (http://localhost:5192), which adds the yellow DEV HARNESS bar. Neither mode exists in a production build.

## 2. Local presentation accounts (one per approved role)

These are fictitious local identities used only by the development presentation mode. They are not SQL accounts, no JWT is issued, and no backend request is made. **No password is stored anywhere: type any non-empty password** (for example `present`).

| Role | Email | Display name |
|---|---|---|
| Club Manager | `club.manager@racehorse.test` | Hoang Minh Tuan |
| Head Trainer | `head.trainer@racehorse.test` | Vo Thanh Son |
| Trainer | `trainer@racehorse.test` | Nguyen Minh Khoa |
| Work Rider | `work.rider@racehorse.test` | Pham Quang Huy |
| Veterinarian | `veterinarian@racehorse.test` | Dr. Nguyen Thu Ha |
| Groom / Stable Hand | `groom@racehorse.test` | Bui Van Hai |
| Horse Owner | `horse.owner@racehorse.test` | Tran Quoc Bao (Owner portal is deferred, DEC-007) |

Switch role like a normal user: header avatar → **Account** → **Sign out**, then sign in with another account. The illustrative data is kept across sign-out and sign-in.

## 3. Reset the illustrative data before a session

Open **http://localhost:5190/presenter-tools** (local only, not in any menu, not in production) and click **Reset illustrative data and sign out**. Only this browser's illustrative data is restored. Use the same browser profile for the whole presentation.

## 4. Click script (fresh reset)

**Flow 1 — Horse Management**
1. Sign in as Club Manager → Dashboard → **Register Horse**.
2. Enter name `Silver Arrow`, ID `RH-021`, date of birth, sex, breed → **Save Draft & Continue**.
3. Enter sire `Galileo Star` and dam `Moonlight Bay`. Choose owner *Tran Quoc Bao*, share 100 %, effective date.
4. **Assign Stable Box** → `B-07` → **Assign Box** → **Save & Continue**.
5. Pending Activation shows identity, pedigree/owner and box complete. The Veterinarian baseline is still pending.
6. Activation is automatic once the baseline exists, with no approve button (DEC-009 §1). The Vet baseline screen is CORE-015, not built yet.

**Flow 2 — Training Management**
1. Sign in as Head Trainer → **Create program** → Thunder Bolt → recommended *Endurance foundation*.
2. Set the program dates and the phase dates → intensity LOW–MEDIUM → Trainer *Nguyen Minh Khoa* → **Create and activate program**.
3. Sign in as Groom → **Today**:
   - First session → all five **Normal** → **Complete Pre-Session Check**.
   - Second session → *Legs & hooves* **Abnormal** → **Report Incident** (records the check) → **Report Incident** → *Hoof or leg problem*, *Medium*, description → **Submit Incident**. The session stays SCHEDULED and blocked.
4. Sign in as Work Rider → **My Rides**:
   - SES-0044 **View Assignment** → **Ready to Start** → tick the six confirmations → **Start Session**.
   - **Add sample** (HR 158, speed 28.5, distance 400) → **Finish Session** → feedback → **Submit Feedback**.
   - Optional interrupted case: open the IN PROGRESS ride (SES-0047) → **Report Issue** → *SESSION INTERRUPTED — NOT COMPLETED*.
5. Sign in as Trainer → Dashboard → **Completed result & history** → **Performance History** → **SES-0044**:
   - Result / Planned vs Actual show the rider's sample and feedback.
   - **Evaluation & Recommendation** → *Met target* + notes → **Save Evaluation**.

**Flow 3 — Medical Management**
1. Sign in as Veterinarian → **Incidents** → the incident from the Groom check → **Open medical case**.
2. In the case:
   - **Examination**: findings, diagnosis, severity *Mild*, health *Injured*.
   - **Injury**: *Left Forelimb*, *Mild*, *Not recovered*.
3. **Open treatment plan editor** → instructions → **Add Groom task** (Groom 16, instruction, date, slot) → re-exam date → **Save treatment plan**.
4. Sign in as Groom → **Treatment Tasks** → **Mark complete** on the new task.
5. Sign in as Veterinarian:
   - Case → **Re-examination** *Recovered*, health *Fit* → save.
   - **Incidents** → **Resolve incident**.
   - Case → **Close case** → **Confirm close**.

## 5. Not built yet (say so; do not present as finished)

| Area | CORE / owner |
|---|---|
| Vet baseline examination (completes automatic activation) | CORE-015 · Hoàng |
| Horse history/timeline, Head Trainer readiness review | CORE-017 · Đức |
| Horse Training Programs list, program detail/progress, template library | CORE-022 list / CORE-041 · Hoàng |
| Trainer dashboard, session scheduling, session detail | CORE-025 · Hoàng |
| Trainer calendar, exercise library | CORE-044 · Hoàng |
| Trainer live monitoring (pause/resume/stop, alerts); realtime is REST refresh today, not WebSocket | CORE-031 · Hoàng (needs BE CORE-030) |
| Medical restrictions editor and read-only status | CORE-020 · Hoàng |
| Per-role landing redirect and 403 page | CORE-008 follow-up · Hoàng (to confirm) |
| Real login, real business APIs, SQL Server | BE CORE-007 and following tasks, FE CORE-009 integration |

Server-computed aggregates (distance, duration, peak heart rate) show "Not measured" on illustrative data, because the adapter does not invent them.
