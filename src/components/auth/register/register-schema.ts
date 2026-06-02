import { z } from "zod";

export const accountTypeSchema = z.object({
    account_type: z.enum(["individual", "company"], "Please select an account type"),
});

export const credentialsSchema = z
    .object({
        email: z.string().min(1, "Email is required").email("Invalid email address"),
        password: z
            .string()
            .min(8, "Password must be at least 8 characters")
            .regex(/[A-Z]/, "Must contain at least one uppercase letter")
            .regex(/[0-9]/, "Must contain at least one number")
            .regex(/[^A-Za-z0-9]/, "Must contain at least one special character"),
        confirm_password: z.string().min(1, "Please confirm your password"),
        otp_verified: z.boolean().refine((v) => v === true, {
            message: "Please verify your email first",
        }),
    })
    .refine((data) => data.password === data.confirm_password, {
        message: "Passwords don't match",
        path: ["confirm_password"],
    });

export const individualProfileSchema = z.object({
    first_name: z.string().min(1, "First name is required"),
    surname: z.string().min(1, "Surname is required"),
    contact_number: z.string().min(1, "Contact number is required"),
    street: z.string().min(1, "Street address is required"),
    city: z.string().min(1, "Municipality is required"),
    province: z.string().min(1, "Province is required"),
    postal_code: z.string().min(1, "Postal code is required"),
});

export const companyProfileSchema = z.object({
    company_name: z.string().min(1, "Company name is required"),
    contact_person_first_name: z.string().min(1, "Contact person first name is required"),
    contact_person_surname: z.string().min(1, "Contact person surname is required"),
    contact_person_number: z.string().min(1, "Contact person number is required"),
    business_permit_no: z.string().min(1, "Business permit number is required"),
    tin_no: z.string().min(1, "TIN number is required"),
    street: z.string().min(1, "Street address is required"),
    city: z.string().min(1, "Municipality is required"),
    province: z.string().min(1, "Province is required"),
    postal_code: z.string().min(1, "Postal code is required"),
});

export const documentsSchema = z.object({
    valid_id_file: z
        .custom<File>()
        .refine((f) => f instanceof File && f.size > 0, "Valid ID is required"),
    business_permit_file: z.custom<File>().optional(),
});

export const companyDocumentsSchema = documentsSchema.refine(
    (data) => data.business_permit_file instanceof File && data.business_permit_file.size > 0,
    { message: "Business permit is required", path: ["business_permit_file"] },
);

export type AccountTypeValues = z.infer<typeof accountTypeSchema>;
export type CredentialsValues = z.infer<typeof credentialsSchema>;
export type IndividualProfileValues = z.infer<typeof individualProfileSchema>;
export type CompanyProfileValues = z.infer<typeof companyProfileSchema>;

export function getProfileSchema(accountType: "individual" | "company") {
    return accountType === "company" ? companyProfileSchema : individualProfileSchema;
}

export function getDocumentSchema(accountType: "individual" | "company") {
    return accountType === "company" ? companyDocumentsSchema : documentsSchema;
}

export function getPasswordStrength(password: string): {
    score: number;
    label: string;
    color: string;
} {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { score, label: "Weak", color: "bg-red-500" };
    if (score <= 2) return { score, label: "Fair", color: "bg-orange-500" };
    if (score <= 3) return { score, label: "Good", color: "bg-yellow-500" };
    if (score <= 4) return { score, label: "Strong", color: "bg-emerald-500" };
    return { score, label: "Very Strong", color: "bg-emerald-600" };
}
