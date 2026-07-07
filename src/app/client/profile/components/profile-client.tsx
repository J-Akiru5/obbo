'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { updateNotificationPreferences, updateTinNo } from '@/lib/actions/client-actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Lock, ShieldCheck, Bell, Eye, EyeOff, Monitor, Globe } from 'lucide-react';
import { AvatarUpload } from '@/components/avatar-upload';

export default function ProfileClient({ profile, email }: { profile: any; email: string }) {
  // Password state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Notification preferences
  const defaultPrefs = profile?.notification_preferences || {
    order_approval: true,
    payment_required: true,
    dispatch: true,
    delivery_status: true,
  };
  const [prefs, setPrefs] = useState(defaultPrefs);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  // TIN state
  const [tinNo, setTinNo] = useState(profile?.tin_no || '');
  const [isSavingTin, setIsSavingTin] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      toast.error('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      toast.error('Password must be at least 6 characters.');
      return;
    }
    setPasswordError('');

    setIsUpdating(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setIsUpdating(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password updated successfully.');
      setPassword('');
      setConfirmPassword('');
    }
  };

  const handleSavePrefs = async () => {
    setIsSavingPrefs(true);
    try {
      await updateNotificationPreferences(prefs);
      toast.success('Notification preferences updated.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save preferences.';
      toast.error(msg);
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const handleSaveTin = async () => {
    setIsSavingTin(true);
    try {
      await updateTinNo(tinNo);
      toast.success('TIN No. updated successfully.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update TIN No.';
      toast.error(msg);
    } finally {
      setIsSavingTin(false);
    }
  };

  const togglePref = (key: string) => {
    setPrefs((prev: typeof prefs) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
  };

  if (!profile)
    return <div className="animate-pulse p-8 text-center text-gray-500">Loading profile...</div>;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-foreground text-2xl font-bold tracking-tight">Profile & Settings</h2>
        <p className="text-muted-foreground text-sm">
          Manage your account information and security preferences.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Business Information */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              Business Information
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Your verified details. Contact admin to update.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="mb-6 flex justify-center sm:justify-start">
              <AvatarUpload
                uid={profile.id}
                url={profile.avatar_url}
                fullName={profile.full_name}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                {profile.account_type === 'individual' ? 'Full Name' : 'Company Name'}
              </Label>
              <div className="text-foreground font-medium">
                {profile.account_type === 'individual'
                  ? profile.full_name
                  : profile.company_name || profile.full_name}
              </div>
            </div>
            {profile.account_type !== 'individual' && (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                  Contact Person
                </Label>
                <div className="text-foreground font-medium">{profile.full_name}</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                  Email
                </Label>
                <div className="text-foreground font-medium">{email}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                  Phone
                </Label>
                <div className="text-foreground font-medium">{profile.phone || 'Not provided'}</div>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                Business Address
              </Label>
              <div className="text-foreground text-sm font-medium">
                {[profile.address_street, profile.address_city, profile.address_province]
                  .filter(Boolean)
                  .join(', ') || 'Not provided'}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                TIN No.
              </Label>
              <div className="flex gap-2">
                <Input
                  value={tinNo}
                  onChange={(e) => setTinNo(e.target.value)}
                  placeholder="Enter TIN No."
                  className="h-9 text-sm"
                />
                <Button
                  onClick={handleSaveTin}
                  disabled={isSavingTin || tinNo === profile.tin_no}
                  size="sm"
                  className="bg-primary"
                >
                  {isSavingTin ? '...' : 'Save'}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 border-t pt-4 text-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="font-medium text-emerald-700">KYC Verified Account</span>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Lock className="text-muted-foreground h-5 w-5" />
              Security
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Update your password to keep your account secure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="sr-only" aria-live="polite" role="status"></div>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10"
                    aria-describedby="password-error"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="pr-10"
                    aria-describedby="password-error"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {passwordError && (
                <p id="password-error" className="text-destructive text-sm">
                  {passwordError}
                </p>
              )}
              <Button type="submit" className="bg-primary w-full" disabled={isUpdating}>
                {isUpdating ? 'Updating...' : 'Change Password'}
              </Button>
            </form>

            {/* Login Activity */}
            <div className="border-border mt-6 border-t pt-6">
              <h4 className="text-foreground mb-3 flex items-center gap-2 text-sm font-semibold">
                <Monitor className="text-muted-foreground h-4 w-4" />
                Recent Login Activity
              </h4>
              <div className="space-y-2">
                <div className="bg-muted/50 border-border flex items-center justify-between rounded-lg border p-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <Globe className="text-muted-foreground h-3.5 w-3.5" />
                    <span className="text-foreground">Current Session</span>
                  </div>
                  <span className="text-status-success-text text-xs font-medium">Active</span>
                </div>
                <p className="text-muted-foreground mt-1 text-[10px]">
                  Full login history is managed by the admin security team.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notification Preferences */}
      <Card className="bg-card border-border max-w-4xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Bell className="text-muted-foreground h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Choose which notifications you want to receive.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                key: 'order_approval',
                label: 'Order Approval',
                desc: 'When your order is approved or rejected by the admin',
              },
              {
                key: 'payment_required',
                label: 'Payment Required',
                desc: 'When payment is needed for an approved order',
              },
              {
                key: 'dispatch',
                label: 'Dispatch Updates',
                desc: 'When your order is dispatched from the warehouse',
              },
              {
                key: 'delivery_status',
                label: 'Delivery Status',
                desc: 'Real-time updates on in-transit and delivered shipments',
              },
            ].map((item) => (
              <div
                key={item.key}
                className="bg-muted/50 border-border flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="text-foreground text-sm font-medium">{item.label}</p>
                  <p className="text-muted-foreground text-xs">{item.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => togglePref(item.key)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    prefs[item.key as keyof typeof prefs] ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      prefs[item.key as keyof typeof prefs] ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
            <Button onClick={handleSavePrefs} disabled={isSavingPrefs} className="bg-primary mt-2">
              {isSavingPrefs ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
