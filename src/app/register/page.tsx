"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
    const router = useRouter();
    const [accountType, setAccountType] = useState<"individual" | "company">("individual");
    const [form, setForm] = useState({
        email: "",
        password: "",
        street: "",
        city: "",
        province: "",
        postal_code: "",
        
        // Individual fields
        first_name: "",
        surname: "",
        contact_number: "",
        
        // Company fields
        company_name: "",
        contact_person_first_name: "",
        contact_person_surname: "",
        contact_person_number: "",
        business_permit_no: "",
        tin_no: "",
    });
    
    // File upload states (Mocked for UI for now)
    const [validIdFile, setValidIdFile] = useState<File | null>(null);
    const [businessPermitFile, setBusinessPermitFile] = useState<File | null>(null);

    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    function updateField(field: string, value: string) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    async function handleRegister(e: React.FormEvent) {
        e.preventDefault();
        
        if (form.password.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }
        setLoading(true);
        try {
            const supabase = createClient();
            
            // Build metadata dynamically based on account type
            const metaData: any = {
                account_type: accountType,
                address_street: form.street,
                address_city: form.city,
                address_province: form.province,
                address_postal_code: form.postal_code,
                role: "client",
                kyc_status: "pending_verification",
            };

            if (accountType === "individual") {
                metaData.first_name = form.first_name;
                metaData.surname = form.surname;
                metaData.phone = form.contact_number; // Map to standard phone
                metaData.full_name = `${form.first_name} ${form.surname}`.trim();
            } else {
                metaData.company_name = form.company_name;
                metaData.contact_person_first_name = form.contact_person_first_name;
                metaData.contact_person_surname = form.contact_person_surname;
                metaData.phone = form.contact_person_number;
                metaData.business_permit_no = form.business_permit_no;
                metaData.tin_no = form.tin_no;
                metaData.full_name = `${form.contact_person_first_name} ${form.contact_person_surname}`.trim();
            }

            const { error } = await supabase.auth.signUp({
                email: form.email,
                password: form.password,
                options: {
                    data: metaData,
                },
            });

            if (error) {
                toast.error(error.message);
            } else {
                toast.success("Account created! Awaiting admin verification.");
                router.push("/pending");
            }
        } catch {
            toast.error("An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#e5dfd3] px-4 py-12 relative overflow-hidden">
            {/* Mascot Placeholder */}
            <div className="absolute left-8 lg:left-24 bottom-12 hidden lg:block opacity-90">
                <div className="w-48 h-96 relative flex items-end">
                    <span className="text-[120px]">👨‍🔧</span>
                </div>
            </div>

            <div className="w-full max-w-4xl z-10 space-y-6">
                
                <div className="text-center space-y-2 mb-8">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight text-gray-900">OBBO iManage</h1>
                    <p className="text-lg text-gray-700">Hello there! Please register</p>
                </div>

                <Card className="w-full shadow-2xl rounded-2xl overflow-hidden border-2 border-gray-300">
                    {/* Tab Header */}
                    <div className="flex w-full h-14">
                        <Link href="/login" className="flex-1 bg-gray-500 text-white flex items-center justify-center text-lg font-bold hover:bg-gray-600 transition-colors">
                            Login
                        </Link>
                        <div className="flex-1 bg-white text-black flex items-center justify-center text-lg font-bold border-b-4 border-transparent">
                            Signup
                        </div>
                    </div>

                    <CardContent className="p-6 md:p-8 bg-white">
                        <form onSubmit={handleRegister} className="flex flex-col">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
                                
                                {/* LEFT COLUMN */}
                                <div className="space-y-8">
                                    {/* Account Credentials */}
                                    <div>
                                        <h3 className="font-bold text-lg mb-4 text-gray-900">Account Credentials</h3>
                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-sm font-semibold">Account Type:</Label>
                                                <Select value={accountType} onValueChange={(val) => { if (val === "individual" || val === "company") setAccountType(val); }}>
                                                    <SelectTrigger className="bg-white border-gray-300 h-11">
                                                        <SelectValue placeholder="Select Account Type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="individual">Individual</SelectItem>
                                                        <SelectItem value="company">Company</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-sm font-semibold">Email:</Label>
                                                <div className="flex gap-2">
                                                    <Input type="email" placeholder="you@company.com" value={form.email} onChange={(e) => updateField("email", e.target.value)} required className="h-11 border-gray-300" />
                                                    <Button type="button" variant="outline" className="h-11 bg-[#eab308] hover:bg-[#ca8a04] text-black border-none font-bold whitespace-nowrap" onClick={() => toast.info("OTP sent to your email! (Mock)")}>
                                                        Send Code
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-sm font-semibold">Password:</Label>
                                                <div className="relative">
                                                    <Input type={showPassword ? "text" : "password"} placeholder="••••••••" value={form.password} onChange={(e) => updateField("password", e.target.value)} required className="h-11 border-gray-300 pr-10" />
                                                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900" onClick={() => setShowPassword(!showPassword)}>
                                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Address */}
                                    <div>
                                        <h3 className="font-bold text-lg mb-4 text-gray-900">Address</h3>
                                        <div className="space-y-3">
                                            <div><Label className="text-sm font-semibold mb-1.5 block">Street:</Label><Input value={form.street} onChange={(e) => updateField("street", e.target.value)} className="h-11 border-gray-300" required /></div>
                                            <div><Label className="text-sm font-semibold mb-1.5 block">City:</Label><Input value={form.city} onChange={(e) => updateField("city", e.target.value)} className="h-11 border-gray-300" required /></div>
                                            <div><Label className="text-sm font-semibold mb-1.5 block">Province:</Label><Input value={form.province} onChange={(e) => updateField("province", e.target.value)} className="h-11 border-gray-300" required /></div>
                                            <div><Label className="text-sm font-semibold mb-1.5 block">Postal Code:</Label><Input value={form.postal_code} onChange={(e) => updateField("postal_code", e.target.value)} className="h-11 border-gray-300" required /></div>
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT COLUMN */}
                                <div className="space-y-6 lg:border-l lg:pl-10 border-gray-200">
                                    {accountType === "individual" ? (
                                        <div>
                                            <h3 className="font-bold text-lg mb-4 text-gray-900">Personal Information</h3>
                                            <div className="space-y-4">
                                                <div><Label className="text-sm font-semibold mb-1.5 block">First Name:</Label><Input value={form.first_name} onChange={(e) => updateField("first_name", e.target.value)} className="h-11 border-gray-300" required /></div>
                                                <div><Label className="text-sm font-semibold mb-1.5 block">Surname:</Label><Input value={form.surname} onChange={(e) => updateField("surname", e.target.value)} className="h-11 border-gray-300" required /></div>
                                                <div><Label className="text-sm font-semibold mb-1.5 block">Contact Number:</Label><Input value={form.contact_number} onChange={(e) => updateField("contact_number", e.target.value)} className="h-11 border-gray-300" required /></div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-sm font-semibold">Valid ID (Photo):</Label>
                                                    <div className="flex items-center gap-3">
                                                        <Button type="button" variant="outline" className="bg-[#eab308] hover:bg-[#ca8a04] text-black border-none font-bold" onClick={() => document.getElementById('valid-id-upload')?.click()}>
                                                            Choose File
                                                        </Button>
                                                        <span className="text-sm text-gray-500 truncate">{validIdFile ? validIdFile.name : 'No file chosen'}</span>
                                                        <input id="valid-id-upload" type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => setValidIdFile(e.target.files?.[0] || null)} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <h3 className="font-bold text-lg mb-4 text-gray-900">Company Information</h3>
                                            <div className="space-y-4">
                                                <div><Label className="text-sm font-semibold mb-1.5 block">Company Name:</Label><Input value={form.company_name} onChange={(e) => updateField("company_name", e.target.value)} className="h-11 border-gray-300" required /></div>
                                                <div><Label className="text-sm font-semibold mb-1.5 block">Contact Person First Name:</Label><Input value={form.contact_person_first_name} onChange={(e) => updateField("contact_person_first_name", e.target.value)} className="h-11 border-gray-300" required /></div>
                                                <div><Label className="text-sm font-semibold mb-1.5 block">Contact Person Surname:</Label><Input value={form.contact_person_surname} onChange={(e) => updateField("contact_person_surname", e.target.value)} className="h-11 border-gray-300" required /></div>
                                                <div><Label className="text-sm font-semibold mb-1.5 block">Contact Person Number:</Label><Input value={form.contact_person_number} onChange={(e) => updateField("contact_person_number", e.target.value)} className="h-11 border-gray-300" required /></div>
                                                
                                                <div className="space-y-1.5 pt-2">
                                                    <Label className="text-sm font-semibold">Contact Person Valid ID (Photo):</Label>
                                                    <div className="flex items-center gap-3">
                                                        <Button type="button" variant="outline" className="bg-[#eab308] hover:bg-[#ca8a04] text-black border-none font-bold" onClick={() => document.getElementById('contact-valid-id-upload')?.click()}>
                                                            Choose File
                                                        </Button>
                                                        <span className="text-sm text-gray-500 truncate">{validIdFile ? validIdFile.name : 'No file chosen'}</span>
                                                        <input id="contact-valid-id-upload" type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => setValidIdFile(e.target.files?.[0] || null)} />
                                                    </div>
                                                </div>

                                                <div><Label className="text-sm font-semibold mb-1.5 block">Business Permit No.:</Label><Input value={form.business_permit_no} onChange={(e) => updateField("business_permit_no", e.target.value)} className="h-11 border-gray-300" required /></div>
                                                
                                                <div className="space-y-1.5 pt-2">
                                                    <Label className="text-sm font-semibold">Business Permit (Photo):</Label>
                                                    <div className="flex items-center gap-3">
                                                        <Button type="button" variant="outline" className="bg-[#eab308] hover:bg-[#ca8a04] text-black border-none font-bold" onClick={() => document.getElementById('business-permit-upload')?.click()}>
                                                            Choose File
                                                        </Button>
                                                        <span className="text-sm text-gray-500 truncate">{businessPermitFile ? businessPermitFile.name : 'No file chosen'}</span>
                                                        <input id="business-permit-upload" type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => setBusinessPermitFile(e.target.files?.[0] || null)} />
                                                    </div>
                                                </div>

                                                <div><Label className="text-sm font-semibold mb-1.5 block">TIN No.:</Label><Input value={form.tin_no} onChange={(e) => updateField("tin_no", e.target.value)} className="h-11 border-gray-300" required /></div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                            </div>

                            {/* FULL WIDTH BOTTOM BUTTON */}
                            <div className="mt-10">
                                <Button type="submit" disabled={loading} className="w-full h-12 rounded-lg bg-[#eab308] hover:bg-[#ca8a04] text-black font-bold text-lg shadow-sm border border-[#ca8a04]/20">
                                    {loading ? "Signing up..." : "Sign Up"}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
