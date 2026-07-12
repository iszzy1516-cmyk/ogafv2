import { APP_NAME, coatOfArms } from "../../index.js";

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = "Initializing OAGF Pension System..." }: LoadingScreenProps) {
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
        <div className="flex items-center justify-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-oagf-green border-t-transparent" />
          <p className="text-sm text-oagf-text">{message}</p>
        </div>
      </div>
    </div>
  );
}
