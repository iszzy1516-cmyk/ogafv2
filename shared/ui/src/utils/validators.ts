export function isNonEmptyString(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function isValidPassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (password.length < 8) errors.push("Password must be at least 8 characters");
  if (!/[A-Z]/.test(password)) errors.push("Password must contain an uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("Password must contain a lowercase letter");
  if (!/[0-9]/.test(password)) errors.push("Password must contain a number");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("Password must contain a special character");
  return { valid: errors.length === 0, errors };
}

export function isValidAccountNumber(accountNumber: string): boolean {
  return /^\d{10}$/.test(accountNumber);
}

export function isValidDateRange(start?: string, end?: string): boolean {
  if (!start || !end) return true;
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return false;
  return s <= e;
}

export function isValidEmploymentDates(
  firstAppointment?: string,
  retirement?: string,
): boolean {
  if (!firstAppointment || !retirement) return true;
  const first = new Date(firstAppointment);
  const retire = new Date(retirement);
  if (Number.isNaN(first.getTime()) || Number.isNaN(retire.getTime())) return false;
  return first <= retire;
}

export function isPositiveNumber(value: string): boolean {
  const parsed = parseFloat(value);
  return !Number.isNaN(parsed) && parsed >= 0;
}

export function isNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function calculateFinancials(inputs: {
  apa: string;
  gratuity: string;
  pension: string;
  repatriation: string;
  total_employee_contribution_due: string;
  amount_owed: string;
  amount_paid_by_oagf: string;
}): {
  tenPercentGratuity: number;
  tenPercentPension: number;
  amountOwed: number;
  dueForPayment: number;
} {
  const gratuity = parseFloat(inputs.gratuity) || 0;
  const pension = parseFloat(inputs.pension) || 0;
  const repatriation = parseFloat(inputs.repatriation) || 0;
  const employeeContribution = parseFloat(inputs.total_employee_contribution_due) || 0;
  const amountOwed = parseFloat(inputs.amount_owed) || 0;
  const paid = parseFloat(inputs.amount_paid_by_oagf) || 0;

  const tenPercentGratuity = gratuity * 0.1;
  const tenPercentPension = pension * 0.1;
  const dueForPayment =
    gratuity +
    tenPercentGratuity +
    pension +
    tenPercentPension +
    repatriation +
    employeeContribution -
    amountOwed -
    paid;

  return {
    tenPercentGratuity,
    tenPercentPension,
    amountOwed,
    dueForPayment,
  };
}
