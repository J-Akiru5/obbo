import { useState } from "react";
import { PurchaseOrder, Profile } from "@/lib/types/database";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit2, MapPin, Truck, UploadCloud, CheckCircle2, X, FileImage, AlertTriangle, Eye, LayoutGrid, List, Check, ChevronsUpDown } from "lucide-react";
import { createPurchaseOrder, updatePurchaseOrder, generateAdminPoNumber } from "@/lib/actions/admin-actions";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export function PoListTab({ purchaseOrders, loading, onReload }: { purchaseOrders: PurchaseOrder[], loading: boolean, onReload: () => void }) {
    const [viewMode, setViewMode] = useState<"list" | "grid">("list");
    const [searchQuery, setSearchQuery] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [viewingPo, setViewingPo] = useState<PurchaseOrder | null>(null);
    const [editingPo, setEditingPo] = useState<PurchaseOrder | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Client search state
    const [clients, setClients] = useState<Profile[]>([]);
    const [clientId, setClientId] = useState<string | null>(null);
    const [clientOpen, setClientOpen] = useState(false);

    // Form state
    const [poNumber, setPoNumber] = useState("");
    const [clientName, setClientName] = useState("");
    const [jbQty, setJbQty] = useState(0);
    const [sbQty, setSbQty] = useState(0);
    const [source, setSource] = useState("warehouse");
    const [serviceType, setServiceType] = useState("pickup");
    const [checkNumber, setCheckNumber] = useState("");
    const [checkAmount, setCheckAmount] = useState(0);
    const [cashAmount, setCashAmount] = useState(0);
    const [photoFile, setPhotoFile] = useState<File | null>(null);

    const fetchClients = async () => {
        try {
            const supabase = createClient();
            const { data } = await supabase
                .from("profiles")
                .select("*")
                .eq("role", "client")
                .eq("kyc_status", "verified")
                .order("company_name", { ascending: true })
                .order("full_name", { ascending: true });
            setClients(data ?? []);
        } catch (e) {
            console.error("Error fetching clients:", e);
        }
    };

     const openCreate = async () => {
        setEditingPo(null);
        setJbQty(0); setSbQty(0);
        setClientName("");
        setClientId(null);
        setPhotoFile(null);
        fetchClients();
        setIsDialogOpen(true);
        
        // Fetch next PO number as a suggestion
        const nextPo = await generateAdminPoNumber();
        setPoNumber(nextPo);
    };

    const openEdit = (po: PurchaseOrder) => {
        setEditingPo(po);
        setPoNumber(po.po_number);
        setClientName(po.client_name || "");
        setClientId(po.client_id || null);
        setJbQty(po.jb || 0);
        setSbQty(po.sb || 0);
        setSource(po.source || "warehouse");
        setServiceType(po.service_type || "pickup");
        setCheckNumber(po.check_number || "");
        setCheckAmount(po.check_amount || 0);
        setCashAmount(po.cash_amount || 0);
        setPhotoFile(null);
        fetchClients();
        setIsDialogOpen(true);
    };

    const handleSubmit = async () => {
        if (!poNumber.trim()) {
            toast.error("PO Number is required.");
            return;
        }
        if (!photoFile && !editingPo?.photo_url) {
            toast.error("PO Photo is required.");
            return;
        }
        setIsSubmitting(true);
        try {
            // Upload photo if provided
            let photoUrl: string | undefined;
            if (photoFile) {
                const supabase = createClient();
                const ext = photoFile.name.split(".").pop();
                const fileName = `po_${poNumber.replace(/\//g, "-")}_${Date.now()}.${ext}`;
                const { error: uploadError } = await supabase.storage
                    .from("order-attachments")
                    .upload(fileName, photoFile, { upsert: true });
                if (!uploadError) {
                    const { data: { publicUrl } } = supabase.storage
                        .from("order-attachments")
                        .getPublicUrl(fileName);
                    photoUrl = publicUrl;
                }
            }

            if (editingPo) {
                await updatePurchaseOrder(editingPo.id, {
                    po_number: poNumber, client_name: clientName, client_id: clientId,
                    jb: jbQty, sb: sbQty,
                    source, service_type: serviceType,
                    check_number: checkNumber || null,
                    check_amount: checkAmount || null,
                    cash_amount: cashAmount || null,
                    ...(photoUrl ? { photo_url: photoUrl } : {}),
                });
                toast.success("PO updated");
            } else {
                await createPurchaseOrder({
                    po_number: poNumber, client_name: clientName, client_id: clientId,
                    jb: jbQty, sb: sbQty,
                    source, service_type: serviceType,
                    check_number: checkNumber || null,
                    check_amount: checkAmount || null,
                    cash_amount: cashAmount || null,
                    ...(photoUrl ? { photo_url: photoUrl } : {}),
                });
                toast.success("PO created");
            }
            setIsDialogOpen(false);
            setPhotoFile(null);
            onReload();
        } catch (e: any) {
            toast.error(e.message || "Failed to save PO");
        } finally {
            setIsSubmitting(false);
        }
    };

    const filtered = purchaseOrders.filter(po =>
        po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (po.client_name || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) return <div className="py-8 text-center text-muted-foreground animate-pulse">Loading PO list...</div>;

    return (
        <Card>
            <CardContent className="p-4 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input type="search" placeholder="Search PO or Client..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="flex items-center border rounded-md p-1 bg-muted/30">
                            <Button 
                                variant={viewMode === "list" ? "secondary" : "ghost"} 
                                size="sm" 
                                className="h-8 w-8 p-0" 
                                onClick={() => setViewMode("list")}
                                title="List View"
                            >
                                <List className="h-4 w-4" />
                            </Button>
                            <Button 
                                variant={viewMode === "grid" ? "secondary" : "ghost"} 
                                size="sm" 
                                className="h-8 w-8 p-0" 
                                onClick={() => setViewMode("grid")}
                                title="Grid View"
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                        </div>
                        <Button onClick={openCreate} className="bg-primary shrink-0 flex-1 sm:flex-none"><Plus className="w-4 h-4 mr-2" /> Add Manual PO</Button>
                    </div>
                </div>

                {viewMode === "list" ? (
                    <div className="border rounded-lg overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>PO #</TableHead>
                                    <TableHead>Client Name</TableHead>
                                    <TableHead>Service</TableHead>
                                    <TableHead className="text-right">Quantity</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Check No.</TableHead>
                                    <TableHead>Cash</TableHead>
                                    <TableHead>Image</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.length === 0 ? (
                                    <TableRow><TableCell colSpan={10} className="text-center py-6 text-muted-foreground">No purchase orders found.</TableCell></TableRow>
                                ) : filtered.map(po => (
                                    <TableRow key={po.id} className={po.order_id ? "bg-primary/5" : ""}>
                                        <TableCell className="text-sm whitespace-nowrap">{new Date(po.date).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            <span className="font-semibold text-sm">{po.po_number}</span>
                                            {po.order_id && (
                                                <Badge variant="outline" className="ml-2 text-[9px] border-primary/20 text-primary bg-primary/5">AUTO</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm">{po.client_name || "—"}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase font-bold whitespace-nowrap">
                                                {po.service_type === 'deliver' ? <Truck className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                                                {po.service_type === 'deliver' ? 'Delivery' : 'Pick-up'}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-sm">{po.jb + po.sb}</TableCell>
                                        <TableCell className="text-sm">
                                            <Badge variant="outline" className="font-mono text-[10px]">{po.jb > 0 ? "JB" : "SB"}</Badge>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {po.check_number ? (
                                                <div>
                                                    <span className="font-medium">{po.check_number}</span>
                                                    {po.check_amount ? (
                                                        <p className="text-[10px] text-muted-foreground">₱{Number(po.check_amount).toLocaleString()}</p>
                                                    ) : null}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {po.cash_amount ? (
                                                <span className="font-medium">₱{Number(po.cash_amount).toLocaleString()}</span>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {po.photo_url ? (
                                                <a href={po.photo_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center h-8 w-8 text-primary hover:text-primary/90 hover:bg-primary/10 rounded-md">
                                                    <FileImage className="w-4 h-4" />
                                                </a>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right whitespace-nowrap">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => { setViewingPo(po); setIsViewOpen(true); }} 
                                                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => openEdit(po)} className="h-8 w-8 text-primary hover:text-primary/90 hover:bg-primary/10"><Edit2 className="w-4 h-4" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filtered.length === 0 ? (
                            <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                                No purchase orders found.
                            </div>
                        ) : filtered.map(po => (
                            <Card key={po.id} className="overflow-hidden group hover:shadow-md transition-shadow border-muted">
                                <div className="aspect-[4/3] relative bg-muted flex items-center justify-center overflow-hidden">
                                    {po.photo_url ? (
                                        <img src={po.photo_url} alt={po.po_number} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                    ) : (
                                        <div className="flex flex-col items-center text-muted-foreground/40">
                                            <FileImage className="w-10 h-10 mb-2" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest">No Document</span>
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button size="icon" variant="secondary" className="h-8 w-8 shadow-sm" onClick={() => { setViewingPo(po); setIsViewOpen(true); }}><Eye className="h-4 w-4 text-emerald-600" /></Button>
                                        <Button size="icon" variant="secondary" className="h-8 w-8 shadow-sm" onClick={() => openEdit(po)}><Edit2 className="h-4 w-4 text-primary" /></Button>
                                    </div>
                                    <div className="absolute top-2 left-2">
                                        <Badge variant="secondary" className="bg-white/90 backdrop-blur-sm text-foreground border-none text-[10px] shadow-sm">
                                            {new Date(po.date).toLocaleDateString()}
                                        </Badge>
                                    </div>
                                </div>
                                <CardContent className="p-3 space-y-3">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold truncate text-foreground">{po.po_number}</p>
                                            <p className="text-xs text-muted-foreground truncate">{po.client_name || "Unknown Client"}</p>
                                        </div>
                                        {po.order_id && <Badge variant="outline" className="text-[9px] bg-primary/5 text-primary border-primary/10 h-5 shrink-0">AUTO</Badge>}
                                    </div>
                                    
                                    <div className="flex items-center gap-3 py-2 border-y border-muted/50">
                                        <div className="flex-1">
                                            <p className="text-[9px] text-muted-foreground font-bold uppercase">Quantity</p>
                                            <p className="text-sm font-bold">{po.jb + po.sb}</p>
                                        </div>
                                        <div className="w-px h-6 bg-muted"></div>
                                        <div className="flex-1">
                                            <p className="text-[9px] text-muted-foreground font-bold uppercase">Type</p>
                                            <Badge variant="outline" className="text-[9px] font-mono h-4 px-1">{po.jb > 0 ? "JB" : "SB"}</Badge>
                                        </div>
                                        <div className="w-px h-6 bg-muted"></div>
                                        <div className="flex-1 text-right">
                                            <div className="inline-flex items-center text-[10px] text-muted-foreground font-bold uppercase">
                                                {po.service_type === 'deliver' ? <Truck className="w-3 h-3 mr-1" /> : <MapPin className="w-3 h-3 mr-1" />}
                                                {po.service_type === 'deliver' ? 'DLV' : 'PCK'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="text-[10px]">
                                            {po.check_number ? (
                                                <div className="text-muted-foreground">CHK: <span className="text-foreground font-medium">{po.check_number}</span></div>
                                            ) : po.cash_amount ? (
                                                <div className="text-muted-foreground">CASH: <span className="text-foreground font-medium">₱{Number(po.cash_amount).toLocaleString()}</span></div>
                                            ) : (
                                                <span className="text-muted-foreground italic">No payment</span>
                                            )}
                                        </div>
                                        <Badge variant="outline" className="text-[9px] capitalize px-1.5 h-5 bg-muted/20">{po.status}</Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </CardContent>

            {/* Create / Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setPhotoFile(null); }}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingPo ? "Edit Purchase Order" : "Add Manual Purchase Order"}</DialogTitle>
                        <DialogDescription>
                            {editingPo ? "Update the details of this purchase order." : "Create a manual PO entry for walk-in or offline transactions."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>PO Number <span className="text-red-500">*</span></Label>
                            <Input value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="e.g. PO-2026-001" />
                        </div>
                        <div className="space-y-2">
                            <Label>Client Name</Label>
                            <Popover open={clientOpen} onOpenChange={setClientOpen}>
                                <PopoverTrigger>
                                    <div className="w-full flex items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm cursor-pointer hover:border-primary/50 transition-colors">
                                        <span className={clientName ? "" : "text-muted-foreground"}>
                                            {clientName || "Select a verified client..."}
                                        </span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                                    </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--anchor-width)] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Search clients..." />
                                        <CommandList>
                                            <CommandEmpty>No verified clients found.</CommandEmpty>
                                            <CommandGroup>
                                                {clients.map((client) => {
                                                    const displayName = client.company_name || client.full_name;
                                                    return (
                                                        <CommandItem
                                                            key={client.id}
                                                            value={displayName}
                                                            onSelect={() => {
                                                                setClientName(displayName);
                                                                setClientId(client.id);
                                                                setClientOpen(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    clientId === client.id ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {displayName}
                                                        </CommandItem>
                                                    );
                                                })}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Service</Label>
                                <Select value={serviceType} onValueChange={(v) => setServiceType(v || "")}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pickup">Pick-up</SelectItem>
                                        <SelectItem value="deliver">Delivery</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Source</Label>
                                <Select value={source} onValueChange={(v) => setSource(v || "")}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="warehouse">Warehouse</SelectItem>
                                        <SelectItem value="port">Port</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Quantity JB (Jumbo Bag)</Label>
                                <Input 
                                    type="number" 
                                    min="0" 
                                    value={jbQty || ""} 
                                    placeholder="0" 
                                    onChange={e => setJbQty(parseInt(e.target.value) || 0)} 
                                    className="font-bold"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Quantity SB (Sling Bag)</Label>
                                <Input 
                                    type="number" 
                                    min="0" 
                                    value={sbQty || ""} 
                                    placeholder="0" 
                                    onChange={e => setSbQty(parseInt(e.target.value) || 0)} 
                                    className="font-bold"
                                />
                            </div>
                        </div>

                        <div className="border-t pt-4 space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment Details</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Check No.</Label>
                                    <Input value={checkNumber} onChange={e => setCheckNumber(e.target.value)} placeholder="Check number" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Check Amount (₱)</Label>
                                    <Input type="number" min="0" value={checkAmount || ""} placeholder="0" onChange={e => {
                                        const val = parseFloat(e.target.value) || 0;
                                        setCheckAmount(val);
                                        if (val > 0) setCashAmount(0);
                                    }} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Cash Amount (₱)</Label>
                                <Input type="number" min="0" value={cashAmount || ""} placeholder="0" onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setCashAmount(val);
                                    if (val > 0) {
                                        setCheckAmount(0);
                                        setCheckNumber("");
                                    }
                                }} />
                            </div>
                        </div>

                        {/* Photo Upload */}
                        <div className="space-y-2">
                            <Label>PO Photo <span className="text-red-500">*</span></Label>
                            {photoFile ? (
                                <div className="flex items-center gap-3 p-3 border border-emerald-200 bg-emerald-50 rounded-lg">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span className="text-sm text-emerald-800 flex-1 truncate">{photoFile.name}</span>
                                    <button type="button" onClick={() => setPhotoFile(null)} className="text-emerald-700 hover:text-red-600">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div
                                    className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                                    onClick={() => document.getElementById("po-photo-upload")?.click()}
                                >
                                    <UploadCloud className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                                    <p className="text-xs text-muted-foreground">Click to attach PO photo</p>
                                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">JPG, PNG, PDF</p>
                                    <input
                                        id="po-photo-upload"
                                        type="file"
                                        className="hidden"
                                        accept="image/*,.pdf"
                                        onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-primary">
                            {isSubmitting ? "Saving..." : editingPo ? "Update PO" : "Create PO"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Details Dialog */}
            <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Purchase Order Details</DialogTitle>
                        <DialogDescription>Full details for PO {viewingPo?.po_number}</DialogDescription>
                    </DialogHeader>
                    {viewingPo && (
                        <div className="space-y-6 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">PO Number</p>
                                    <p className="text-sm font-semibold">{viewingPo.po_number}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Date</p>
                                    <p className="text-sm">{new Date(viewingPo.date).toLocaleDateString()}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Client</p>
                                    <p className="text-sm font-medium">{viewingPo.client_name || "—"}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Status</p>
                                    <Badge variant="outline" className="capitalize">{viewingPo.status}</Badge>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-t pt-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Quantity</p>
                                    <p className="text-sm font-bold">{viewingPo.jb + viewingPo.sb} individual bags</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Bag Type</p>
                                    <p className="text-sm font-bold">{viewingPo.jb > 0 ? "Jumbo Bag (JB)" : "Sling Bag (SB)"}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Service Type</p>
                                    <p className="text-sm capitalize">{viewingPo.service_type || "—"}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Source</p>
                                    <p className="text-sm capitalize">{viewingPo.source || "—"}</p>
                                </div>
                            </div>

                            <div className="space-y-3 border-t pt-4">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Payment Information</p>
                                <div className="grid grid-cols-2 gap-4">
                                    {viewingPo.check_number ? (
                                        <>
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground">Check No.</p>
                                                <p className="text-sm font-medium">{viewingPo.check_number}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground">Amount</p>
                                                <p className="text-sm font-bold">₱{Number(viewingPo.check_amount).toLocaleString()}</p>
                                            </div>
                                        </>
                                    ) : viewingPo.cash_amount ? (
                                        <div className="space-y-1">
                                            <p className="text-xs text-muted-foreground">Cash Amount</p>
                                            <p className="text-sm font-bold">₱{Number(viewingPo.cash_amount).toLocaleString()}</p>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic">No payment data recorded</p>
                                    )}
                                </div>
                            </div>

                            {viewingPo.photo_url && (
                                <div className="space-y-2 border-t pt-4">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">PO Document</p>
                                    <div className="relative aspect-[4/3] rounded-lg border overflow-hidden bg-muted group">
                                        <img src={viewingPo.photo_url} alt="PO Document" className="w-full h-full object-contain" />
                                        <a 
                                            href={viewingPo.photo_url} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Button variant="secondary" size="sm">Open Original</Button>
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setIsViewOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </Card>
    );
}
