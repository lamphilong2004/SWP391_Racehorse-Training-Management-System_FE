import { useId, useState, type FormEvent } from 'react';
import {
  Button, Card, DataTable, EmptyState, Modal, SelectField, StatusBadge, TableToolbar, TextField,
  type DataTableColumn,
} from '../../design-system';

type ProgramStatus = 'ACTIVE' | 'PAUSED';
type ExampleProgram = { id: number; name: string; status: ProgramStatus };

const INITIAL_PROGRAMS: ExampleProgram[] = [
  { id: 1, name: 'Rèn sức bền', status: 'ACTIVE' },
  { id: 2, name: 'Phục hồi sau thi đấu', status: 'PAUSED' },
];
const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Đang chạy' },
  { value: 'PAUSED', label: 'Tạm dừng' },
];
const COLUMNS: DataTableColumn<ExampleProgram>[] = [
  { key: 'id', header: 'Mã chương trình', render: (program) => `CT-${String(program.id).padStart(3, '0')}`, nowrap: true },
  { key: 'name', header: 'Tên chương trình', render: (program) => program.name },
  { key: 'status', header: 'Trạng thái', render: (program) => <StatusBadge family="program" status={program.status} /> },
];

export function TailwindPatternExample() {
  const titleId = useId();
  const formId = useId();
  const [programs, setPrograms] = useState(INITIAL_PROGRAMS);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<ProgramStatus>('ACTIVE');
  const [nameError, setNameError] = useState(false);
  const rows = programs.filter((program) => program.name.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')));

  function close() {
    setOpen(false);
    setName('');
    setStatus('ACTIVE');
    setNameError(false);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const programName = name.trim();
    if (!programName) {
      setNameError(true);
      event.currentTarget.querySelector('input')?.focus();
      return;
    }
    setPrograms((current) => [...current, { id: current.length + 1, name: programName, status }]);
    setQuery('');
    close();
  }

  return (
    <section
      id="mau-tailwind"
      data-ui-v3=""
      aria-labelledby={titleId}
      className="grid min-w-0 gap-4 rounded-rh-card border border-rh-border bg-rh-page p-3 text-rh-text sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id={titleId} className="text-h2">Mẫu Tailwind chung</h2>
          <p className="text-body text-rh-muted">Dữ liệu mẫu chỉ tồn tại đến khi tải lại trang.</p>
        </div>
        <Button onClick={() => setOpen(true)}>Thêm chương trình mẫu</Button>
      </div>
      <Card title="Danh sách chương trình">
        <TableToolbar label="Bộ lọc chương trình mẫu" scope="page" resultCount={rows.length} hasFilters={Boolean(query)} onClear={() => setQuery('')}>
          <TextField label="Tìm chương trình mẫu" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        </TableToolbar>
        <DataTable
          caption="Chương trình mẫu" className="min-w-xl"
          columns={COLUMNS} rows={rows} rowKey={(program) => program.id}
          empty={<EmptyState title="Không tìm thấy chương trình mẫu" description="Hãy đổi từ khóa hoặc xóa bộ lọc." />}
        />
      </Card>
      <Modal title="Thêm chương trình mẫu" open={open} onClose={close} footer={
        <>
          <Button variant="secondary" onClick={close}>Hủy</Button>
          <Button type="submit" form={formId}>Lưu vào bảng mẫu</Button>
        </>
      }>
        <form id={formId} className="grid gap-4" onSubmit={save} noValidate>
          <TextField label="Tên chương trình" required maxLength={100} value={name}
            error={nameError ? 'Nhập tên chương trình.' : undefined}
            onChange={(event) => { setName(event.target.value); setNameError(false); }}
          />
          <SelectField label="Trạng thái chương trình" options={STATUS_OPTIONS} value={status}
            onChange={(event) => setStatus(event.target.value === 'PAUSED' ? 'PAUSED' : 'ACTIVE')}
          />
        </form>
      </Modal>
    </section>
  );
}
