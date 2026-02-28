const API_BASE = 'http://localhost:5000';

/** Возвращает URL иконки для заданного icon_path из справочника техники. */
export function iconUrl(iconPath: string): string {
  // Бекенд отдаёт через GET /firemap/icons/<icon_path>
  const segments = iconPath.split('/').map(encodeURIComponent);
  return `${API_BASE}/firemap/icons/${segments.join('/')}`;
}
