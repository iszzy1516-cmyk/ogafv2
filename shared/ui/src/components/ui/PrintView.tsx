import { formatDate, formatNaira } from "../../utils/formatters";
import type { Pensioner } from "../../types";

interface PrintViewProps {
  records: Pensioner[];
  title: string;
  singleRecord?: boolean;
}

export function PrintView({ records, title, singleRecord }: PrintViewProps) {
  const printDate = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="print-container bg-white p-8 text-black">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          .print-container {
            width: 100% !important;
            padding: 0 !important;
          }
          .print-row {
            break-inside: avoid;
          }
          .signature-block {
            break-inside: avoid;
          }
        }
      `}</style>

      <header className="mb-4 border-b-2 border-black pb-3 text-center">
        <h1 className="text-xl font-bold uppercase tracking-wide">OAGF SEVERANCE</h1>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-gray-600">Printed on {printDate}</p>
      </header>

      {singleRecord && records.length === 1 ? (
        <SingleRecordView record={records[0]} />
      ) : (
        <RecordsTable records={records} />
      )}

      <footer className="mt-6 border-t border-gray-300 pt-4">
        <p className="mb-3 text-xs font-semibold uppercase">Authorization Signatures</p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <SignatureLine label="1. Beneficiary" />
          <SignatureLine label="2. MDA Representative" />
          <SignatureLine label="3. OAGF Representative" />
          <SignatureLine label="4. OAuGF Representative" />
        </div>
      </footer>
    </div>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div className="signature-block">
      <p className="mb-6 text-xs font-medium">{label}</p>
      <div className="border-b border-black pb-1">
        <span className="text-xs text-gray-500">Signature</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className="border-b border-gray-400 pb-1">
          <span className="text-gray-500">Full Name</span>
        </div>
        <div className="border-b border-gray-400 pb-1">
          <span className="text-gray-500">Date</span>
        </div>
      </div>
    </div>
  );
}

function SingleRecordView({ record }: { record: Pensioner }) {
  return (
    <div className="space-y-4">
      <section className="print-row grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-500">Employee Name</p>
          <p className="font-semibold">{record.full_name}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">MDA</p>
          <p className="font-semibold">{record.mda_name || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Location / Zone</p>
          <p>{record.location || "—"} / {record.zone || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Date of Birth</p>
          <p>{formatDate(record.date_of_birth)}</p>
        </div>
      </section>

      <section className="print-row">
        <p className="mb-2 text-xs font-semibold uppercase">Financial Summary</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <FinancialItem label="Gratuity" value={record.gratuity} />
          <FinancialItem label="10% Gratuity" value={record.ten_percent_gratuity} />
          <FinancialItem label="Pension" value={record.pension} />
          <FinancialItem label="10% Pension" value={record.ten_percent_pension} />
          <FinancialItem label="Repatriation" value={record.repatriation} />
          <FinancialItem label="Employee Contribution" value={record.total_employee_contribution_due} />
          <FinancialItem label="Amount Owed" value={record.amount_owed} />
          <FinancialItem label="Amount Paid by OAGF" value={record.amount_paid_by_oagf} />
        </div>
        <div className="mt-2 border-t-2 border-black pt-2">
          <div className="flex justify-between text-base font-bold">
            <span>Due for Payment by OAGF</span>
            <span>{formatNaira(record.due_for_payment_by_oagf)}</span>
          </div>
        </div>
      </section>

      <section className="print-row grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-500">Bank Name</p>
          <p>{record.bank_name || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Account Number</p>
          <p>{record.account_number || "—"}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-gray-500">Bank Address</p>
          <p>{record.bank_address || "—"}</p>
        </div>
      </section>

      <section className="print-row text-sm">
        <p className="text-xs text-gray-500">Status</p>
        <p className="font-semibold">{record.status}</p>
        {record.verification_notes && (
          <p className="mt-1 text-xs">Notes: {record.verification_notes}</p>
        )}
      </section>
    </div>
  );
}

function FinancialItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium">{formatNaira(value)}</span>
    </div>
  );
}

function RecordsTable({ records }: { records: Pensioner[] }) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border-b-2 border-black text-left">
          <th className="py-1 pr-2">#</th>
          <th className="py-1 pr-2">Name</th>
          <th className="py-1 pr-2">MDA</th>
          <th className="py-1 pr-2 text-right">Gratuity</th>
          <th className="py-1 pr-2 text-right">10% Grat.</th>
          <th className="py-1 pr-2 text-right">Pension</th>
          <th className="py-1 pr-2 text-right">10% Pens.</th>
          <th className="py-1 pr-2 text-right">Repat.</th>
          <th className="py-1 pr-2 text-right">Contr.</th>
          <th className="py-1 pr-2 text-right">Owed</th>
          <th className="py-1 pr-2 text-right">Paid</th>
          <th className="py-1 text-right">Due</th>
        </tr>
      </thead>
      <tbody>
        {records.map((record, idx) => (
          <tr key={record.id} className="print-row border-b border-gray-300">
            <td className="py-1 pr-2">{idx + 1}</td>
            <td className="py-1 pr-2 font-medium">{record.full_name}</td>
            <td className="py-1 pr-2">{record.mda_name || "—"}</td>
            <td className="py-1 pr-2 text-right">{formatNaira(record.gratuity)}</td>
            <td className="py-1 pr-2 text-right">{formatNaira(record.ten_percent_gratuity)}</td>
            <td className="py-1 pr-2 text-right">{formatNaira(record.pension)}</td>
            <td className="py-1 pr-2 text-right">{formatNaira(record.ten_percent_pension)}</td>
            <td className="py-1 pr-2 text-right">{formatNaira(record.repatriation)}</td>
            <td className="py-1 pr-2 text-right">{formatNaira(record.total_employee_contribution_due)}</td>
            <td className="py-1 pr-2 text-right">{formatNaira(record.amount_owed)}</td>
            <td className="py-1 pr-2 text-right">{formatNaira(record.amount_paid_by_oagf)}</td>
            <td className="py-1 text-right font-semibold">{formatNaira(record.due_for_payment_by_oagf)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
