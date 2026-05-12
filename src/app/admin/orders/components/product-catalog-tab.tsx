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
import { Edit, Package, UploadCloud, Loader2, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface ProductCatalogTabProps {
    products: Product[];
    onUpdate: (id: string, updates: Partial<Product>) => Promise<void>;
    onCreate?: (product: any) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
    loading: boolean;
}

export function ProductCatalogTab({ products, onUpdate, onCreate, onDelete, loading }: ProductCatalogTabProps) {
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    
    // Form state (used for both edit and create)
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        bag_type: "JB",
        port: 0,
        warehouse: 0
    });

    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const filteredProducts = products.filter(p =>
        (p.name.toLowerCase().includes("portland cement type 1") || p.name.toLowerCase().includes("portland cement type i"))
        && (p.bag_type === "SB" || p.bag_type === "JB")
    );

    const openCreate = () => {
        setFormData({
            name: "Portland Cement Type 1",
            description: "",
            bag_type: "JB",
            port: 0,
            warehouse: 0
        });
        setImageFile(null);
        setImagePreview(null);
        setIsCreating(true);
    };

    const openEdit = (product: Product) => {
        setEditingProduct(product);
        setFormData({
            name: product.name,
            description: product.description,
            bag_type: product.bag_type,
            port: product.price_port ?? product.price_per_bag,
            warehouse: product.price_warehouse ?? product.price_per_bag
        });
        setImageFile(null);
        setImagePreview(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onload = (ev) => setImagePreview(ev.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const uploadImage = async (productId: string, file: File): Promise<string> => {
        setIsUploadingImage(true);
        const supabase = createClient();
        const fileExt = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
        const fileName = `product_${productId}_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(fileName, file, {
                upsert: true,
                cacheControl: '3600',
                contentType: file.type,
            });

        if (uploadError) {
            throw new Error(`Image upload failed: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(fileName);

        setIsUploadingImage(false);
        return publicUrl;
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (isCreating && onCreate) {
                // For create, we first create the product, then upload image if needed and update
                const newProductData = {
                    name: formData.name,
                    description: formData.description,
                    bag_type: formData.bag_type,
                    price_port: formData.port,
                    price_warehouse: formData.warehouse,
                    price_per_bag: formData.warehouse, // legacy
                    is_active: true
                };
                
                // We don't have the ID yet, but our backend action returns the created product data
                // In this setup, we'll let onCreate handle the database insert, but we need to upload the image first
                // A better approach is to upload with a temporary name, or just use the action.
                // We'll pass the image later or let the admin action handle it.
                // Since `onCreate` doesn't return the ID in our current setup (it returns void because it's wrapped in page.tsx),
                // we'll just generate a random ID for the image name if needed.
                let imageUrl = null;
                if (imageFile) {
                    imageUrl = await uploadImage(Date.now().toString(), imageFile);
                }

                await onCreate({ ...newProductData, image_url: imageUrl });
                setIsCreating(false);
            } else if (editingProduct) {
                let newImageUrl = editingProduct.image_url;

                if (imageFile) {
                    newImageUrl = await uploadImage(editingProduct.id, imageFile);
                }

                await onUpdate(editingProduct.id, {
                    name: formData.name,
                    description: formData.description,
                    bag_type: formData.bag_type as 'JB' | 'SB',
                    price_port: formData.port,
                    price_warehouse: formData.warehouse,
                    price_per_bag: formData.warehouse, // Fallback for legacy
                    image_url: newImageUrl
                });
                setEditingProduct(null);
            }
            setImagePreview(null);
            setImageFile(null);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to save product.";
            // toast is already handled in page.tsx for create, but we handle it here for image errors
            if (err instanceof Error && err.message.includes('upload')) toast.error(message);
        } finally {
            setIsSaving(false);
            setIsUploadingImage(false);
        }
    };

    const handleDelete = async () => {
        if (!productToDelete || !onDelete) return;
        setIsDeleting(true);
        try {
            await onDelete(productToDelete.id);
            setProductToDelete(null);
        } catch (err) {
            // Error is handled in page.tsx
        } finally {
            setIsDeleting(false);
        }
    };

    const toggleActive = async (product: Product) => {
        await onUpdate(product.id, { is_active: !product.is_active });
    };

    if (loading) return <div className="py-8 text-center text-muted-foreground text-sm animate-pulse">Loading products...</div>;

    const modalOpen = isCreating || !!editingProduct;
    const modalTitle = isCreating ? "Create New Product" : `Edit Product: ${editingProduct?.name}`;

    return (
        <Card>
            <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-lg">Product Catalog</CardTitle>
                        <CardDescription>Manage Portland Cement Type 1 pricing (SB &amp; JB).</CardDescription>
                    </div>
                    {onCreate && (
                        <Button onClick={openCreate} className="bg-[var(--color-industrial-blue)] gap-2 w-full sm:w-auto">
                            <Plus className="w-4 h-4" /> Create Product
                        </Button>
                    )}
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/30 rounded-lg text-xs text-blue-700 dark:text-blue-400">
                    Product catalog is restricted to <span className="font-semibold">Portland Cement Type 1</span> (SB &amp; JB).
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {/* Mobile View: Cards */}
                <div className="grid grid-cols-1 gap-4 p-4 lg:hidden">
                    {filteredProducts.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">No products found.</div>
                    ) : (
                        filteredProducts.map((p) => (
                            <div key={p.id} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                        {p.image_url ? (
                                            <Image src={p.image_url} alt={p.name} width={64} height={64} className="w-full h-full object-cover" unoptimized />
                                        ) : (
                                            <Package className="w-8 h-8 text-muted-foreground" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant={p.is_active ? "default" : "secondary"} className={p.is_active ? "bg-emerald-100 text-emerald-800 text-[10px] h-5" : "text-[10px] h-5"}>
                                                {p.is_active ? "Active" : "Inactive"}
                                            </Badge>
                                            <Badge variant="outline" className="text-[10px] uppercase font-mono h-5">{p.bag_type}</Badge>
                                        </div>
                                        <h4 className="font-bold text-sm truncate">{p.name}</h4>
                                        <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 border-y border-border/50 py-3">
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Port Price</p>
                                        <p className="text-sm font-bold text-foreground">₱{(p.price_port ?? p.price_per_bag).toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-[var(--color-industrial-blue)] mb-1">Warehouse Price</p>
                                        <p className="text-sm font-bold text-[var(--color-industrial-blue)]">₱{(p.price_warehouse ?? p.price_per_bag).toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => openEdit(p)} className="flex-1 text-xs border-[var(--color-industrial-blue)] text-[var(--color-industrial-blue)]">
                                        <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => toggleActive(p)} className="flex-1 text-xs">
                                        {p.is_active ? "Disable" : "Enable"}
                                    </Button>
                                    {onDelete && (
                                        <Button variant="outline" size="sm" onClick={() => setProductToDelete(p)} className="w-10 border-red-200 text-red-600">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Desktop View: Table */}
                <div className="hidden lg:block">
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
                                            {onDelete && (
                                                <Button variant="outline" size="sm" onClick={() => setProductToDelete(p)} className="text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            <Dialog open={modalOpen} onOpenChange={(open) => {
                if (!open) {
                    setEditingProduct(null);
                    setIsCreating(false);
                }
            }}>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{modalTitle}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input 
                                value={formData.name} 
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                                placeholder="Portland Cement Type 1"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input 
                                value={formData.description} 
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                                placeholder="Description"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Bag Type</Label>
                            <select 
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.bag_type} 
                                onChange={(e) => setFormData({ ...formData, bag_type: e.target.value })}
                            >
                                <option value="JB">Jumbo Bag (JB)</option>
                                <option value="SB">Sling Bag (SB)</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Port Price (₱)</Label>
                                <Input 
                                    type="number" 
                                    value={formData.port || ""} 
                                    placeholder="0"
                                    onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) || 0 })} 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Warehouse Price (₱)</Label>
                                <Input 
                                    type="number" 
                                    value={formData.warehouse || ""} 
                                    placeholder="0"
                                    onChange={(e) => setFormData({ ...formData, warehouse: Number(e.target.value) || 0 })} 
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="productImage">Product Image</Label>

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
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">Max file size: 5 MB. Accepted: JPG, PNG, WebP, GIF.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setEditingProduct(null); setIsCreating(false); }} disabled={isSaving}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving} className="bg-[var(--color-industrial-blue)] gap-2">
                            {isSaving ? (
                                <><Loader2 className="h-4 w-4 animate-spin" />{isUploadingImage ? "Uploading..." : "Saving..."}</>
                            ) : "Save Product"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Product</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 text-sm text-muted-foreground">
                        Are you sure you want to delete <strong>{productToDelete?.name} ({productToDelete?.bag_type})</strong>? This action cannot be undone.
                        <br/><br/>
                        If this product has been used in orders or shipments, you will not be able to delete it. Please use the <strong>Disable</strong> button instead.
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setProductToDelete(null)} disabled={isDeleting}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="gap-2">
                            {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : "Delete Product"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

