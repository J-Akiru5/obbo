'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  Database,
  Download,
  Globe,
  HardDrive,
  Info,
  KeyRound,
  Lock,
  Loader2,
  Mail,
  Moon,
  Monitor,
  Package,
  Palette,
  Phone,
  Save,
  Settings,
  ShieldAlert,
  Smartphone,
  Sun,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  fetchAuditLog,
  getAdminSetting,
  saveAdminSetting,
  getCostConfig,
  saveCostConfig,
} from '@/lib/actions/admin-actions';
import { createClient } from '@/lib/supabase/client';

import { useTheme } from 'next-themes';

function SettingRow({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border/60 flex flex-col gap-4 border-b py-5 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm">
          {icon}
        </div>
        <div className="space-y-1">
          <p className="text-foreground text-sm font-bold">{title}</p>
          <p className="text-muted-foreground max-w-md text-xs leading-relaxed">{description}</p>
        </div>
      </div>
      <div className="flex items-center sm:justify-end">{children}</div>
    </div>
  );
}

export default function AdminSettingsPage() {
  const { theme, setTheme } = useTheme();
  const [contactInfo, setContactInfo] = useState({
    email: '',
    phone: '',
    address: '',
    businessHours: '',
  });
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profile, setProfile] = useState<{
    id: string;
    email: string;
    full_name: string;
    phone: string | null;
    role: string;
  } | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Cost configuration
  const [costConfig, setCostConfig] = useState({
    landed_cost_per_bag: 147.64,
    local_expenses_per_bag: 20.0,
  });
  const [isSavingCost, setIsSavingCost] = useState(false);

  const GIT_SHA = 'f399c95';

  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPWA = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') {
      toast.success('App installed successfully!');
    }
    setInstallPrompt(null);
    setIsInstallable(false);
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const supabase = createClient();
        const [contact, logData, userData, costCfg] = await Promise.all([
          getAdminSetting('contact_info'),
          fetchAuditLog(1, 60),
          supabase.auth.getUser(),
          getCostConfig(),
        ]);

        if (contact) {
          setContactInfo(contact as any);
        }
        setCostConfig(costCfg);

        setAuditLogs(logData.entries);
        setSecurityEvents(
          logData.entries.filter(
            (entry) =>
              entry.action.includes('login') ||
              entry.action.includes('password') ||
              entry.action.includes('role') ||
              entry.action.includes('setting') ||
              entry.action.includes('kyc_rejected'),
          ),
        );

        const user = userData.data.user;
        if (user) {
          const { data } = await supabase
            .from('profiles')
            .select('id,email,full_name,phone,role')
            .eq('id', user.id)
            .single();
          if (data) {
            setProfile(data);
            setFullName(data.full_name || '');
            setPhone(data.phone || '');
          }
        }
      } catch (error) {
        console.error('Failed to load settings data', error);
      } finally {
        setLoadingLogs(false);
        setProfileLoading(false);
      }
    };

    void loadSettings();
  }, []);

  const handleSaveContact = async () => {
    setIsSavingContact(true);
    try {
      await saveAdminSetting('contact_info', contactInfo);
      toast.success('Contact information saved.');
    } catch {
      toast.error('Failed to save contact information.');
    } finally {
      setIsSavingContact(false);
    }
  };

  const handleSaveCostConfig = async () => {
    setIsSavingCost(true);
    try {
      await saveCostConfig(costConfig);
      toast.success('Cost configuration saved.');
    } catch {
      toast.error('Failed to save cost configuration.');
    } finally {
      setIsSavingCost(false);
    }
  };

  const handleSaveAccount = async () => {
    if (!profile) return;
    setSavingAccount(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) throw error;

      setProfile({ ...profile, full_name: fullName.trim(), phone: phone.trim() || null });
      toast.success('Account details updated.');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update account details.');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.trim().length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }

    setChangingPassword(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword.trim() });
      if (error) throw error;
      setNewPassword('');
      toast.success('Password updated.');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update password.');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="space-y-2">
        <div className="border-primary/15 bg-primary/8 text-primary inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.28em] uppercase">
          Settings
        </div>
        <div>
          <h2 className="text-foreground text-2xl font-bold tracking-tight">System controls</h2>
          <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-6">
            Manage appearance, contact information, login security visibility, immutable audit
            trails, and your own admin account.
          </p>
        </div>
      </header>

      <Tabs defaultValue="appearance" className="w-full">
        <TabsList className="bg-muted no-scrollbar flex h-auto w-full items-center justify-start gap-1 overflow-x-auto p-1 sm:grid sm:grid-cols-7 sm:gap-2">
          <TabsTrigger value="appearance" className="flex-shrink-0 px-4 py-2 sm:px-3">
            Appearance
          </TabsTrigger>
          <TabsTrigger value="contact" className="flex-shrink-0 px-4 py-2 sm:px-3">
            Contact Info
          </TabsTrigger>
          <TabsTrigger value="security" className="flex-shrink-0 px-4 py-2 sm:px-3">
            Login Security
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex-shrink-0 px-4 py-2 sm:px-3">
            System Audits
          </TabsTrigger>
          <TabsTrigger value="account" className="flex-shrink-0 px-4 py-2 sm:px-3">
            Admin Account
          </TabsTrigger>
          <TabsTrigger value="cost" className="flex-shrink-0 px-4 py-2 sm:px-3">
            Cost Config
          </TabsTrigger>
          <TabsTrigger value="app" className="flex-shrink-0 px-4 py-2 sm:px-3">
            <Smartphone className="mr-1.5 h-3.5 w-3.5" /> App
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="mt-6">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="h-4 w-4" /> Appearance
              </CardTitle>
              <CardDescription>Choose how the admin interface should be presented.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-0">
              <SettingRow
                icon={<Monitor className="text-muted-foreground h-4 w-4" />}
                title="Theme"
                description="Select system, light, or dark mode for your admin workspace."
              >
                <div className="bg-muted flex items-center gap-1 rounded-lg p-1">
                  {[
                    { value: 'system', icon: Monitor, label: 'System' },
                    { value: 'light', icon: Sun, label: 'Light' },
                    { value: 'dark', icon: Moon, label: 'Dark' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setTheme(option.value as 'system' | 'light' | 'dark');
                        toast.success(`Theme set to ${option.label}.`);
                      }}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${theme === option.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      <option.icon className="h-3.5 w-3.5" /> {option.label}
                    </button>
                  ))}
                </div>
              </SettingRow>

              <SettingRow
                icon={<Info className="text-muted-foreground h-4 w-4" />}
                title="System information"
                description="Basic platform details for support and maintenance."
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      icon: <HardDrive className="h-4 w-4 text-blue-500" />,
                      label: 'Platform',
                      value: 'Next.js 16',
                    },
                    {
                      icon: <Database className="h-4 w-4 text-emerald-500" />,
                      label: 'Database',
                      value: 'Supabase',
                    },
                    {
                      icon: <Settings className="h-4 w-4 text-amber-500" />,
                      label: 'Version',
                      value: `V. 1.${GIT_SHA}`,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="border-border bg-muted/30 flex items-center gap-3 rounded-xl border px-3 py-3"
                    >
                      {item.icon}
                      <div>
                        <p className="text-muted-foreground text-xs">{item.label}</p>
                        <p className="text-foreground text-sm font-semibold">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </SettingRow>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="mt-6">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="text-primary h-5 w-5" /> Public contact information
              </CardTitle>
              <CardDescription>
                This data is synced to the client portal whenever it is saved.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="support-email">Support email</Label>
                  <Input
                    id="support-email"
                    value={contactInfo.email}
                    onChange={(event) =>
                      setContactInfo({ ...contactInfo, email: event.target.value })
                    }
                    placeholder="support@obbo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="support-phone">Support phone</Label>
                  <Input
                    id="support-phone"
                    value={contactInfo.phone}
                    onChange={(event) =>
                      setContactInfo({ ...contactInfo, phone: event.target.value })
                    }
                    placeholder="+63 912 345 6789"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="physical-address">Physical address</Label>
                <Input
                  id="physical-address"
                  value={contactInfo.address}
                  onChange={(event) =>
                    setContactInfo({ ...contactInfo, address: event.target.value })
                  }
                  placeholder="123 Industrial Ave"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business-hours">Business hours</Label>
                <Input
                  id="business-hours"
                  value={contactInfo.businessHours}
                  onChange={(event) =>
                    setContactInfo({ ...contactInfo, businessHours: event.target.value })
                  }
                  placeholder="Mon - Fri, 8:00 AM - 5:00 PM"
                />
              </div>
              <Button
                onClick={handleSaveContact}
                disabled={isSavingContact}
                className="bg-primary hover:bg-primary/90"
              >
                <Save className="mr-2 h-4 w-4" />{' '}
                {isSavingContact ? 'Saving...' : 'Save contact info'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="text-primary h-5 w-5" /> Login security
              </CardTitle>
              <CardDescription>
                Recent auth-related and high-risk administrative events surfaced from the audit
                trail.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <div className="text-muted-foreground py-8 text-center text-sm">
                  Loading security events...
                </div>
              ) : securityEvents.length === 0 ? (
                <div className="border-border text-muted-foreground rounded-xl border border-dashed py-10 text-center text-sm">
                  No security events were recorded in the audit trail.
                </div>
              ) : (
                <div className="space-y-3">
                  {securityEvents.slice(0, 10).map((entry) => (
                    <div
                      key={entry.id}
                      className="border-border flex items-start justify-between gap-4 rounded-xl border px-4 py-3"
                    >
                      <div>
                        <p className="text-foreground text-sm font-medium">
                          {entry.action.replace(/_/g, ' ')}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {entry.actor?.full_name || 'System'} ·{' '}
                          {new Date(entry.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] tracking-wide uppercase">
                        Security
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="text-primary h-5 w-5" /> System audit log
                </CardTitle>
                <CardDescription>
                  Immutable record of administrative actions taken in the system.
                </CardDescription>
              </div>
              <div className="w-full sm:w-64">
                <Input
                  placeholder="Filter audits..."
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <div className="text-muted-foreground py-8 text-center text-sm">
                  Loading audit logs...
                </div>
              ) : (
                <div className="border-border overflow-x-auto rounded-xl border">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="w-[180px]">Timestamp</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Target ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.filter(
                        (log) =>
                          log.action.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
                          (log.actor?.full_name || '')
                            .toLowerCase()
                            .includes(auditSearchQuery.toLowerCase()) ||
                          (log.entity_type || '')
                            .toLowerCase()
                            .includes(auditSearchQuery.toLowerCase()),
                      ).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                            {auditSearchQuery
                              ? 'No matching audit logs found.'
                              : 'No audit logs found.'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        auditLogs
                          .filter(
                            (log) =>
                              log.action.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
                              (log.actor?.full_name || '')
                                .toLowerCase()
                                .includes(auditSearchQuery.toLowerCase()) ||
                              (log.entity_type || '')
                                .toLowerCase()
                                .includes(auditSearchQuery.toLowerCase()),
                          )
                          .map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="text-muted-foreground font-mono text-xs">
                                {new Date(log.created_at).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-sm font-medium">
                                {log.actor?.full_name || 'System'}
                              </TableCell>
                              <TableCell className="text-sm">
                                <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
                                  {log.action}
                                </code>
                              </TableCell>
                              <TableCell className="text-sm capitalize">
                                {String(log.entity_type).replace(/_/g, ' ')}
                              </TableCell>
                              <TableCell
                                className="text-muted-foreground font-mono text-xs"
                                title={log.entity_id}
                              >
                                {String(log.entity_id).slice(0, 8)}...
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="mt-6">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="text-primary h-5 w-5" /> Admin account
              </CardTitle>
              <CardDescription>
                Update your display name, contact phone, and password.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {profileLoading ? (
                <div className="text-muted-foreground py-8 text-center text-sm">
                  Loading account details...
                </div>
              ) : profile ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="full-name" className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" /> Full name
                      </Label>
                      <Input
                        id="full-name"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" /> Phone
                      </Label>
                      <Input
                        id="phone"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="+63 ..."
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" /> Email
                    </Label>
                    <Input id="email" value={profile.email} disabled className="bg-muted" />
                    <p className="text-muted-foreground text-xs">
                      Email changes are handled separately by the authentication provider.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-muted-foreground text-xs">
                      Role:{' '}
                      <span className="text-foreground font-medium capitalize">
                        {profile.role.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <Button
                      onClick={handleSaveAccount}
                      disabled={savingAccount}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Save className="mr-2 h-4 w-4" />{' '}
                      {savingAccount ? 'Saving...' : 'Save account details'}
                    </Button>
                  </div>

                  <Separator />

                  <div className="border-border bg-muted/20 space-y-3 rounded-xl border p-4">
                    <div>
                      <p className="text-foreground flex items-center gap-2 text-sm font-semibold">
                        <Lock className="text-primary h-4 w-4" /> Change password
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Enter a new password for your admin account.
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        placeholder="New password"
                        className="sm:max-w-xs"
                      />
                      <Button
                        variant="outline"
                        onClick={handleChangePassword}
                        disabled={changingPassword}
                      >
                        {changingPassword ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <KeyRound className="mr-2 h-4 w-4" />
                        )}{' '}
                        Update password
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground py-8 text-center text-sm">
                  No profile loaded.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cost" className="mt-6">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4" /> Cost Configuration
              </CardTitle>
              <CardDescription>
                Set the landed cost and local expenses per 40kg bag. These values are used to
                calculate gross and net profit on dispatch.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0">
              <SettingRow
                icon={<Package className="text-muted-foreground h-4 w-4" />}
                title="Landed Cost per Bag"
                description="Product cost from Vietnam + freight + duties + port handling (per 40kg bag)."
              >
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">₱</span>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={costConfig.landed_cost_per_bag}
                    onChange={(e) =>
                      setCostConfig({
                        ...costConfig,
                        landed_cost_per_bag: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-9 w-32 text-right"
                  />
                </div>
              </SettingRow>

              <SettingRow
                icon={<Package className="text-muted-foreground h-4 w-4" />}
                title="Local Expenses per Bag"
                description="Delivery from port to warehouse, rent, labor, forklift drivers, taxes, office staff (per 40kg bag)."
              >
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">₱</span>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={costConfig.local_expenses_per_bag}
                    onChange={(e) =>
                      setCostConfig({
                        ...costConfig,
                        local_expenses_per_bag: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-9 w-32 text-right"
                  />
                </div>
              </SettingRow>

              <div className="border-border mt-2 space-y-3 border-t pt-4">
                <div className="bg-muted/50 flex items-center justify-between rounded-lg p-3">
                  <span className="text-muted-foreground text-sm font-medium">
                    Total Cost per Bag
                  </span>
                  <span className="text-foreground text-lg font-bold">
                    ₱
                    {(
                      costConfig.landed_cost_per_bag + costConfig.local_expenses_per_bag
                    ).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <span className="text-sm font-medium text-emerald-700">
                    Gross Profit per Bag (at ₱185)
                  </span>
                  <span className="text-lg font-bold text-emerald-700">
                    ₱
                    {(185 - costConfig.landed_cost_per_bag).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <span className="text-sm font-medium text-blue-700">
                    Net Profit per Bag (at ₱185)
                  </span>
                  <span className="text-lg font-bold text-blue-700">
                    ₱
                    {(
                      185 -
                      costConfig.landed_cost_per_bag -
                      costConfig.local_expenses_per_bag
                    ).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSaveCostConfig}
                  disabled={isSavingCost}
                  className="bg-primary gap-2"
                >
                  {isSavingCost ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isSavingCost ? 'Saving...' : 'Save Cost Configuration'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="app" className="mt-6">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Smartphone className="h-4 w-4" /> App Installation
              </CardTitle>
              <CardDescription>
                Install OBBO iManage as a standalone app on your device or download the Android APK.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0">
              <SettingRow
                icon={<Download className="text-muted-foreground h-4 w-4" />}
                title="Install as App (PWA)"
                description="Add OBBO iManage to your home screen for quick access. Works on Android, iOS, and desktop."
              >
                {isInstallable ? (
                  <Button onClick={handleInstallPWA} className="bg-primary gap-2">
                    <Download className="h-4 w-4" /> Install App
                  </Button>
                ) : (
                  <div className="text-muted-foreground text-xs">
                    Open this page in a Chromium-based browser (Chrome, Edge) to install.
                  </div>
                )}
              </SettingRow>

              <SettingRow
                icon={<Smartphone className="text-muted-foreground h-4 w-4" />}
                title="How to install manually"
                description="If the install button is not available, use your browser's menu."
              >
                <div className="text-muted-foreground max-w-sm space-y-2 text-xs">
                  <p>
                    <strong className="text-foreground">Android (Chrome):</strong> Tap the ⋮ menu →
                    &quot;Add to Home screen&quot;
                  </p>
                  <p>
                    <strong className="text-foreground">iOS (Safari):</strong> Tap the Share button
                    → &quot;Add to Home Screen&quot;
                  </p>
                  <p>
                    <strong className="text-foreground">Desktop (Chrome/Edge):</strong> Click the
                    install icon (⊕) in the address bar
                  </p>
                </div>
              </SettingRow>

              <SettingRow
                icon={<Download className="text-muted-foreground h-4 w-4" />}
                title="Android APK"
                description="Download the standalone Android APK for direct installation without using a browser."
              >
                <Button variant="outline" disabled className="gap-2">
                  <Download className="h-4 w-4" /> Coming Soon
                </Button>
              </SettingRow>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
