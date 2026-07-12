export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatNumber(amount: number): string {
  return amount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseMoney(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDate(date?: string | Date): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB");
}

export function formatDateTime(date?: string | Date): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB");
}

export function formatDateForInput(date?: string | Date): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function sanitizeCsvCell(value: string): string {
  const dangerous = /^[=+\-@\t\r]/;
  if (dangerous.test(value)) {
    return `'${value}`;
  }
  return value;
}

export function maskAccountNumber(accountNumber?: string): string {
  if (!accountNumber || accountNumber.length < 4) return "****";
  return `****${accountNumber.slice(-4)}`;
}

export function maskPhone(phone?: string): string {
  if (!phone || phone.length < 4) return "****";
  return `${phone.slice(0, 3)}****${phone.slice(-3)}`;
}

export function generateTimestampFilename(scope: string, extension: "csv" | "xlsx" | "sql" = "csv"): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `oagf_${scope}_${y}${m}${d}_${hh}${mm}${ss}.${extension}`;
}
