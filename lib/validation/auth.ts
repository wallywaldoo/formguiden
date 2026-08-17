import { z } from "zod";

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/constants";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Ange en e-postadress.")
  .email("Ange en giltig e-postadress.")
  .max(320);

export const passwordSchema = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `Lösenordet måste vara minst ${PASSWORD_MIN_LENGTH} tecken.`,
  )
  .max(PASSWORD_MAX_LENGTH, "Lösenordet är för långt.");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Ange ditt lösenord."),
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
