import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  AlertBanner,
  Breadcrumb,
  Button,
  CandidateCard,
  Card,
  ChartContainer,
  Checkbox,
  DataTable,
  Drawer,
  EmptyState,
  ErrorState,
  HorseCard,
  Icon,
  ICON_NAMES,
  KeyValue,
  LoadingState,
  MetricCard,
  Modal,
  NotificationItem,
  PhotoAttachmentTile,
  SelectField,
  StableBoxTile,
  StatusBadge,
  STATUS_REGISTRY,
  Tabs,
  TextField,
  ValidationNotice,
  WizardStepper,
  type StatusFamily,
} from '../../design-system';
import { devShellPath } from '../../app/routePaths';
import { ROLE_CODES, ROLE_LABELS } from '../../shared/auth/roles';
import styles from './ComponentsPage.module.css';

const COLOR_TOKENS = [
  'bg-page',
  'bg-surface',
  'bg-subtle',
  'border-default',
  'border-strong',
  'text-primary',
  'text-secondary',
  'text-disabled',
  'primary-600',
  'primary-700',
  'primary-50',
  'success-600',
  'success-50',
  'warning-600',
  'warning-50',
  'danger-600',
  'danger-50',
  'info-600',
  'neutral-600',
  'neutral-50',
];

const TEXT_STYLES = [
  ['text-display', 'Display', '32 / 40 · Semi Bold'],
  ['text-h1', 'H1', '24 / 32 · Semi Bold'],
  ['text-h2', 'H2', '20 / 28 · Semi Bold'],
  ['text-h3', 'H3', '16 / 24 · Semi Bold'],
  ['text-body-l', 'Body L', '16 / 24 · Regular'],
  ['text-body', 'Body', '14 / 20 · Regular'],
  ['text-body-strong', 'Body Strong', '14 / 20 · Medium'],
  ['text-caption', 'Caption', '12 / 16 · Regular'],
  ['text-overline', 'Overline', '11 / 16 · Semi Bold · 8%'],
  ['text-metric', 'Metric', '28 / 36 · Semi Bold'],
  ['text-metric-l', 'Metric L', '40 / 48 · Semi Bold'],
] as const;

const LANDING_STYLES = [
  ['text-landing-display-xl', 'Landing / Display XL', 'Instrument Serif 112 / 104 · −2%'],
  ['text-landing-display-l', 'Landing / Display L', 'Instrument Serif 56 / 60 · −1%'],
  ['text-landing-display-m', 'Landing / Display M', 'Instrument Serif 40 / 46 · −0.5%'],
] as const;

/** Values that reproduce the series drawn in Figma 73:229 on the 110–190 axis. */
const HEART_RATE = [124.5, 128.2, 135.5, 139.1, 146.4, 144.5, 153.6, 159.1, 164.5, 170, 177.3, 179.1];

const SPACING = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'];
const RADII = ['sm', 'md', 'lg', 'full'];
const ELEVATIONS = ['1', '2', '3', 'focus'];

interface SessionRow {
  id: string;
  time: string;
  horse: string;
  code: string;
  exercise: string;
  rider: string;
}

const SESSION_ROWS: SessionRow[] = [
  { id: 's1', time: '07:00', horse: 'Thunder Bolt', code: 'TB-001', exercise: 'Interval Training', rider: 'Nguyen Van An' },
  { id: 's2', time: '07:00', horse: 'Thunder Bolt', code: 'TB-001', exercise: 'Interval Training', rider: 'Nguyen Van An' },
  { id: 's3', time: '07:00', horse: 'Thunder Bolt', code: 'TB-001', exercise: 'Interval Training', rider: 'Nguyen Van An' },
];

function Section({ id, title, figma, children }: { id: string; title: string; figma: string; children: ReactNode }) {
  return (
    <section id={id} className={styles.section}>
      <header className={styles.sectionHeader}>
        <h2 className="text-h2">{title}</h2>
        <p className={styles.figmaRef}>Figma {figma}</p>
      </header>
      {children}
    </section>
  );
}

/** Reference page for the shared Design System. Used for visual review against Figma, not a product screen. */
export function ComponentsPage() {
  const [tab, setTab] = useState('overview');
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<string | undefined>('s3');
  const [selectedBox, setSelectedBox] = useState('A-14');
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className="text-overline">SWP391 · CORE-002</p>
        <h1 className="text-display">Racehorse Ops Design System</h1>
        <p className={styles.lead}>
          Shared tokens, components and the desktop app shell, built from the Figma file “Racehorse Training &
          Management System” page 01 - Design System. Feature screens must reuse these.
        </p>
      </header>

      <Section id="colours" title="Semantic colours" figma="4:196">
        <div className={styles.swatches}>
          {COLOR_TOKENS.map((token) => (
            <div key={token} className={styles.swatch}>
              <div className={styles.swatchColor} style={{ background: `var(--color-${token})` }} />
              <span className="text-body-strong">color/{token.replace(/-(?=\d|[a-z]+$)/, '/')}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="typography" title="Typography" figma="4:3">
        <div className={styles.stack}>
          {TEXT_STYLES.map(([className, name, spec]) => (
            <div key={name} className={styles.typeRow}>
              <span className={styles.typeName}>{name}</span>
              <span className={styles.typeSpec}>{spec}</span>
              <span className={className}>Thunder Bolt · 142 bpm</span>
            </div>
          ))}
        </div>
        <p className={styles.figmaRef}>Landing styles — page 00 LP-01 400:6 / LP-02 400:7 (landing & login only)</p>
        <div className={styles.stack}>
          {LANDING_STYLES.map(([className, name, spec]) => (
            <div key={name} className={styles.typeRow}>
              <span className={styles.typeName}>{name}</span>
              <span className={styles.typeSpec}>{spec}</span>
              <span className={className}>Racehorse Ops</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="spacing" title="Spacing, radius & elevation" figma="4:73 · 4:117 · 4:138">
        <div className={styles.stack}>
          {SPACING.map((space) => (
            <div key={space} className={styles.spaceRow}>
              <span className={styles.typeName}>space/{space}</span>
              <span className={styles.spaceBar} style={{ width: `var(--space-${space})` }} />
            </div>
          ))}
        </div>
        <div className={styles.row}>
          {RADII.map((radius) => (
            <div key={radius} className={styles.radiusBox} style={{ borderRadius: `var(--radius-${radius})` }}>
              radius/{radius}
            </div>
          ))}
        </div>
        <div className={styles.row}>
          {ELEVATIONS.map((elevation) => (
            <div key={elevation} className={styles.elevationBox} style={{ boxShadow: `var(--elev-${elevation})` }}>
              elev/{elevation}
            </div>
          ))}
        </div>
      </Section>

      <Section id="icons" title="Icons" figma="69:6">
        <div className={styles.icons}>
          {ICON_NAMES.map((name) => (
            <span key={name} className={styles.iconCell} title={name}>
              <Icon name={name} />
              <span className={styles.iconName}>{name}</span>
            </span>
          ))}
        </div>
      </Section>

      <Section id="buttons" title="Button" figma="6:28">
        {(['primary', 'secondary', 'tertiary', 'destructive'] as const).map((variant) => (
          <div key={variant} className={styles.row}>
            <Button variant={variant}>Button</Button>
            <Button variant={variant} disabled>
              Button
            </Button>
            <Button variant={variant} size="sm">
              Small
            </Button>
            <Button variant={variant} size="lg">
              Large
            </Button>
          </div>
        ))}
      </Section>

      <Section id="fields" title="Input & Select" figma="7:22 · 7:47">
        <div className={styles.fields}>
          <TextField label="Registration code" placeholder="e.g. VN-2021-0042" helperText="Helper text" />
          <TextField
            label="Registration code"
            defaultValue="VN-2021-0042"
            error="A horse with this registration code already exists."
          />
          <TextField label="Registration code" placeholder="e.g. VN-2021-0042" helperText="Helper text" disabled />
          <SelectField
            label="Role"
            placeholder="Select role"
            helperText="Helper text"
            defaultValue=""
            options={ROLE_CODES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
          />
          <SelectField
            label="Role"
            placeholder="Select role"
            defaultValue=""
            error="Select a role."
            options={ROLE_CODES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
          />
          <SelectField label="Role" placeholder="Select role" defaultValue="" helperText="Helper text" disabled options={[]} />
        </div>
      </Section>

      <Section id="badges" title="Status badges" figma="69:151 · 69:170 · 69:203 · 69:221 · 77:294 · 238:9597–9700">
        <div className={styles.stack}>
          {(Object.keys(STATUS_REGISTRY) as StatusFamily[]).map((family) => (
            <div key={family} className={styles.badgeRow}>
              <span className={styles.typeName}>{family}</span>
              <div className={styles.row}>
                {Object.keys(STATUS_REGISTRY[family]).map((status) => (
                  <StatusBadge key={status} family={family} status={status as never} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="alerts" title="Alert / Banner" figma="70:26">
        <div className={styles.narrow}>
          <AlertBanner type="info" title="Heads up">
            This program was updated by the Head Trainer on 2026-09-22.
          </AlertBanner>
          <AlertBanner type="success" title="Session scheduled">
            The assigned Work Rider has been notified.
          </AlertBanner>
          <AlertBanner type="warning" title="Heart rate approaching threshold">
            Heart rate 172 bpm — threshold 180 bpm. Continue or reduce intensity.
          </AlertBanner>
          <AlertBanner type="danger" title="CRITICAL — Heart rate 186 > 180 threshold">
            Acknowledgement required. Choose an operational response.
          </AlertBanner>
          <AlertBanner type="simulated" title="SIMULATED DEMO DATA">
            This session is generated by the simulator and is not real training data.
          </AlertBanner>
        </div>
      </Section>

      <Section id="cards" title="Card, Metric Card & Key-Value" figma="71:51 · 71:60 · 71:102">
        <div className={styles.row}>
          <Card title="Card title" action={<a href="#cards">View all</a>} className={styles.card}>
            <p className={styles.secondaryText}>Card content goes here.</p>
          </Card>
          <Card className={styles.card}>
            <div className={styles.row}>
              <KeyValue label="Objective" value="Build aerobic base" />
              <KeyValue label="Trainer" value="Nguyen Minh Khoa" />
            </div>
          </Card>
        </div>
        <div className={styles.metrics}>
          <MetricCard label="Sessions today" value="12" caption="+2 vs yesterday" captionIcon="trending-up" captionTone="success" />
          <MetricCard label="Heart rate" value="142 bpm" caption="Normal — threshold 180 bpm" realtimeState="normal" />
          <MetricCard label="Heart rate" value="172 bpm" caption="Warning — near 180 bpm threshold" realtimeState="warning" />
          <MetricCard label="Heart rate" value="186 bpm" caption="Critical — above 180 bpm threshold" realtimeState="critical" />
        </div>
      </Section>

      <Section id="navigation" title="Tabs, Breadcrumb & Wizard Stepper" figma="71:108 · 71:123 · 73:63">
        <Tabs
          label="Program sections"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'overview', label: 'Overview' },
            { value: 'progress', label: 'Progress' },
            { value: 'history', label: 'History' },
          ]}
        />
        <Breadcrumb items={[{ label: 'Training', to: '#' }, { label: 'Programs', to: '#' }, { label: 'Thunder Bolt' }]} />
        <WizardStepper
          currentStep={2}
          steps={['Horse', 'Profile', 'Goal & Target', 'Phases', 'Workload', 'Trainer', 'Review']}
          onStepClick={() => undefined}
        />
      </Section>

      <Section id="table" title="Table & Empty state" figma="73:117 · 329:6273">
        <DataTable<SessionRow>
          caption="Today's sessions"
          rows={SESSION_ROWS}
          rowKey={(row) => row.id}
          selectedKey={selectedRow}
          onRowClick={(row) => setSelectedRow(row.id)}
          columns={[
            { key: 'time', header: 'Time', width: 120, render: (row) => row.time },
            {
              key: 'horse',
              header: 'Horse',
              width: 240,
              render: (row) => (
                <span className={styles.horseCell}>
                  <span className={styles.horseThumb}>
                    <Icon name="horseshoe" size={16} />
                  </span>
                  <span className={styles.horseName}>
                    <span className="text-body-strong">{row.horse}</span>
                    <span className={styles.caption}>{row.code}</span>
                  </span>
                </span>
              ),
            },
            { key: 'exercise', header: 'Exercise', width: 220, render: (row) => row.exercise },
            { key: 'rider', header: 'Work Rider', width: 200, render: (row) => row.rider },
            { key: 'status', header: 'Status', width: 180, render: () => <StatusBadge family="session" status="SCHEDULED" /> },
            {
              key: 'actions',
              header: '',
              width: 80,
              align: 'right',
              render: () => <Icon name="chevron-right" size={20} className={styles.secondaryText} />,
            },
          ]}
        />
        <EmptyState title="No race history yet." description="Results appear here after the club records them." />
      </Section>

      <Section id="overlays" title="Modal & Drawer" figma="75:235 · 75:267">
        <div className={styles.row}>
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            Open modal
          </Button>
          <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
            Open drawer
          </Button>
        </div>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Modal title"
          footer={
            <>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setModalOpen(false)}>Confirm</Button>
            </>
          }
        >
          <div className={styles.slot}>Content slot — replace with modal content</div>
        </Modal>
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="Drawer title"
          subtitle="Supporting context"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setDrawerOpen(false)}>Select</Button>
            </>
          }
        >
          <div className={`${styles.slot} ${styles.slotFill}`}>Content slot — replace with drawer content</div>
        </Drawer>
      </Section>

      <Section id="checkbox" title="Checkbox" figma="327:6160 · 327:6184 · 327:6304 · LP-02 409:62">
        <div className={styles.row}>
          <Checkbox label="Remember me" defaultChecked />
          <Checkbox label="I acknowledge this warning" />
          <Checkbox label="Not available" disabled />
        </div>
      </Section>

      <Section id="validation" title="Validation Notice" figma="70:138">
        <div className={styles.narrow}>
          <ValidationNotice
            category="a"
            title="Exercise not permitted — Gallop"
            meta="Restriction set by Dr. Le · 2026-09-14 · Review due 2026-09-28"
            lockNote="Only the Veterinarian can change this restriction (Flow 3)."
            actions={<Button variant="tertiary">View restriction</Button>}
          >
            This horse is under a LIMITED restriction. The Veterinarian&apos;s restriction forbids Gallop and Sprint; Walk
            and Trot remain allowed. This exercise cannot be scheduled.
          </ValidationNotice>
          <ValidationNotice
            category="b"
            title="Schedule conflict — this Work Rider is already booked"
            meta="Conflict detected at save time"
            actions={
              <>
                <Button variant="secondary">Choose another rider</Button>
                <Button variant="tertiary">Change time</Button>
              </>
            }
          >
            Already assigned to Storm · Interval Training, 2026-09-25 07:00–07:45. Resolve the conflict to continue —
            this block cannot be bypassed.
          </ValidationNotice>
          <ValidationNotice
            category="c"
            title="Previous workload was HIGH"
            meta="Allowed with acknowledgement"
            actions={
              <>
                <Checkbox
                  label="I acknowledge this warning"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
                <TextField
                  label="Reason (required for serious warnings)"
                  placeholder="e.g. Reduced distance planned for this session"
                  className={styles.reasonField}
                />
              </>
            }
          >
            The last 3 sessions exceeded the planned workload band and recovery is below baseline. You may continue after
            acknowledging.
          </ValidationNotice>
          <ValidationNotice
            category="d"
            title="Does not support the program goal: Sprint fitness"
            meta="System recommendation — the Trainer decides"
            actions={
              <>
                <TextField
                  label="Override reason *"
                  placeholder="Why is this exercise still appropriate?"
                  className={styles.reasonField}
                />
                <Button variant="tertiary">Override with reason</Button>
              </>
            }
          >
            Endurance Ride does not strongly support the current training goal. You may override with a reason.
          </ValidationNotice>
        </div>
      </Section>

      <Section id="chart" title="Chart Container" figma="73:272">
        <div className={styles.charts}>
          <ChartContainer
            title="Heart rate over time"
            seriesLabel="Heart rate"
            values={HEART_RATE}
            yTicks={[190, 170, 150, 130, 110]}
            xLabels={['0 min', '4', '8', '12', '16 min']}
            threshold={{ value: 180, label: 'Threshold 180 bpm' }}
          />
          <ChartContainer
            title="Heart rate over time"
            seriesLabel="Heart rate"
            values={[]}
            yTicks={[190, 170, 150, 130, 110]}
            xLabels={['0 min', '4', '8', '12', '16 min']}
            threshold={{ value: 180, label: 'Threshold 180 bpm' }}
          />
        </div>
      </Section>

      <Section id="horse-card" title="Horse Card" figma="75:360">
        <div className={styles.row}>
          <HorseCard
            name="Thunder Bolt"
            meta="TB-001 · Thoroughbred · 4 yrs · Box A-12"
            availability="AVAILABLE"
            facts={[
              { label: 'Weight', value: '512 kg' },
              { label: 'Next session', value: 'Tue 07:00' },
            ]}
            action={<Button variant="tertiary">View profile</Button>}
          />
          <HorseCard
            name="Storm"
            meta="ST-014 · Thoroughbred · 5 yrs · Box B-03"
            availability="LIMITED"
            facts={[
              { label: 'Weight', value: '512 kg' },
              { label: 'Next session', value: 'Tue 07:00' },
            ]}
            action={<Button variant="tertiary">View profile</Button>}
          />
          <HorseCard
            name="Night Runner"
            meta="NR-007 · Arabian · 6 yrs · Box C-11"
            availability="LOCKED"
            facts={[
              { label: 'Weight', value: '512 kg' },
              { label: 'Next session', value: 'None — blocked' },
            ]}
            action={<Button variant="tertiary">View profile</Button>}
          />
        </div>
      </Section>

      <Section id="candidate-card" title="Candidate Card" figma="75:418">
        <div className={styles.row}>
          <CandidateCard
            name="Tran Minh Khoa"
            subtitle="Trainer · 6 yrs experience"
            tags={['Sprint', 'Speed work']}
            facts={[
              { label: 'Active programs', value: '2' },
              { label: 'Worked with this horse', value: 'Yes — 1 program' },
              { label: 'Availability', value: 'Tue–Sat' },
            ]}
            actions={
              <>
                <Button variant="tertiary">View profile</Button>
                <Button>Select</Button>
              </>
            }
          />
          <CandidateCard
            name="Nguyen Van An"
            subtitle="Work Rider · 4 yrs experience"
            tags={['Flat', 'Interval']}
            facts={[
              { label: 'Rides this week', value: '3' },
              { label: 'Rode this horse', value: '12 times' },
              { label: 'Free at session time', value: '07:00–09:00' },
            ]}
            actions={
              <>
                <Button variant="tertiary">View profile</Button>
                <Button>Select</Button>
              </>
            }
          />
        </div>
      </Section>

      <Section id="tiles" title="Photo Attachment Tile & Stable Box Tile" figma="239:499 · 239:539">
        <div className={styles.row}>
          <PhotoAttachmentTile state="empty" onAdd={() => undefined} />
          <PhotoAttachmentTile state="attached" fileName="photo_01.jpg" onRemove={() => undefined} />
        </div>
        <div className={styles.row}>
          <StableBoxTile boxId="A-12" state="occupied" horseName="Thunder Bolt" />
          {['A-13', 'A-14'].map((boxId) => (
            <StableBoxTile
              key={boxId}
              boxId={boxId}
              state={selectedBox === boxId ? 'selected' : 'free'}
              onSelect={setSelectedBox}
            />
          ))}
        </div>
      </Section>

      <Section id="notifications" title="Notification Item" figma="239:566">
        <div className={styles.notifications}>
          <NotificationItem
            read={false}
            title="Preventive task due"
            time="08:00"
            body="Vaccination for Thunder Bolt is due today."
            context="Thunder Bolt · TB-001 · Preventive Healthcare"
          />
          <NotificationItem
            read
            title="Preventive task due"
            time="08:00"
            body="Vaccination for Thunder Bolt is due today."
            context="Thunder Bolt · TB-001 · Preventive Healthcare"
          />
        </div>
      </Section>

      <Section id="states" title="Loading, Empty & Error states" figma="EmptyState 329:6273 · Alert 70:50 (no dedicated loading/error frame)">
        <div className={styles.narrow}>
          <LoadingState label="Loading horses…" />
          <EmptyState title="No race history yet." description="Results appear here after the club records them." />
          <ErrorState
            title="Horses could not be loaded"
            description="Check your connection and try again."
            onRetry={() => undefined}
          />
        </div>
      </Section>

      <Section id="shell" title="App shell — 7 roles" figma="74:110 · 74:367 · 288:3192">
        <div className={styles.row}>
          {ROLE_CODES.map((role) => (
            <Link key={role} to={devShellPath(role)} className={styles.shellLink}>
              {ROLE_LABELS[role]}
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
