import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  AlertBanner,
  Breadcrumb,
  Button,
  Card,
  DataTable,
  Drawer,
  EmptyState,
  Icon,
  ICON_NAMES,
  KeyValue,
  MetricCard,
  Modal,
  SelectField,
  StatusBadge,
  STATUS_REGISTRY,
  Tabs,
  TextField,
  WizardStepper,
  type StatusFamily,
} from '../../design-system';
import { ROLE_CODES, ROLE_LABELS } from '../../shared/auth/roles';
import styles from './DesignSystemPage.module.css';

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
export function DesignSystemPage() {
  const [tab, setTab] = useState('overview');
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<string | undefined>('s3');

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

      <Section id="shell" title="App shell — 7 roles" figma="74:110 · 74:367 · 288:3192">
        <div className={styles.row}>
          {ROLE_CODES.map((role) => (
            <Link key={role} to={`/design-system/shell/${role}`} className={styles.shellLink}>
              {ROLE_LABELS[role]}
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
