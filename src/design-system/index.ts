/**
 * Shared Design System (CORE-002). Feature code imports from here only.
 * Missing a component? Extend this design system first (owner: Trần Khải Hoàng) — never add a local copy.
 */
export { Icon, type IconName, type IconProps } from './icons/Icon';
export { ICON_NAMES } from './icons/iconNames';
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './components/Button/Button';
export { TextField, type TextFieldProps } from './components/TextField/TextField';
export { SelectField, type SelectFieldProps, type SelectOption } from './components/SelectField/SelectField';
export { StatusBadge, type StatusBadgeProps } from './components/StatusBadge/StatusBadge';
export {
  STATUS_REGISTRY,
  type BadgeTone,
  type BadgeSpec,
  type StatusFamily,
  type StatusOf,
} from './components/StatusBadge/statusRegistry';
export { AlertBanner, type AlertBannerProps, type AlertBannerType } from './components/AlertBanner/AlertBanner';
export { Card, type CardProps } from './components/Card/Card';
export { MetricCard, type MetricCardProps, type RealtimeState } from './components/MetricCard/MetricCard';
export { KeyValue, type KeyValueProps } from './components/KeyValue/KeyValue';
export { Tabs, type TabsProps, type TabItem } from './components/Tabs/Tabs';
export { Breadcrumb, type BreadcrumbProps, type BreadcrumbItem } from './components/Breadcrumb/Breadcrumb';
export { WizardStepper, type WizardStepperProps } from './components/WizardStepper/WizardStepper';
export { DataTable, type DataTableProps, type DataTableColumn } from './components/DataTable/DataTable';
export { EmptyState, type EmptyStateProps } from './components/EmptyState/EmptyState';
export { Modal, type ModalProps } from './components/Overlay/Modal';
export { Drawer, type DrawerProps } from './components/Overlay/Drawer';
export { cx } from './utils/cx';
export { TextAreaField, type TextAreaFieldProps } from './components/TextAreaField/TextAreaField';
