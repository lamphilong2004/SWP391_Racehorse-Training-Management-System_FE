import { useState } from 'react';
import { Link } from 'react-router';
import { Button, Card, DataTable, DesignSystemScope, Drawer, EmptyState, ErrorState, Icon, Modal, ResponsiveGrid, Skeleton, Stack, StatusBadge, Tabs, TextAreaField, TextField, ToastRegion, UnsavedChangesGuard, type ToastMessage } from '../../design-system';
import styles from './FoundationV2Page.module.css';

/** Component review only. DEV-only route, no sample business store, Auth API or save action. */
export function FoundationV2Page() {
  const [text, setText] = useState('');
  const [notes, setNotes] = useState('');
  const [dialogText, setDialogText] = useState('');
  const [panel, setPanel] = useState<'modal' | 'drawer' | null>(null);
  const [tab, setTab] = useState('components');
  const [notices, setNotices] = useState<ToastMessage[]>([]);
  return <DesignSystemScope className={styles.page}>
    <UnsavedChangesGuard dirty={Boolean(text || notes)} />
    <header><p>Shared foundation review · no Backend or persistence</p><h1 className="text-h1">Equestrian Command v2</h1>
      <Link to="/login">Return to application</Link>{' · '}<Link to="/dev/components">Legacy component review</Link></header>
    <Tabs label="Foundation review" idPrefix="v2-review" items={[{ value: 'components', label: 'Components' }, { value: 'states', label: 'Data states' }]} value={tab} onChange={setTab} />
    <div role="tabpanel" id={`v2-review-panel-${tab}`} aria-labelledby={`v2-review-tab-${tab}`}>
      {tab === 'components' ? <Stack>
        <ResponsiveGrid>
          <Card title="Actions"><Stack><Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="tertiary">Tertiary</Button><Button variant="danger">Danger</Button><Button loading>Pending operation</Button><Button disabled>Disabled</Button><Button variant="icon" aria-label="Review icon"><Icon name="eye" /></Button></Stack></Card>
          <Card title="Form resilience"><Stack><TextField label="Review input" value={text} onChange={e => setText(e.target.value)} helperText="Memory only. Leaving with text requires confirmation." />
            <TextField label="Invalid example" error="Explain the issue in text." /><TextField label="Disabled example" disabled />
            <TextAreaField label="Review notes" value={notes} onChange={e => setNotes(e.target.value)} helperText="No storage or server writes." />
            <Button variant="secondary" onClick={() => { setText(''); setNotes(''); }}>Discard review input</Button></Stack></Card>
          <Card title="Semantic states"><Stack><StatusBadge family="availability" status="AVAILABLE" /><StatusBadge family="availability" status="LIMITED" /><StatusBadge family="availability" status="LOCKED" />
            <Button variant="secondary" onClick={() => setPanel('modal')}>Open modal</Button><Button variant="secondary" onClick={() => setPanel('drawer')}>Open drawer</Button>
            <Button variant="secondary" onClick={() => setNotices(prev => [...prev, { id: 'review', message: 'Component feedback example, nothing saved.' }])}>Show feedback example</Button></Stack></Card>
        </ResponsiveGrid>
        <Card title="Table"><div className="table-scroll" tabIndex={0} role="region" aria-label="Review table"><DataTable caption="Component examples, not business records" columns={[{ key: 'component', header: 'Component', render: (row: { id: number; name: string }) => row.name }]} rows={[{ id: 1, name: 'Canonical DataTable' }]} rowKey={row => row.id} /></div></Card>
        <ToastRegion items={notices} onDismiss={id => setNotices(prev => prev.filter(item => item.id !== id))} />
      </Stack> : <ResponsiveGrid><Card title="Loading"><Skeleton label="Loading review region" /><Skeleton shape="card" /></Card>
        <Card title="Empty"><EmptyState title="No records" description="No fictional records are substituted." /></Card><Card title="Unavailable"><ErrorState title="Service unavailable" description="The API is not connected. No save has occurred." /></Card></ResponsiveGrid>}
    </div>
    <Modal open={panel === 'modal'} onClose={() => setPanel(null)} title="Review dialog" dismissible={!dialogText}
      footer={<Button variant="secondary" onClick={() => { setDialogText(''); setPanel(null); }}>Discard dialog input and close</Button>}>
      <TextField label="Dialog input" value={dialogText} onChange={e => setDialogText(e.target.value)} /><p>Dirty input disables accidental dismissal. No save or business mutation.</p></Modal>
    <Drawer open={panel === 'drawer'} onClose={() => setPanel(null)} title="Review drawer"><p>Responsive width, native focus handling and no persistence.</p></Drawer>
  </DesignSystemScope>;
}
