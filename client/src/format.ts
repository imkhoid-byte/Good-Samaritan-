export function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function apiError(err: any, fallback: string): string {
  return err?.response?.data?.error || fallback;
}
