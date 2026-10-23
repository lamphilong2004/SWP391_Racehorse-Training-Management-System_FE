import { useContext } from 'react';
import { Link } from 'react-router';
import { Card, EmptyState } from '../../design-system';
import { ManagementDestinationsContext } from './ManagementProvider';
import styles from './Management.module.css';

export function ManagementShortcuts() {
  const destinations = useContext(ManagementDestinationsContext);
  const registerHorse = destinations.registerHorse === '/horses/new' ? destinations.registerHorse : undefined;
  const roles = destinations.rolesPermissions?.readOnly === true ? destinations.rolesPermissions.to : undefined;
  return <Card title="Lối tắt" className={styles.figmaCard}>
    <div className={styles.shortcuts}>
      {registerHorse && <Link className={styles.linkButton} to={registerHorse}>+ Thêm ngựa</Link>}
      {destinations.createUser && <Link className={styles.linkButton} to={destinations.createUser}>Tạo người dùng</Link>}
      {roles && <Link className={styles.linkButton} to={roles}>Vai trò &amp; quyền hạn</Link>}
      {!registerHorse && !destinations.createUser && !roles && <EmptyState title="Không có lối tắt" description="Dùng menu bên trái để mở các màn hình hiện có." />}
    </div>
    <p className={styles.note}>Chưa có báo cáo quản lý.</p>
  </Card>;
}
