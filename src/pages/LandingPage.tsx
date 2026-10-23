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
  { icon: 'horseshoe', title: 'Mỗi ngựa một hồ sơ', text: 'Hồ sơ, phả hệ, sở hữu, ô chuồng, cân nặng, lịch sử huấn luyện và sức khỏe ở cùng một nơi.' },
  { icon: 'users', title: 'Bảy không gian theo vai trò', text: 'Club Manager, Head Trainer, Trainer, Work Rider, Veterinarian, Groom và Horse Owner — quyền truy cập do câu lạc bộ cấp.' },
  { icon: 'shield-check', title: 'Truy vết được mọi thao tác', text: 'Các thao tác quan trọng đều được ghi nhật ký. Lịch sử y tế và huấn luyện được lưu giữ, không bao giờ bị xóa âm thầm.' },
];
const SHOWCASE = [
  { title: 'Quản lý ngựa', text: 'Hồ sơ, phả hệ và lịch sử, quyền sở hữu và ô chuồng của từng ngựa.' },
  { title: 'Quản lý huấn luyện', text: 'Chương trình xây dựng từ mẫu, buổi tập trong giai đoạn đã duyệt, giám sát trực tiếp.' },
  { title: 'Quản lý y tế', text: 'Hồ sơ, vị trí chấn thương 3D và khả năng tập luyện do Veterinarian đặt.' },
];
const PIPELINE = ['Mẫu chương trình', 'Chương trình huấn luyện ngựa', 'Buổi tập', 'Giám sát trực tiếp', 'Đánh giá'];
const TILES: { icon: IconName; title: string; text: string; planned?: boolean }[] = [
  { icon: 'clipboard-list', title: 'Chăm sóc & dinh dưỡng hằng ngày', text: 'Kế hoạch chăm sóc, khẩu phần và công việc hằng ngày của Groom.', planned: true },
  { icon: 'calendar', title: 'Chăm sóc phòng ngừa', text: 'Lịch tiêm phòng, tẩy giun, đóng móng và tái khám.', planned: true },
  { icon: 'bell', title: 'Cảnh báo tức thời', text: 'Cảnh báo theo ngưỡng và thông báo.' },
  { icon: 'bar-chart', title: 'Tổng quan & báo cáo', text: 'Trang tổng quan theo vai trò và báo cáo quản lý.', planned: true },
  { icon: 'lock', title: 'Phân quyền & nhật ký', text: 'Bảy vai trò và nhật ký hệ thống.' },
];
const ROLES: { icon: IconName; role: string; step: string; text: string }[] = [
  { icon: 'stethoscope', role: 'Veterinarian', step: 'Bước 1', text: 'Khám ngựa và đặt khả năng tập luyện — điều kiện mọi buổi tập đều kiểm tra.' },
  { icon: 'target', role: 'Head Trainer', step: 'Bước 2', text: 'Xây dựng chương trình cho ngựa từ mẫu và phân công Trainer.' },
  { icon: 'activity', role: 'Trainer', step: 'Bước 3', text: 'Lên lịch buổi tập trong giai đoạn đã duyệt và giám sát trực tiếp.' },
  { icon: 'play', role: 'Work Rider', step: 'Bước 4', text: 'Cưỡi buổi tập, báo cáo vấn đề và gửi phản hồi để Trainer đánh giá.' },
];

function Logo() {
  return <span className={styles.logo}><span className={styles.logomark}><Icon name="horseshoe" size={18} /></span>
    <span><strong>Racehorse Ops</strong><small>Hệ thống quản lý &amp; huấn luyện ngựa đua</small></span></span>;
}

export function LandingPage() {
  return <div className={styles.page}>
    <header className={styles.nav}>
      <Logo />
      <nav aria-label="Các mục trang giới thiệu" className={styles.navLinks}>
        <a href="#platform">Nền tảng</a><a href="#showcase">Giới thiệu</a><a href="#capabilities">Tính năng</a><a href="#workflow">Quy trình</a>
      </nav>
      <Link className={styles.loginButton} to={ROUTES.login}>Đăng nhập</Link>
    </header>

    <main>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span aria-hidden="true" />HỆ THỐNG QUẢN LÝ &amp; HUẤN LUYỆN NGỰA ĐUA</p>
          <h1 className="text-landing-display-xl">Chính xác trong <em>Từng sải bước.</em></h1>
          <p className={styles.lead}>Nền tảng tích hợp quản lý ngựa đua, điều phối huấn luyện thông minh và chăm sóc thú y.</p>
          <div className={styles.ctas}><Link className={styles.primary} to={ROUTES.login}>Truy cập hệ thống →</Link><a className={styles.secondary} href="#platform">Khám phá hệ thống</a></div>
          <p className={styles.facts}><span>7 không gian theo vai trò</span><span>Ngựa · Huấn luyện · Y tế</span><span>Giám sát buổi tập trực tiếp</span></p>
        </div>
        <div className={styles.heroCards} aria-label="Minh họa sản phẩm">
          <div className={styles.glass}>
            <div className={styles.glassHead}><span>BUỔI TẬP TRỰC TIẾP</span><span className={styles.pillLive}>ĐANG TẬP</span></div>
            <strong>Thunder Bolt · Buổi phi nước đại</strong>
            <div className={styles.glassMetrics}><span><b>152</b> bpm<small>Nhịp tim</small></span><span><b>36</b> km/h<small>Tốc độ</small></span></div>
            <small className={styles.muted}>Minh họa · số liệu mô phỏng</small>
          </div>
          <div className={styles.glass}>
            <div className={styles.glassHead}><span>KHẢ NĂNG TẬP LUYỆN</span><span className={styles.pillLimited}>HẠN CHẾ</span></div>
            <strong>Storm · ST-014</strong>
            <small className={styles.muted}>Được đi bộ và chạy nước kiệu · Veterinarian chặn bài chạy nước rút.</small>
          </div>
        </div>
      </section>

      <section id="platform" className={styles.section}>
        <div className={styles.split}><div><p className={styles.overline}>NỀN TẢNG</p><h2 className="text-landing-display-l">Huấn luyện, sức khỏe và chăm sóc hằng ngày — cuối cùng đã nằm trong một hồ sơ liên thông.</h2></div>
          <p className={styles.lead}>Mỗi ngựa có một hồ sơ chung cho Head Trainer, Trainer, Work Rider, Veterinarian và đội chuồng trại. Mỗi vai trò thấy đúng phần mình cần, và mọi quyết định quan trọng đều truy vết được.</p></div>
        <div className={styles.grid3}>{PLATFORM.map((item) => <article key={item.title} className={styles.feature}><span className={styles.iconChip}><Icon name={item.icon} size={20} /></span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      </section>

      <section id="showcase" className={styles.section}>
        <p className={styles.overline}>GIỚI THIỆU SẢN PHẨM</p><h2 className="text-landing-display-l">Xây dựng cho những người vận hành trại ngựa.</h2>
        <div className={styles.grid3}>{SHOWCASE.map((item) => <article key={item.title} className={styles.card}><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      </section>

      <section id="capabilities" className={styles.section}>
        <div className={styles.split}><div><p className={styles.overline}>TÍNH NĂNG CỐT LÕI</p><h2 className="text-landing-display-l">Mọi phân hệ đều kết nối qua cùng một con ngựa.</h2></div>
          <p className={styles.lead}>Từ lần khám ban đầu đến buổi tập cuối cùng, mọi phân hệ đều đọc và ghi trên cùng một hồ sơ ngựa.</p></div>
        <div className={styles.bento}>
          <article className={styles.card}><p className={styles.overline}>HUẤN LUYỆN</p><h3>Từ mẫu chương trình đến đánh giá</h3><p>Head Trainer xây dựng chương trình cho ngựa từ mẫu; Trainer lên lịch buổi tập trong giai đoạn đã duyệt và đánh giá từng kết quả.</p>
            <ol className={styles.pipeline}>{PIPELINE.map((step) => <li key={step}>{step}</li>)}</ol></article>
          <article className={styles.card}><p className={styles.overline}>Y TẾ</p><h3>Veterinarian quyết định mức tập an toàn</h3><p>Hồ sơ y tế, khám bệnh và theo dõi chấn thương với vị trí chấn thương 3D. Chỉ Veterinarian đặt khả năng tập luyện — và mọi buổi tập đều kiểm tra điều này.</p>
            <p className={styles.states}><span>SẴN SÀNG</span><span>HẠN CHẾ</span><span>KHÓA</span></p></article>
        </div>
        <div className={styles.grid5}>{TILES.map((tile) => <article key={tile.title} className={styles.tile}><span className={styles.iconChip}><Icon name={tile.icon} size={20} /></span><h3>{tile.title}</h3><p>{tile.text}</p>{tile.planned && <span className={styles.planned}>Kế hoạch</span>}</article>)}</div>
      </section>

      <section id="workflow" className={styles.section}>
        <div className={styles.split}><div><p className={styles.overline}>ĐIỀU PHỐI</p><h2 className="text-landing-display-l">Bốn vai trò. Một buổi tập. Không bỏ sót bước bàn giao nào.</h2></div>
          <p className={styles.lead}>Mỗi vai trò làm việc trong không gian riêng, nhưng mọi thao tác đều ghi vào cùng một hồ sơ ngựa — nên người tiếp theo luôn bắt đầu từ trạng thái mới nhất đã được duyệt.</p></div>
        <div className={styles.grid4}>{ROLES.map((item) => <article key={item.role} className={styles.card}><span className={styles.iconChip}><Icon name={item.icon} size={20} /></span><h3>{item.role}</h3><small className={styles.muted}>{item.step}</small><p>{item.text}</p></article>)}</div>
        <p className={styles.muted}>Phản hồi quay về để Trainer đánh giá; mọi vấn đề y tế được chuyển lại cho Veterinarian.</p>
        <p className={styles.muted}>Hệ thống còn có: Club Manager · Groom / Stable Hand · Horse Owner (chỉ xem ngựa của mình)</p>
      </section>

      <section className={styles.section}>
        <div className={styles.cta}><h2 className="text-landing-display-m">Sẵn sàng cho buổi tập hôm nay?</h2><p>Đăng nhập bằng tài khoản câu lạc bộ cấp. Racehorse Ops không cho đăng ký công khai.</p><Link className={styles.primary} to={ROUTES.login}>Truy cập hệ thống →</Link></div>
      </section>
    </main>

    <footer className={styles.footer}>
      <div><Logo /><p className={styles.muted}>Nền tảng web quản lý ngựa đua, điều phối huấn luyện và chăm sóc thú y.</p></div>
      <nav aria-label="Chân trang"><strong>Nền tảng</strong><a href="#platform">Nền tảng</a><a href="#showcase">Giới thiệu</a><a href="#capabilities">Tính năng</a><a href="#workflow">Quy trình</a></nav>
      <nav aria-label="Truy cập"><strong>Truy cập</strong><Link to={ROUTES.login}>Đăng nhập</Link></nav>
      <p className={styles.copyright}>© 2026 Racehorse Ops · Đồ án SWP391 · Ứng dụng web</p>
    </footer>
  </div>;
}
