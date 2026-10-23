import { Link, useRouteError } from 'react-router';
import { Button, DesignSystemScope, ErrorState } from '../design-system';
import { ROUTES } from './routePaths';
import styles from './RouteErrorPage.module.css';

/** A screen chunk that no longer exists after a new deployment (or a dropped connection) fails to load. */
function isChunkLoadFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /dynamically imported module|Importing a module script failed|Unable to preload CSS|Loading chunk|ChunkLoadError/i.test(message);
}

/**
 * Route-level error boundary (UX Playbook v2.1 §2). Replaces the framework's developer error page with a calm,
 * recoverable state. It never shows stack traces, request data or server messages.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const chunk = isChunkLoadFailure(error);
  return <DesignSystemScope className={styles.page}>
    <main className={styles.panel}>
      <ErrorState
        title={chunk ? 'Không tải được màn hình này' : 'Đã xảy ra lỗi'}
        description={chunk
          ? 'Có thể đã có phiên bản Racehorse Ops mới hơn, hoặc kết nối bị gián đoạn. Tải lại trang để tiếp tục.'
          : 'Màn hình dừng đột ngột. Lỗi này không lưu bất kỳ dữ liệu nào. Hãy tải lại hoặc quay về trang tổng quan.'}
      />
      <div className={styles.actions}>
        <Button onClick={() => window.location.reload()}>Tải lại</Button>
        <Link className={styles.link} to={ROUTES.dashboard} reloadDocument>Về trang tổng quan</Link>
      </div>
    </main>
  </DesignSystemScope>;
}
