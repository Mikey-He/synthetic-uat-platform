const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatMoney(value: number, currency: string, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

// "2026-04" -> "Apr 2026". String based, so no clock or time zone is involved.
export function monthLabel(month: string) {
  const [year, m] = month.split("-");
  return `${MONTHS[Number(m) - 1]} ${year}`;
}
