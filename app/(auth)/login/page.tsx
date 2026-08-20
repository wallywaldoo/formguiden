import { SignInForm } from "@/features/auth/sign-in-form";
import { PRODUCT_NAME } from "@/lib/constants";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="space-y-7">
      <h1 className="text-center text-[1.65rem] font-semibold tracking-tight">
        {PRODUCT_NAME}
      </h1>
      <div className="surface px-5 py-6">
        <SignInForm initialError={params.error} />
      </div>
    </div>
  );
}
