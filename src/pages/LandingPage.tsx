import { Link } from 'react-router';
import { Icon, type IconName } from '../design-system';
import { ROUTES } from '../app/routePaths';
import styles from './LandingPage.module.css';

/**
 * SCR-PUB-001 Landing Page (Figma LP-01 400:6). Public overview only: no business data is read and every account
 * comes from the Club Manager (DEC-008). Tiles for deferred modules are labelled "Planned" so nothing implies they
 * are implemented. Editorial horse imagery is decorative, never a database record or live metric.
 */
const PLATFORM: { icon: IconName; title: string; text: string }[] = [
  { icon: 'horseshoe', title: 'Mỗi ngựa một hồ sơ', text: 'Hồ sơ, phả hệ, sở hữu, ô chuồng, cân nặng, lịch sử huấn luyện và sức khỏe ở cùng một nơi.' },
  { icon: 'users', title: 'Bảy không gian theo vai trò', text: 'Club Manager, Head Trainer, Trainer, Work Rider, Veterinarian, Groom và Horse Owner — quyền truy cập do câu lạc bộ cấp.' },
  { icon: 'shield-check', title: 'Truy vết được mọi thao tác', text: 'Các thao tác quan trọng đều được ghi nhật ký. Lịch sử y tế và huấn luyện được lưu giữ, không bao giờ bị xóa âm thầm.' },
];
const SHOWCASE: { icon: IconName; title: string; text: string; label: string }[] = [
  { icon: 'horseshoe', label: '01 / HỒ SƠ', title: 'Hiểu từng con ngựa', text: 'Hồ sơ, phả hệ, quyền sở hữu và ô chuồng. Một điểm bắt đầu rõ ràng cho mọi quyết định.' },
  { icon: 'activity', label: '02 / HUẤN LUYỆN', title: 'Có kế hoạch cho từng sải bước', text: 'Từ mẫu chương trình đến lịch tập, phân công và đánh giá. Giữ đội ngũ cùng theo sát mục tiêu.' },
  { icon: 'stethoscope', label: '03 / SỨC KHỎE', title: 'Đặt sức khỏe lên trước', text: 'Liên kết khám, chấn thương, điều trị và hạn chế tập luyện trong hồ sơ y tế được phân quyền.' },
];
const PIPELINE = ['Mẫu chương trình', 'Chương trình huấn luyện ngựa', 'Buổi tập', 'Giám sát trực tiếp', 'Đánh giá'];
const TILES: { icon: IconName; title: string; text: string; planned?: boolean }[] = [
  { icon: 'clipboard-list', title: 'Chăm sóc & dinh dưỡng hằng ngày', text: 'Kế hoạch chăm sóc, khẩu phần và công việc hằng ngày của Groom.' },
  { icon: 'calendar', title: 'Chăm sóc phòng ngừa', text: 'Lịch tiêm phòng, tẩy giun, đóng móng và tái khám.', planned: true },
  { icon: 'bell', title: 'Cảnh báo tức thời', text: 'Cảnh báo theo ngưỡng và thông báo.' },
  { icon: 'bar-chart', title: 'Tổng quan & báo cáo', text: 'Trang tổng quan theo vai trò và báo cáo quản lý.', planned: true },
  { icon: 'lock', title: 'Phân quyền & nhật ký', text: 'Bảy vai trò và nhật ký hệ thống.' },
];
const ROLES: { icon: IconName; role: string; step: string; text: string }[] = [
  { icon: 'users', role: 'Club Manager', step: 'Hồ sơ & vận hành', text: 'Quản lý hồ sơ ngựa, sở hữu, chuồng và phân công chăm sóc.' },
  { icon: 'stethoscope', role: 'Veterinarian', step: 'Sức khỏe & an toàn', text: 'Khám, theo dõi điều trị và xác định khả năng tập luyện.' },
  { icon: 'target', role: 'Head Trainer', step: 'Chiến lược huấn luyện', text: 'Xây dựng chương trình từ mẫu và phân công Trainer phù hợp.' },
  { icon: 'activity', role: 'Trainer', step: 'Lịch tập & đánh giá', text: 'Lên lịch trong giai đoạn được duyệt, theo dõi và đánh giá kết quả.' },
  { icon: 'clipboard-list', role: 'Groom', step: 'Chăm sóc hằng ngày', text: 'Thực hiện việc được giao, kiểm tra trước buổi tập và báo bất thường.' },
  { icon: 'play', role: 'Work Rider', step: 'Thực hiện buổi tập', text: 'Kiểm tra điều kiện bắt đầu, thực hiện buổi tập và gửi phản hồi.' },
  { icon: 'eye', role: 'Horse Owner', step: 'Theo dõi ngựa sở hữu', text: 'Xem hồ sơ, tóm tắt sức khỏe và huấn luyện của ngựa thuộc sở hữu.' },
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
      <section className={styles.hero} aria-labelledby="landing-title">
        <div className={styles.heroVisual}>
          <img className={styles.heroImage} src="/assets/landing-horse.webp" alt="Ngựa nâu đứng trước chuồng, phía sau là đồng cỏ xanh" width="1536" height="1024" fetchPriority="high" />
        </div>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span aria-hidden="true" />QUẢN LÝ NGỰA ĐUA · RACEHORSE OPS</p>
          <h1 id="landing-title">Chính xác trong <em>từng sải bước.</em></h1>
          <p className={styles.lead}>Từ chuồng ngựa đến đường tập.<br />Kết nối hồ sơ, huấn luyện và chăm sóc sức khỏe trong cùng một nền tảng.</p>
          <div className={styles.ctas}><Link className={styles.primary} to={ROUTES.login}>Truy cập hệ thống →</Link><a className={styles.secondary} href="#platform">Khám phá hệ thống <Icon name="chevron-down" size={16} /></a></div>
          <p className={styles.accessNote}><Icon name="shield-check" size={16} />Không gian làm việc riêng theo vai trò</p>
        </div>
        <div className={styles.heroCaption}><Icon name="horseshoe" size={24} /><div><strong>Mỗi ngựa. Một hành trình.</strong><span>Hồ sơ · Huấn luyện · Sức khỏe · Chăm sóc</span></div></div>
      </section>

      <section id="platform" className={styles.section}>
        <div className={styles.split}><div><p className={styles.overline}>ĐƯỢC XÂY DỰNG CHO TRẠI NGỰA</p><h2>Một hồ sơ liên thông.<br />Cả đội ngũ cùng nhịp.</h2></div>
          <p className={styles.lead}>Mỗi ngựa có một hồ sơ chung cho Head Trainer, Trainer, Work Rider, Veterinarian và đội chuồng trại. Mỗi vai trò thấy đúng phần mình cần, và mọi quyết định quan trọng đều truy vết được.</p></div>
        <div className={styles.grid3}>{PLATFORM.map((item) => <article key={item.title} className={styles.feature}><span className={styles.iconChip}><Icon name={item.icon} size={20} /></span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      </section>

      <section id="showcase" className={styles.section}>
        <div className={styles.sectionHeading}><div><p className={styles.overline}>TỔNG QUAN NỀN TẢNG</p><h2>Quản lý tốt hơn.<br />Chăm sóc trọn vẹn hơn.</h2></div><p className={styles.lead}>Một hệ thống, ba luồng cốt lõi.<br />Từng bước bàn giao đều có ngữ cảnh.</p></div>
        <div className={styles.grid3}>{SHOWCASE.map((item) => <article key={item.title} className={styles.showcaseCard}><span className={styles.showcaseLabel}>{item.label}</span><span className={styles.iconChip}><Icon name={item.icon} size={24} /></span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      </section>

      <section id="capabilities" className={styles.section}>
        <div className={styles.split}><div><p className={styles.overline}>TÍNH NĂNG CỐT LÕI</p><h2 className="text-landing-display-l">Mọi phân hệ đều kết nối qua cùng một con ngựa.</h2></div>
          <p className={styles.lead}>Từ lần khám ban đầu đến buổi tập cuối cùng, mọi phân hệ đều đọc và ghi trên cùng một hồ sơ ngựa.</p></div>
        <div className={styles.bento}>
          <article className={styles.card}><p className={styles.overline}>HUẤN LUYỆN</p><h3>Từ mẫu chương trình đến đánh giá</h3><p>Head Trainer xây dựng chương trình cho ngựa từ mẫu; Trainer lên lịch buổi tập trong giai đoạn đã duyệt và đánh giá từng kết quả.</p>
            <ol className={styles.pipeline}>{PIPELINE.map((step) => <li key={step}>{step}</li>)}</ol></article>
          <article className={styles.card}><p className={styles.overline}>Y TẾ</p><h3>Veterinarian quyết định mức tập an toàn</h3><p>Hồ sơ y tế, khám bệnh và theo dõi vị trí chấn thương. Chỉ Veterinarian đặt khả năng tập luyện — và mọi buổi tập đều kiểm tra điều này.</p>
            <p className={styles.states}><span>SẴN SÀNG</span><span>HẠN CHẾ</span><span>KHÓA</span></p></article>
        </div>
        <div className={styles.grid5}>{TILES.map((tile) => <article key={tile.title} className={styles.tile}><span className={styles.iconChip}><Icon name={tile.icon} size={20} /></span><h3>{tile.title}</h3><p>{tile.text}</p>{tile.planned && <span className={styles.planned}>Kế hoạch</span>}</article>)}</div>
      </section>

      <section id="workflow" className={styles.section}>
        <div className={styles.split}><div><p className={styles.overline}>PHỐI HỢP THEO VAI TRÒ</p><h2>Bảy vai trò.<br />Một hành trình liền mạch.</h2></div>
          <p className={styles.lead}>Mỗi vai trò làm việc trong không gian riêng, nhưng mọi thao tác đều ghi vào cùng một hồ sơ ngựa — nên người tiếp theo luôn bắt đầu từ trạng thái mới nhất đã được duyệt.</p></div>
        <div className={styles.grid4}>{ROLES.map((item) => <article key={item.role} className={styles.card}><span className={styles.iconChip}><Icon name={item.icon} size={20} /></span><h3>{item.role}</h3><small className={styles.muted}>{item.step}</small><p>{item.text}</p></article>)}</div>
        <p className={styles.muted}>Phản hồi quay về để Trainer đánh giá; mọi vấn đề y tế được chuyển lại cho Veterinarian.</p>
      </section>

      <section className={styles.section}>
        <div className={styles.cta}><img src="/assets/landing-horse.webp" alt="" width="1536" height="1024" loading="lazy" /><div><p className={styles.overline}>BẮT ĐẦU NGÀY LÀM VIỆC</p><h2>Sẵn sàng cho<br />sải bước tiếp theo?</h2><p>Đăng nhập bằng tài khoản câu lạc bộ cấp. Racehorse Ops không cho đăng ký công khai.</p><Link className={styles.primary} to={ROUTES.login}>Truy cập hệ thống →</Link></div></div>
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
