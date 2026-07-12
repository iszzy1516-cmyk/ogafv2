import { APP_NAME, coatOfArms } from "../../index.js";

interface LoadingScreenProps {
  message?: string;
  error?: string | null;
  onRetry?: () => void;
}

export function LoadingScreen({
  message = "Initializing OAGF Pension System...",
  error,
  onRetry,
}: LoadingScreenProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-oagf-offwhite p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
        <img
          src={coatOfArms}
          alt="Coat of Arms of Nigeria"
          className="mx-auto mb-4 h-24 w-auto"
        />
        <h1 className="text-2xl font-bold text-oagf-text">{APP_NAME}</h1>
        <p className="mb-6 text-sm text-oagf-grey">Federal Government of Nigeria</p>

        {error ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-left">
              <p className="mb-1 text-sm font-semibold text-red-700">Application Failed to Start</p>
              <p className="text-xs text-red-600 break-words">{error}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-800">
              <p className="font-semibold mb-1">Common Fix:</p>
              <p>Ensure PostgreSQL 14+ is installed and running on this machine, then click Retry.</p>
            </div>
            {onRetry && (
              <button
                onClick={onRetry}
                className="w-full rounded-lg bg-oagf-green px-4 py-2 text-sm font-semibold text-white hover:bg-oagf-dark-green transition-colors"
              >
                Retry Connection
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-oagf-green border-t-transparent" />
            <p className="text-sm text-oagf-text">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
