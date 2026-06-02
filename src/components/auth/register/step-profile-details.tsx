"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StepProfileDetailsProps {
    form: {
        first_name: string;
        surname: string;
        contact_number: string;
        company_name: string;
        contact_person_first_name: string;
        contact_person_surname: string;
        contact_person_number: string;
        business_permit_no: string;
        tin_no: string;
        street: string;
        city: string;
        province: string;
        postal_code: string;
    };
    updateField: (field: string, value: string) => void;
    errors: Record<string, string>;
    accountType: "individual" | "company";
}

function FieldError({ error }: { error?: string }) {
    if (!error) return null;
    return <p className="text-sm text-destructive mt-1">{error}</p>;
}

export function StepProfileDetails({
    form,
    updateField,
    errors,
    accountType,
}: StepProfileDetailsProps) {
    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Profile details
                </h2>
                <p className="text-sm text-muted-foreground">
                    {accountType === "company"
                        ? "Enter your company and contact person information."
                        : "Enter your personal information."}
                </p>
            </div>

            {accountType === "individual" ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="first_name" className="text-sm font-medium">
                                First name
                            </Label>
                            <Input
                                id="first_name"
                                value={form.first_name}
                                onChange={(e) => updateField("first_name", e.target.value)}
                                className="h-11 mt-1.5"
                            />
                            <FieldError error={errors.first_name} />
                        </div>
                        <div>
                            <Label htmlFor="surname" className="text-sm font-medium">
                                Surname
                            </Label>
                            <Input
                                id="surname"
                                value={form.surname}
                                onChange={(e) => updateField("surname", e.target.value)}
                                className="h-11 mt-1.5"
                            />
                            <FieldError error={errors.surname} />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="contact_number" className="text-sm font-medium">
                            Contact number
                        </Label>
                        <Input
                            id="contact_number"
                            value={form.contact_number}
                            onChange={(e) => updateField("contact_number", e.target.value)}
                            className="h-11 mt-1.5"
                        />
                        <FieldError error={errors.contact_number} />
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="company_name" className="text-sm font-medium">
                            Company name
                        </Label>
                        <Input
                            id="company_name"
                            value={form.company_name}
                            onChange={(e) => updateField("company_name", e.target.value)}
                            className="h-11 mt-1.5"
                        />
                        <FieldError error={errors.company_name} />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="contact_person_first_name" className="text-sm font-medium">
                                Contact person first name
                            </Label>
                            <Input
                                id="contact_person_first_name"
                                value={form.contact_person_first_name}
                                onChange={(e) =>
                                    updateField("contact_person_first_name", e.target.value)
                                }
                                className="h-11 mt-1.5"
                            />
                            <FieldError error={errors.contact_person_first_name} />
                        </div>
                        <div>
                            <Label htmlFor="contact_person_surname" className="text-sm font-medium">
                                Contact person surname
                            </Label>
                            <Input
                                id="contact_person_surname"
                                value={form.contact_person_surname}
                                onChange={(e) =>
                                    updateField("contact_person_surname", e.target.value)
                                }
                                className="h-11 mt-1.5"
                            />
                            <FieldError error={errors.contact_person_surname} />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="contact_person_number" className="text-sm font-medium">
                            Contact person number
                        </Label>
                        <Input
                            id="contact_person_number"
                            value={form.contact_person_number}
                            onChange={(e) => updateField("contact_person_number", e.target.value)}
                            className="h-11 mt-1.5"
                        />
                        <FieldError error={errors.contact_person_number} />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="business_permit_no" className="text-sm font-medium">
                                Business permit no.
                            </Label>
                            <Input
                                id="business_permit_no"
                                value={form.business_permit_no}
                                onChange={(e) => updateField("business_permit_no", e.target.value)}
                                className="h-11 mt-1.5"
                            />
                            <FieldError error={errors.business_permit_no} />
                        </div>
                        <div>
                            <Label htmlFor="tin_no" className="text-sm font-medium">
                                TIN no.
                            </Label>
                            <Input
                                id="tin_no"
                                value={form.tin_no}
                                onChange={(e) => updateField("tin_no", e.target.value)}
                                className="h-11 mt-1.5"
                            />
                            <FieldError error={errors.tin_no} />
                        </div>
                    </div>
                </div>
            )}

            {/* Address — shared */}
            <div className="space-y-4 pt-2">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                    Address
                </h3>
                <div>
                    <Label htmlFor="street" className="text-sm font-medium">
                        Street address
                    </Label>
                    <Input
                        id="street"
                        value={form.street}
                        onChange={(e) => updateField("street", e.target.value)}
                        className="h-11 mt-1.5"
                    />
                    <FieldError error={errors.street} />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                        <Label htmlFor="city" className="text-sm font-medium">
                            Municipality
                        </Label>
                        <Input
                            id="city"
                            value={form.city}
                            onChange={(e) => updateField("city", e.target.value)}
                            className="h-11 mt-1.5"
                        />
                        <FieldError error={errors.city} />
                    </div>
                    <div>
                        <Label htmlFor="province" className="text-sm font-medium">
                            Province
                        </Label>
                        <Input
                            id="province"
                            value={form.province}
                            onChange={(e) => updateField("province", e.target.value)}
                            className="h-11 mt-1.5"
                        />
                        <FieldError error={errors.province} />
                    </div>
                    <div>
                        <Label htmlFor="postal_code" className="text-sm font-medium">
                            Postal code
                        </Label>
                        <Input
                            id="postal_code"
                            value={form.postal_code}
                            onChange={(e) => updateField("postal_code", e.target.value)}
                            className="h-11 mt-1.5"
                        />
                        <FieldError error={errors.postal_code} />
                    </div>
                </div>
            </div>
        </div>
    );
}
