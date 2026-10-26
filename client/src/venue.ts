// Shared bits for venue mode: labels, status styling and the owner token
// that lets a guest manage their tag without an account.

export const VENUE_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'coat_check', label: 'Coat check', icon: '🧥' },
  { value: 'event', label: 'Event / festival', icon: '🎟️' },
  { value: 'airport', label: 'Airport', icon: '✈️' },
  { value: 'hospital', label: 'Hospital', icon: '🏥' },
  { value: 'hotel', label: 'Hotel', icon: '🏨' },
  { value: 'school', label: 'School / campus', icon: '🎓' },
  { value: 'other', label: 'Other', icon: '📍' }
];

export function venueIcon(type: string): string {
  return VENUE_TYPES.find(v => v.value === type)?.icon || '📍';
}

export const TAG_STATUS: Record<string, { label: string; color: string }> = {
  unclaimed: { label: 'Unclaimed', color: 'bg-gray-100 text-gray-600' },
  active: { label: 'Checked in', color: 'bg-green-100 text-green-700' },
  found: { label: 'Found', color: 'bg-amber-100 text-amber-800' },
  at_desk: { label: 'At desk', color: 'bg-purple-100 text-purple-700' },
  returned: { label: 'Returned', color: 'bg-blue-100 text-blue-700' }
};

export const EVENT_LABELS: Record<string, { label: string; icon: string }> = {
  claimed: { label: 'Tag linked to owner', icon: '🔗' },
  scanned: { label: 'Someone scanned the tag', icon: '👀' },
  found_to_staff: { label: 'Found: being taken to staff', icon: '🙌' },
  found_message: { label: 'Finder sent a message', icon: '💬' },
  received: { label: 'Received at the desk', icon: '📥' },
  returned: { label: 'Returned to owner', icon: '✅' },
  picked_up: { label: 'Owner confirmed pickup', icon: '✅' },
  reset: { label: 'Tag reset for reuse', icon: '♻️' }
};

export interface TagEvent {
  id: string;
  type: string;
  message: string | null;
  finderName: string | null;
  finderContact: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: string;
}

const tokenKey = (code: string) => `gs_owner_${code}`;

export function getOwnerToken(code: string): string | null {
  try { return localStorage.getItem(tokenKey(code)); } catch { return null; }
}

export function saveOwnerToken(code: string, token: string): void {
  try { localStorage.setItem(tokenKey(code), token); } catch { /* private mode: the emailed link still works */ }
}

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Resolves to null rather than rejecting: sharing location is always optional.
export function getLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 60000 }
    );
  });
}
