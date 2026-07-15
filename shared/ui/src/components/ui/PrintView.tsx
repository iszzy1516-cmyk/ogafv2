import { formatDate, formatNaira } from "../../utils/formatters";
import { coatOfArms } from "../../index.js";
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
          .page-break-before {
            break-before: page;
          }
        }
      `}</style>

      <header className="mb-2 border-b-2 border-black pb-2 text-center">
        <img
          src={coatOfArms}
          alt="Coat of Arms of Nigeria"
          className="mx-auto mb-1 h-14 w-auto"
        />
        <h1 className="text-lg font-bold uppercase tracking-wide">OAGF RETIREE SEVERANCE PAY SLIP</h1>
        <p className="text-xs font-semibold">{title}</p>
        <p className="text-[10px] text-gray-600">Printed on {printDate}</p>
      </header>

      {singleRecord && records.length === 1 ? (
        <SingleRecordView record={records[0]} />
      ) : records.length === 1 ? (
        <SingleRecordView record={records[0]} />
      ) : (
        <RecordsDetailView records={records} />
      )}

      <footer className="mt-4 border-t border-gray-300 pt-2">
        <p className="mb-2 text-xs font-semibold uppercase">Authorization Signatures</p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
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
      <p className="mb-4 text-xs font-medium">{label}</p>
      <div className="border-b border-black pb-1">
        <span className="text-xs text-gray-500">Signature</span>
      </div>
      <div className="mt-1 grid grid-cols-[3fr_1fr] gap-2 text-xs">
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
    <div className="space-y-2 text-xs">
      <Section title="Personal Information">
        <div className="col-span-2 grid grid-cols-[1fr_auto] gap-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <Field label="Record ID" value={record.id} />
            <Field label="Full Name" value={record.full_name} />
            <Field label="Gender" value={record.gender || "—"} />
            <Field label="Date of Birth" value={formatDate(record.date_of_birth)} />
            <Field label="Location" value={record.location || "—"} />
            <Field label="Zone" value={record.zone || "—"} />
            <Field label="Phone" value={record.phone || "—"} />
          </div>
          {record.photo_path ? (
            <img
              src={record.photo_path}
              alt="Passport"
              className="h-24 w-24 rounded-md border border-gray-300 object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-md border border-gray-300 bg-gray-100 text-[10px] text-gray-500">
              No Photo
            </div>
          )}
        </div>
      </Section>

      <Section title="Employment &amp; Service Records">
        <Field label="MDA Name" value={record.mda_name || "—"} />
        <Field label="Salary Structure" value={record.salary_structure || "—"} />
        <Field label="Grade" value={record.grade || "—"} />
        <Field label="Step" value={record.step || "—"} />
        <Field label="1st Appointment Date" value={formatDate(record.first_appointment_date)} />
        <Field label="Last Promotion Date" value={formatDate(record.last_promotion_date)} />
        <Field label="Retirement Date" value={formatDate(record.retirement_date)} />
        <Field label="Years of Service" value={record.years_of_service ?? "—"} />
        <Field label="Months of Service" value={record.months_of_service ?? "—"} />
      </Section>

      <Section title="Financial &amp; Payment Information">
        <FinancialField label="APA" value={record.apa} />
        <FinancialField label="Gratuity" value={record.gratuity} />
        <FinancialField label="Pension" value={record.pension} />
        <FinancialField label="Repatriation" value={record.repatriation} />
        <FinancialField label="Total Employee Contribution Due" value={record.total_employee_contribution_due} />
        <FinancialField label="Amount Owed" value={record.amount_owed} />
        <FinancialField label="Amount Owed to MDA" value={record.amount_owed_to_mda} />
        <FinancialField label="Amount Paid by OAGF" value={record.amount_paid_by_oagf} />
        <FinancialField label="10% Gratuity" value={record.ten_percent_gratuity} />
        <FinancialField label="10% Pension" value={record.ten_percent_pension} />
        <div className="col-span-2 mt-1 flex justify-between border-t-2 border-black pt-1 text-sm font-bold">
          <span>Due for Payment by OAGF</span>
          <span>{formatNaira(record.due_for_payment_by_oagf)}</span>
        </div>
      </Section>

      <Section title="Banking Information">
        <Field label="Bank Name" value={record.bank_name || "—"} />
        <Field label="Account Number" value={record.account_number || "—"} />
        <Field label="Bank Address" value={record.bank_address || "—"} />
      </Section>

      <Section title="Next of Kin &amp; Verification">
        <Field label="NOK Name" value={record.nok_name || "—"} />
        <Field label="NOK Phone" value={record.nok_phone || "—"} />
        <Field label="NOK Relation" value={record.nok_relation || "—"} />
        <Field label="Payment should go to NOK" value={record.nok_payment ? "Yes" : "No"} />
        <Field label="Status" value={record.status} />
        <Field label="Verified At" value={formatDate(record.verified_at)} />
        <Field label="Verified By" value={record.verified_by || "—"} />
        <Field label="Record Created" value={formatDate(record.created_at)} />
        <Field label="Last Updated" value={formatDate(record.updated_at)} />
        {record.verification_notes && (
          <Field label="Verification Notes" value={record.verification_notes} />
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="print-row">
      <p className="mb-1 border-b border-gray-300 text-[10px] font-semibold uppercase tracking-wide">{title}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function FinancialField({ label, value }: { label: string; value: number }) {
  return <Field label={label} value={formatNaira(value)} />;
}

function RecordsDetailView({ records }: { records: Pensioner[] }) {
  return (
    <div className="space-y-0">
      {records.map((record, idx) => (
        <div
          key={record.id}
          className={idx > 0 ? "page-break-before" : ""}
        >
          {idx > 0 && (
            <header className="mb-2 border-b-2 border-black pb-2 text-center print:block hidden">
              <h1 className="text-lg font-bold uppercase tracking-wide">OAGF RETIREE SEVERANCE PAY SLIP</h1>
              <p className="text-xs font-semibold">Detailed Record Print</p>
            </header>
          )}
          <SingleRecordView record={record} />
          {idx < records.length - 1 && (
            <div className="border-b-2 border-dashed border-gray-300 my-2 print:block hidden" />
          )}
        </div>
      ))}
    </div>
  );
}
