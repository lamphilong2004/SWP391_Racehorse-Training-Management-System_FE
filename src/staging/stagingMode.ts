/** Leader-approved public sample build only. An env flag alone cannot enable it in an API/normal build. */
export const STAGING_SAMPLE = import.meta.env.MODE === 'staging-sample' && import.meta.env.VITE_STAGING_SAMPLE === 'true';
