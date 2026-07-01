'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { AuthShell } from '@/components/auth/auth-shell';
import { createRoleNotificationAdmin } from '@/lib/actions/notification-actions';
import { usePersistedForm } from '@/lib/hooks/use-persisted-form';
import { StepIndicator } from '@/components/ui/step-indicator';
import { StepAccountType } from '@/components/auth/register/step-account-type';
import { StepCredentials } from '@/components/auth/register/step-credentials';
import { StepProfileDetails } from '@/components/auth/register/step-profile-details';
import { StepDocuments } from '@/components/auth/register/step-documents';
import { StepReview } from '@/components/auth/register/step-review';
import {
  accountTypeSchema,
  credentialsSchema,
  getProfileSchema,
  getDocumentSchema,
} from '@/components/auth/register/register-schema';

const STEPS = ['Account Type', 'Credentials', 'Profile', 'Documents', 'Review'];

const INITIAL_FORM = {
  account_type: 'individual' as 'individual' | 'company',
  email: '',
  password: '',
  confirm_password: '',
  otp_verified: false,
  first_name: '',
  surname: '',
  contact_number: '',
  company_name: '',
  contact_person_first_name: '',
  contact_person_surname: '',
  contact_person_number: '',
  business_permit_no: '',
  tin_no: '',
  street: '',
  city: '',
  province: '',
  postal_code: '',
};

export default function RegisterPage() {
  const router = useRouter();
  const [form, updateForm, clearForm] = usePersistedForm('obbo-register-form', INITIAL_FORM);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // 🌟 FIXED CORRECTION: Ginawang hiwalay ang front at back files para sa Valid ID split upload compliance
  const [validIdFrontFile, setValidIdFrontFile] = useState<File | null>(null);
  const [validIdBackFile, setValidIdBackFile] = useState<File | null>(null);
  const [businessPermitFile, setBusinessPermitFile] = useState<File | null>(null);

  const updateField = useCallback(
    (field: string, value: string | boolean) => {
      updateForm({ [field]: value } as Partial<typeof INITIAL_FORM>);
      setErrors((prev) => {
        if (prev[field]) {
          const next = { ...prev };
          delete next[field];
          return next;
        }
        return prev;
      });
    },
    [updateForm],
  );

  function validateStep(step: number): boolean {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      const result = accountTypeSchema.safeParse({ account_type: form.account_type });
      if (!result.success) {
        for (const issue of result.error.issues) {
          newErrors[issue.path[0] as string] = issue.message;
        }
      }
    }

    if (step === 1) {
      const result = credentialsSchema.safeParse({
        email: form.email,
        password: form.password,
        confirm_password: form.confirm_password,
        otp_verified: form.otp_verified,
      });
      if (!result.success) {
        for (const issue of result.error.issues) {
          const key = issue.path[0] as string;
          if (!newErrors[key]) newErrors[key] = issue.message;
        }
      }
    }

    if (step === 2) {
      const schema = getProfileSchema(form.account_type);
      const result = schema.safeParse(form);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const key = issue.path[0] as string;
          if (!newErrors[key]) newErrors[key] = issue.message;
        }
      }
    }

    if (step === 3) {
      const schema = getDocumentSchema(form.account_type);
      // 🌟 SCHEMA LOOKUP HANDLER: Ipinasa ang parehong front at back validation nodes sa parsed fields
      const result = schema.safeParse({
        valid_id_front_file: validIdFrontFile,
        valid_id_back_file: validIdBackFile,
        business_permit_file: businessPermitFile,
      });
      if (!result.success) {
        for (const issue of result.error.issues) {
          const key = issue.path[0] as string;
          if (!newErrors[key]) newErrors[key] = issue.message;
        }
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      const msgs = Object.values(newErrors);
      toast.error(
        msgs.length <= 2
          ? msgs.join('. ')
          : `${msgs[0]} — and ${msgs.length - 1} more issue${msgs.length > 2 ? 's' : ''}.`,
      );
      return false;
    }
    return true;
  }

  function goNext() {
    if (!validateStep(currentStep)) return;
    setCompletedSteps((prev) => new Set(prev).add(currentStep));
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
    setErrors({});
  }

  function goBack() {
    setCurrentStep((s) => Math.max(s - 1, 0));
    setErrors({});
  }

  function goToStep(step: number) {
    if (step < currentStep || completedSteps.has(step)) {
      setCurrentStep(step);
      setErrors({});
    }
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const supabase = createClient();

      const metaData: Record<string, string> = {
        account_type: form.account_type,
        address_street: form.street,
        address_city: form.city,
        address_province: form.province,
        address_postal_code: form.postal_code,
        role: 'client',
        kyc_status: 'pending_verification',
      };

      if (form.account_type === 'individual') {
        metaData.first_name = form.first_name;
        metaData.surname = form.surname;
        metaData.phone = form.contact_number;
        metaData.full_name = `${form.first_name} ${form.surname}`.trim();
      } else {
        metaData.company_name = form.company_name;
        metaData.contact_person_first_name = form.contact_person_first_name;
        metaData.company_person_surname = form.contact_person_surname;
        metaData.phone = form.contact_person_number;
        metaData.business_permit_no = form.business_permit_no;
        metaData.tin_no = form.tin_no;
        metaData.full_name =
          `${form.contact_person_first_name} ${form.contact_person_surname}`.trim();
      }

      // 1. Sign up the user inside Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: metaData },
      });

      if (signUpError) {
        toast.error(signUpError.message);
        return;
      }
      const userId = authData.user?.id;
      if (!userId) {
        toast.error('Registration failed. Please try again.');
        return;
      }

      // 2. Upload KYC documents (Front, Back, and optional Business Permit)
      const kycPaths: string[] = [];

      // 🌟 ID FRONT VIEW UPLOAD MATRIX NODE
      if (validIdFrontFile) {
        const frontExt = validIdFrontFile.name.split('.').pop();
        const frontPath = `${userId}/valid-id-front.${frontExt}`;
        const { error: frontUploadErr } = await supabase.storage
          .from('kyc-documents')
          .upload(frontPath, validIdFrontFile, { upsert: true });

        if (!frontUploadErr) kycPaths.push(frontPath);
      }

      // 🌟 ID BACK VIEW UPLOAD MATRIX NODE
      if (validIdBackFile) {
        const backExt = validIdBackFile.name.split('.').pop();
        const backPath = `${userId}/valid-id-back.${backExt}`;
        const { error: backUploadErr } = await supabase.storage
          .from('kyc-documents')
          .upload(backPath, validIdBackFile, { upsert: true });

        if (!backUploadErr) kycPaths.push(backPath);
      }

      // Business Permit upload control loop for company accounts
      if (form.account_type === 'company' && businessPermitFile) {
        const bpExt = businessPermitFile.name.split('.').pop();
        const bpPath = `${userId}/business-permit.${bpExt}`;
        const { error: bpUploadErr } = await supabase.storage
          .from('kyc-documents')
          .upload(bpPath, businessPermitFile, { upsert: true });

        if (!bpUploadErr) kycPaths.push(bpPath);
      }

      // 3. Update profiles postgres public reference array record row with split paths
      if (kycPaths.length > 0) {
        await supabase.from('profiles').update({ kyc_documents: kycPaths }).eq('id', userId);
      }

      // Trigger Admin Notification alert logs
      await createRoleNotificationAdmin({
        targetRole: 'admin',
        title: 'New Client Registration',
        message: `${metaData.full_name} has registered and is pending KYC verification.`,
        href: '/admin/clients?tab=kyc',
        severity: 'info',
      });

      await supabase.auth.signOut();
      clearForm();
      toast.success('Registration submitted! Waiting for validation review.');
      router.push('/login?registered=true');
    } catch {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      backHref="/"
      backLabel="Back to Home"
      eyebrow="Verified onboarding"
      title="Create your account"
      description="Register once, complete verification, and get approved for portal access."
      highlights={[
        {
          label: 'Verification',
          value: 'Email + KYC',
          description: 'Keep the onboarding path clear and secure for every new client.',
        },
        {
          label: 'Approval flow',
          value: 'Admin review',
          description: 'New accounts wait in a consistent pending state before activation.',
        },
      ]}
    >
      <div className="space-y-8">
        <div className="space-y-3">
          <div className="border-primary/20 bg-primary/5 text-primary inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.28em] uppercase">
            Sign up
          </div>
          <div className="space-y-2">
            <h1 className="text-foreground text-3xl font-semibold tracking-tight text-balance">
              Start your client profile
            </h1>
            <p className="text-muted-foreground text-sm leading-6">
              Complete the steps below to request access to the portal.
            </p>
          </div>
        </div>

        <StepIndicator
          steps={STEPS}
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={goToStep}
        />

        <div className="relative overflow-hidden">
          <div key={currentStep} className="animate-slide-in-right">
            {currentStep === 0 && (
              <StepAccountType
                value={form.account_type}
                onChange={(v) => updateField('account_type', v)}
                error={errors.account_type}
              />
            )}
            {currentStep === 1 && (
              <StepCredentials form={form} updateField={updateField} errors={errors} />
            )}
            {currentStep === 2 && (
              <StepProfileDetails
                form={form}
                updateField={updateField}
                errors={errors}
                accountType={form.account_type}
              />
            )}
            {currentStep === 3 && (
              // 🌟 CHILD PROP CONFIGURATION PATHWAY: Ipinasa ang magkahiwalay na split parameters pababa sa form view component
              <StepDocuments
                files={{
                  valid_id_front_file: validIdFrontFile,
                  valid_id_back_file: validIdBackFile,
                  business_permit_file: businessPermitFile,
                }}
                onFilesChange={(f) => {
                  if (f.valid_id_front_file !== undefined)
                    setValidIdFrontFile(f.valid_id_front_file);
                  if (f.valid_id_back_file !== undefined) setValidIdBackFile(f.valid_id_back_file);
                  if (f.business_permit_file !== undefined)
                    setBusinessPermitFile(f.business_permit_file);
                }}
                errors={errors}
                accountType={form.account_type}
              />
            )}
            {currentStep === 4 && (
              <StepReview
                form={form}
                files={{
                  valid_id_front_file: validIdFrontFile,
                  valid_id_back_file: validIdBackFile,
                  business_permit_file: businessPermitFile,
                }}
                onEditStep={goToStep}
                onSubmit={handleSubmit}
                loading={loading}
              />
            )}
          </div>
        </div>

        {currentStep < 4 && (
          <div className="flex justify-between pt-2">
            {currentStep > 0 ? (
              <Button type="button" variant="outline" className="h-11 gap-1" onClick={goBack}>
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            ) : (
              <div />
            )}
            <Button
              type="button"
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-11 gap-2 font-semibold"
              onClick={goNext}
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        <p className="text-muted-foreground text-center text-sm">
          Already have an account?{' '}
          <a href="/login" className="text-primary font-semibold hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </AuthShell>
  );
}
