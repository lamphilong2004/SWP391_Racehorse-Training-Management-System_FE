import { Link } from 'react-router';
import { Icon, type IconName } from '../design-system';
import { ROUTES } from '../app/routePaths';
import styles from './LandingPage.module.css';

/**
 * SCR-PUB-001 Landing Page (Figma LP-01 400:6). Public overview only: no business data is read and every account
 * comes from the Club Manager (DEC-008). Tiles for deferred modules are labelled "Planned" so nothing implies they
 * are implemented. Figma photography is replaced by design-system surfaces.
 */
const PLATFORM: { icon: IconName; title: string; text: string }[] = [
  { icon: 'horseshoe', title: 'One record per horse', text: 'Profile, pedigree, ownership, stable box, weight, training and health history in one place.' },
  { icon: 'users', title: 'Seven role workspaces', text: 'Club Manager, Head Trainer, Trainer, Work Rider, Veterinarian, Groom and Horse Owner — access assigned by the club.' },
  { icon: 'shield-check', title: 'Traceable by design', text: 'Important actions are audit-logged. Medical and training history is kept, never silently removed.' },
];
const SHOWCASE = [
  { title: 'Horse Management', text: 'Profile, pedigree and history, ownership and stable box for every horse.' },
  { title: 'Training Management', text: 'Programs built from templates, sessions within the approved phase, live monitoring.' },
  { title: 'Medical Management', text: 'Records, 3D injury location, and Training Availability set by the Veterinarian.' },
];
const PIPELINE = ['Program template', 'Horse training program', 'Training session', 'Live monitoring', 'Evaluation'];
const TILES: { icon: IconName; title: string; text: string; planned?: boolean }[] = [
  { icon: 'clipboard-list', title: 'Daily care & nutrition', text: 'Care plans, rations and the Groom’s daily tasks.', planned: true },
  { icon: 'calendar', title: 'Preventive healthcare', text: 'Vaccination, deworming, farrier and re-examination due dates.', planned: true },
  { icon: 'bell', title: 'Realtime alerts', text: 'Threshold alerts and notifications.' },
  { icon: 'bar-chart', title: 'Dashboards & reports', text: 'Role dashboards and management reports.', planned: true },
  { icon: 'lock', title: 'Access & audit', text: 'Seven roles and an audit log.' },
];
const ROLES: { icon: IconName; role: string; step: string; text: string }[] = [
  { icon: 'stethoscope', role: 'Veterinarian', step: 'Step 1', text: 'Examines the horse and sets Training Availability — the gate every session checks.' },
  { icon: 'target', role: 'Head Trainer', step: 'Step 2', text: 'Builds the horse’s program from a template and assigns the Trainer.' },
  { icon: 'activity', role: 'Trainer', step: 'Step 3', text: 'Schedules sessions inside the approved phase and monitors them live.' },
  { icon: 'play', role: 'Work Rider', step: 'Step 4', text: 'Rides the session, reports issues and gives feedback for the Trainer’s review.' },
];

function Logo() {
  return <span className={styles.logo}><span className={styles.logomark}><Icon name="horseshoe" size={18} /></span>
    <span><strong>Racehorse Ops</strong><small>Racehorse Training &amp; Management System</small></span></span>;
}

export function LandingPage() {
  return <div className={styles.page}>
    <header className={styles.nav}>
      <Logo />
      <nav aria-label="Landing sections" className={styles.navLinks}>
        <a href="#platform">Platform</a><a href="#showcase">Showcase</a><a href="#capabilities">Capabilities</a><a href="#workflow">Workflow</a>
      </nav>
      <Link className={styles.loginButton} to={ROUTES.login}>Login</Link>
    </header>

    <main>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span aria-hidden="true" />RACEHORSE TRAINING &amp; MANAGEMENT SYSTEM</p>
          <h1 className="text-landing-display-xl">Precision in <em>Every Stride.</em></h1>
          <p className={styles.lead}>An integrated platform for racehorse management, intelligent training coordination, and veterinary care.</p>
          <div className={styles.ctas}><Link className={styles.primary} to={ROUTES.login}>Access the Platform →</Link><a className={styles.secondary} href="#platform">Explore the System</a></div>
          <p className={styles.facts}><span>7 role-based workspaces</span><span>Horse · Training · Medical</span><span>Live session monitoring</span></p>
        </div>
        <div className={styles.heroCards} aria-label="Product illustration">
          <div className={styles.glass}>
            <div className={styles.glassHead}><span>LIVE SESSION</span><span className={styles.pillLive}>IN PROGRESS</span></div>
            <strong>Thunder Bolt · Gallop Session</strong>
            <div className={styles.glassMetrics}><span><b>152</b> bpm<small>Heart rate</small></span><span><b>36</b> km/h<small>Speed</small></span></div>
            <small className={styles.muted}>Illustration · simulated demo values</small>
          </div>
          <div className={styles.glass}>
            <div className={styles.glassHead}><span>TRAINING AVAILABILITY</span><span className={styles.pillLimited}>LIMITED</span></div>
            <strong>Storm · ST-014</strong>
            <small className={styles.muted}>Walk and trot permitted · sprint work blocked by the Veterinarian.</small>
          </div>
        </div>
      </section>

      <section id="platform" className={styles.section}>
        <div className={styles.split}><div><p className={styles.overline}>THE PLATFORM</p><h2 className="text-landing-display-l">Training, health and daily care — finally in one connected record.</h2></div>
          <p className={styles.lead}>Every horse has one record that the Head Trainer, Trainer, Work Rider, Veterinarian and stable team work from. Each role sees what it needs, and every important decision stays traceable.</p></div>
        <div className={styles.grid3}>{PLATFORM.map((item) => <article key={item.title} className={styles.feature}><span className={styles.iconChip}><Icon name={item.icon} size={20} /></span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      </section>

      <section id="showcase" className={styles.section}>
        <p className={styles.overline}>PRODUCT SHOWCASE</p><h2 className="text-landing-display-l">Built for the people who run the stable.</h2>
        <div className={styles.grid3}>{SHOWCASE.map((item) => <article key={item.title} className={styles.card}><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      </section>

      <section id="capabilities" className={styles.section}>
        <div className={styles.split}><div><p className={styles.overline}>CORE CAPABILITIES</p><h2 className="text-landing-display-l">Every module, connected through the same horse.</h2></div>
          <p className={styles.lead}>From the first veterinary baseline to the last training session, every module reads and writes the same horse record.</p></div>
        <div className={styles.bento}>
          <article className={styles.card}><p className={styles.overline}>TRAINING</p><h3>From template to evaluation</h3><p>The Head Trainer builds a horse program from a template; Trainers schedule sessions inside the approved phase and review every result.</p>
            <ol className={styles.pipeline}>{PIPELINE.map((step) => <li key={step}>{step}</li>)}</ol></article>
          <article className={styles.card}><p className={styles.overline}>MEDICAL</p><h3>The Veterinarian decides what training is safe</h3><p>Medical records, examinations and injury tracking with a 3D injury location. Training Availability is set only by the Veterinarian — and every session checks it.</p>
            <p className={styles.states}><span>AVAILABLE</span><span>LIMITED</span><span>LOCKED</span></p></article>
        </div>
        <div className={styles.grid5}>{TILES.map((tile) => <article key={tile.title} className={styles.tile}><span className={styles.iconChip}><Icon name={tile.icon} size={20} /></span><h3>{tile.title}</h3><p>{tile.text}</p>{tile.planned && <span className={styles.planned}>Planned</span>}</article>)}</div>
      </section>

      <section id="workflow" className={styles.section}>
        <div className={styles.split}><div><p className={styles.overline}>COORDINATION</p><h2 className="text-landing-display-l">Four roles. One session. No hand-offs lost.</h2></div>
          <p className={styles.lead}>Each role works in its own workspace, but every action lands on the same horse record — so the next person always starts from the latest, approved state.</p></div>
        <div className={styles.grid4}>{ROLES.map((item) => <article key={item.role} className={styles.card}><span className={styles.iconChip}><Icon name={item.icon} size={20} /></span><h3>{item.role}</h3><small className={styles.muted}>{item.step}</small><p>{item.text}</p></article>)}</div>
        <p className={styles.muted}>Feedback returns to the Trainer’s review; any medical concern goes back to the Veterinarian.</p>
        <p className={styles.muted}>Also in the platform: Club Manager · Groom / Stable Hand · Horse Owner (read-only, own horses)</p>
      </section>

      <section className={styles.section}>
        <div className={styles.cta}><h2 className="text-landing-display-m">Ready for today’s session?</h2><p>Sign in with the account issued by your club. Racehorse Ops has no public sign-up.</p><Link className={styles.primary} to={ROUTES.login}>Access the Platform →</Link></div>
      </section>
    </main>

    <footer className={styles.footer}>
      <div><Logo /><p className={styles.muted}>A web platform for racehorse management, training coordination and veterinary care.</p></div>
      <nav aria-label="Footer"><strong>Platform</strong><a href="#platform">Platform</a><a href="#showcase">Showcase</a><a href="#capabilities">Capabilities</a><a href="#workflow">Workflow</a></nav>
      <nav aria-label="Access"><strong>Access</strong><Link to={ROUTES.login}>Login</Link></nav>
      <p className={styles.copyright}>© 2026 Racehorse Ops · SWP391 project · Web application</p>
    </footer>
  </div>;
}
