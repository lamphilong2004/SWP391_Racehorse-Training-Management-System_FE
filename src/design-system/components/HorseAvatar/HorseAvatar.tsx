import { cx } from '../../utils/cx';
import defaultPhoto from './horse-default.jpg';
import styles from './HorseAvatar.module.css';

export interface HorseAvatarProps {
  /** Object or remote URL of the horse's own photo; without one the shared illustrative photo is shown. */
  src?: string | null;
  /** Horse name, used in the image description when the avatar is not decorative. */
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Decorative avatars sit next to the visible horse name and stay hidden from assistive technology. */
  decorative?: boolean;
  /** Overlay the "Ảnh minh họa" label on the shared default photo (large avatars on profile/forms). */
  labelDefault?: boolean;
  className?: string;
}

const DEFAULT_TITLE = 'Ảnh minh họa — ngựa này chưa có ảnh riêng';

/**
 * Round (sm/md) or rounded-square (lg/xl) horse photo. Horses without a photo show one shared illustrative photo
 * (CC0, Wikimedia Commons "Chestnut horse against a cloudy sky (Unsplash).jpg"), never presented as the horse itself.
 */
export function HorseAvatar({ src, name = '', size = 'sm', decorative = true, labelDefault = false, className }: HorseAvatarProps) {
  const label = src ? `Ảnh ngựa ${name}`.trim() : `${DEFAULT_TITLE}${name ? ` (${name})` : ''}`;
  return (
    <span className={cx(styles.avatar, styles[size], className)} title={src ? undefined : DEFAULT_TITLE}
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}>
      <img className={styles.photo} src={src || defaultPhoto} alt="" draggable={false} />
      {!src && labelDefault && <span className={styles.defaultLabel}>Ảnh minh họa</span>}
    </span>
  );
}
