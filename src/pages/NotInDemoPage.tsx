import { Card, EmptyState } from '../design-system';
import { PageHeader } from '../layout/PageHeader';

/** Sidebar destinations that exist in Figma but are not part of the demonstrated main flow. Never a dead link. */
export function NotInDemoPage({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <EmptyState title="Not part of this demo build" description="This screen is owned by another CORE task and is not wired in the emergency demo branch." />
      </Card>
    </>
  );
}
