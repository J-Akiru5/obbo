import { useState } from "react";
import Image from "next/image";
import { Product } from "@/lib/types/database";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Package, UploadCloud, Loader2, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function ProductCatalogTab({ products, onUpdate, loading }: { products: Product[], onUpdate: (id: string, updates: Partial<Product>) => Promise<void>, loading: boolean }) {
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [editPrices, setEditPrices] = useState({ port: 0, warehouse: 0 });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [bagTypeFilter, setBagTypeFilter] = useState("all");

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              p.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === "all" || 
                              (statusFilter === "active" && p.is_active) || 
                              (statusFilter === "inactive" && !p.is_active);
        const matchesBagType = bagTypeFilter === "all" || p.bag_type === bagTypeFilter;
        
        return matchesSearch && matchesStatus && matchesBagType;
    });

    const openEdit = (product: Product) => {
        setEditingProduct(product);
        setEditPrices({ port: product.price_port ?? product.price_per_bag, warehouse: product.price_warehouse ?? product.price_per_bag });
        setImageFile(null);
        setImagePreview(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            // Generate preview URL for display
            const reader = new FileReader();
            reader.onload = (ev) => setImagePreview(ev.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (!editingProduct) return;
        setIsSaving(true);
        try {
            let newImageUrl = editingProduct.image_url;

            if (imageFile) {
                setIsUploadingImage(true);
                const supabase = createClient();
                const fileExt = imageFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
                // Use a stable filename per product — overwrites the old image automatically
                const fileName = `product_${editingProduct.id}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('product-images')
                    .upload(fileName, imageFile, {
                        upsert: true,          // Replace if already exists
                        cacheControl: '3600',  // 1 hour browser cache
                        contentType: imageFile.type,
                    });

                if (uploadError) {
                    // Surface the actual Supabase error for easier debugging
                    throw new Error(`Image upload failed: ${uploadError.message}`);
                }

                const { data: { publicUrl } } = supabase.storage
                    .from('product-images')
                    .getPublicUrl(fileName);

                // Append cache-buster so the new image shows without hard-refresh
                newImageUrl = `${publicUrl}?t=${Date.now()}`;
                setIsUploadingImage(false);
            }

            await onUpdate(editingProduct.id, {
                price_port: editPrices.port,
                price_warehouse: editPrices.warehouse,
                price_per_bag: editPrices.warehouse, // Fallback for legacy
                image_url: newImageUrl
            });
            toast.success("Product updated successfully.");
            setEditingProduct(null);
            setImagePreview(null);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to update product.";
            toast.error(message);
        } finally {
            setIsSaving(false);
            setIsUploadingImage(false);
        }
    };

    const toggleActive = async (product: Product) => {
        await onUpdate(product.id, { is_active: !product.is_active });
    };

    if (loading) return <div className="py-8 text-center text-muted-foreground text-sm animate-pulse">Loading products...</div>;

    return (
        <Card>
            <CardHeader className="pb-3 border-b border-border/50 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">Product Catalog</CardTitle>
                        <CardDescription>Manage available cement products and pricing.</CardDescription>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search products by name or description..."
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full sm:w-[150px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={bagTypeFilter} onValueChange={setBagTypeFilter}>
                        <SelectTrigger className="w-full sm:w-[150px]">
                            <SelectValue placeholder="Bag Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Bag Types</SelectItem>
                            <SelectItem value="JB">Jumbo Bag (JB)</SelectItem>
                            <SelectItem value="SB">Sling Bag (SB)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[80px]">Product</TableHead>
                            <TableHead>Details</TableHead>
                            <TableHead className="text-right">Port Price</TableHead>
                            <TableHead className="text-right">Warehouse Price</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredProducts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    No products match your filters.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredProducts.map((p) => (
                            <TableRow key={p.id} className="group">
                                <TableCell>
                                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                                        {p.image_url ? (
                                            <Image
                                                src={p.image_url}
                                                alt={p.name}
                                                width={48}
                                                height={48}
                                                className="w-full h-full object-cover rounded-lg"
                                                unoptimized
                                            />
                                        ) : (
                                            <Package className="w-6 h-6 text-muted-foreground" />
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <p className="font-semibold text-sm">{p.name}</p>
                                    <p className="text-xs text-muted-foreground flex gap-2">
                                        <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider">{p.bag_type}</Badge>
                                        <span className="truncate max-w-[200px]">{p.description}</span>
                                    </p>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    ₱{(p.price_port ?? p.price_per_bag).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-right font-medium text-[var(--color-industrial-blue)]">
                                    ₱{(p.price_warehouse ?? p.price_per_bag).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-center">
                                    <Badge variant={p.is_active ? "default" : "secondary"} className={p.is_active ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" : ""}>
                                        {p.is_active ? "Active" : "Inactive"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => toggleActive(p)} className="text-xs">
                                            {p.is_active ? "Disable" : "Enable"}
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => openEdit(p)} className="text-xs border-[var(--color-industrial-blue)] text-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)] hover:text-white">
                                            <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )))}
                    </TableBody>
                </Table>
            </CardContent>

            <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Prices: {editingProduct?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Port Price (₱)</Label>
                            <Input 
                                type="number" 
                                value={editPrices.port} 
                                onChange={(e) => setEditPrices({ ...editPrices, port: Number(e.target.value) })} 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Warehouse Price (₱)</Label>
                            <Input 
                                type="number" 
                                value={editPrices.warehouse} 
                                onChange={(e) => setEditPrices({ ...editPrices, warehouse: Number(e.target.value) })} 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="productImage">Product Image</Label>

                            {/* Image preview */}
                            {(imagePreview || editingProduct?.image_url) && (
                                <div className="relative w-full h-36 rounded-lg overflow-hidden border border-border bg-muted">
                                    <Image
                                        src={imagePreview ?? editingProduct!.image_url!}
                                        alt="Product preview"
                                        fill
                                        className="object-contain"
                                        unoptimized
                                    />
                                </div>
                            )}

                            <div className="rounded-lg border border-dashed border-border p-3">
                                <label htmlFor="productImage" className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                    <UploadCloud className="h-4 w-4 flex-shrink-0" />
                                    <span className="truncate">
                                        {imageFile ? imageFile.name : (editingProduct?.image_url ? "Replace existing image" : "Upload an image (JPG, PNG, WebP)")}
                                    </span>
                                </label>
                                <Input
                                    id="productImage"
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    className="mt-2"
                                    onChange={handleFileChange}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">Max file size: 5 MB. Accepted: JPG, PNG, WebP, GIF.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingProduct(null)} disabled={isSaving}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving} className="bg-[var(--color-industrial-blue)] gap-2">
                            {isSaving ? (
                                <><Loader2 className="h-4 w-4 animate-spin" />{isUploadingImage ? "Uploading image..." : "Saving..."}</>
                            ) : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
