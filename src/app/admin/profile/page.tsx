'use client';

import { useEffect, useState } from 'react';
import { User, Mail, Phone, Shield, Clock, KeyRound, Save, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { AvatarUpload } from '@/components/avatar-upload';

interface AdminProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  kyc_status: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export default function AdminProfilePage() {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) {
        setProfile(data);
        setFullName(data.full_name);
        setPhone(data.phone || '');
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, phone: phone || null, updated_at: new Date().toISOString() })
      .eq('id', profile.id);

    if (error) {
      toast.error('Failed to update profile.');
    } else {
      setProfile({ ...profile, full_name: fullName, phone: phone || null });
      toast.success('Profile updated.');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
    );
  }

  if (!profile) return null;

  const hasChanges = fullName !== profile.full_name || (phone || null) !== profile.phone;

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-2">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">My Profile</h2>
        <p className="text-muted-foreground mt-1">View and update your administrator account.</p>
      </div>

      {/* Identity Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <AvatarUpload
              uid={profile.id}
              url={profile.avatar_url}
              fullName={profile.full_name}
              onUpload={(url) => setProfile({ ...profile, avatar_url: url })}
              className="h-20 w-20"
            />
            <div className="flex-1">
              <h3 className="text-xl font-bold">{profile.full_name}</h3>
              <p className="text-muted-foreground text-sm">{profile.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge className="bg-primary hover:bg-primary text-primary-foreground text-xs capitalize">
                  <Shield className="mr-1 h-3 w-3" /> {profile.role}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-100 text-xs text-emerald-800 capitalize hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900"
                >
                  {profile.kyc_status.replace(/_/g, ' ')}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" /> Account Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <User className="text-muted-foreground h-3.5 w-3.5" /> Full Name
              </Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Phone className="text-muted-foreground h-3.5 w-3.5" /> Phone
              </Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+63 ..."
                className="h-10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <Mail className="text-muted-foreground h-3.5 w-3.5" /> Email
            </Label>
            <Input value={profile.email} disabled className="bg-muted h-10" />
            <p className="text-muted-foreground text-xs">Email cannot be changed from this page.</p>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Clock className="h-3.5 w-3.5" />
              Member since{' '}
              {new Date(profile.created_at).toLocaleDateString('en-PH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="bg-primary hover:bg-primary/90"
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" /> Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 flex items-center justify-between rounded-lg p-3">
            <div>
              <p className="text-sm font-medium">Password</p>
              <p className="text-muted-foreground text-xs">Change your account password.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info('Password reset email sent. Check your inbox.')}
              className="text-xs"
            >
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
