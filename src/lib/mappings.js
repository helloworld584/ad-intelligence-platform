export const PLATFORM_DB_MAP = {
  'Google Search': 'google_search',
  'Google Display': 'google_display',
  'Meta': 'meta'
}

export const PLATFORM_DISPLAY_MAP = Object.fromEntries(
  Object.entries(PLATFORM_DB_MAP).map(([k, v]) => [v, k])
)

export const toDbPlatform = (display) => PLATFORM_DB_MAP[display] ?? display
export const toDisplayPlatform = (db) => PLATFORM_DISPLAY_MAP[db] ?? db
