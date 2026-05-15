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
import { Edit, Package, UploadCloud, Loader2, Plus, Eye, LayoutGrid, List, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface ProductCatalogTabProps {
    products: Product[];
    onUpdate: (id: string, updates: Partial<Product>) => Promise<void>;
    onCreate?: (product: any) => Promise<void>;
    loading: boolean;
}

export function ProductCatalogTab({ products, onUpdate, onCreate, loading }: ProductCatalogTabProps) {
    const [viewMode, setViewMode] = useState<"list" | "grid">("list");
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
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
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="flex items-center border rounded-md p-1 bg-muted/30">
                            <Button 
                                variant={viewMode === "list" ? "secondary" : "ghost"} 
                                size="sm" 
                                className="h-7 w-7 p-0"
                                onClick={() => setViewMode("list")}
                                title="List View"
                            >
                                <List className="h-4 w-4" />
                            </Button>
                            <Button 
                                variant={viewMode === "grid" ? "secondary" : "ghost"} 
                                size="sm" 
                                className="h-7 w-7 p-0"
                                onClick={() => setViewMode("grid")}
                                title="Grid View"
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                        </div>
                        {onCreate && (
                            <Button onClick={openCreate} className="bg-primary gap-2 h-9">
                                <Plus className="w-4 h-4" /> Create Product
                            </Button>
                        )}
                    </div>
                </div>
                <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg text-xs text-primary mt-3">
                    Product catalog is restricted to <span className="font-semibold">Portland Cement Type 1</span> (SB &amp; JB).
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {viewMode === "list" ? (
                    <div className="overflow-x-auto">
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
                                            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden border">
                                                {p.image_url ? (
                                                    <Image
                                                        src={p.image_url}
                                                        alt={p.name}
                                                        width={48}
                                                        height={48}
                                                        className="w-full h-full object-cover"
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
                                        <TableCell className="text-right font-medium text-primary">
                                            ₱{(p.price_warehouse ?? p.price_per_bag).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant={p.is_active ? "default" : "secondary"} className={p.is_active ? "bg-primary/10 text-primary hover:bg-primary/20 border-none h-5 text-[10px]" : "h-5 text-[10px]"}>
                                                {p.is_active ? "Active" : "Inactive"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => { setViewingProduct(p); setIsViewOpen(true); }}
                                                    className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => toggleActive(p)} className="h-8 w-8">
                                                    {p.is_active ? <Package className="w-4 h-4 text-emerald-600" /> : <Package className="w-4 h-4 text-muted-foreground" />}
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => openEdit(p)} className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10">
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                        {filteredProducts.length === 0 ? (
                            <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                                No products found matching your search.
                            </div>
                        ) : (
                            filteredProducts.map(p => (
                                <Card key={p.id} className="overflow-hidden group hover:shadow-md transition-shadow border-border/50">
                                    <div className="aspect-square bg-muted relative overflow-hidden border-b">
                                        {p.image_url ? (
                                            <Image src={p.image_url} alt={p.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" unoptimized />
                                        ) : (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/30">
                                                <Package className="w-16 h-16 mb-2" />
                                                <span className="text-[10px] uppercase font-bold tracking-widest">No Product Photo</span>
                                            </div>
                                        )}
                                        <div className="absolute top-2 left-2">
                                            <Badge variant={p.is_active ? "default" : "secondary"} className={p.is_active ? "bg-primary text-primary-foreground border-none shadow-sm backdrop-blur-sm" : "backdrop-blur-sm"}>
                                                {p.is_active ? "Active" : "Inactive"}
                                            </Badge>
                                        </div>
                                        <div className="absolute top-2 right-2">
                                            <Badge variant="outline" className="bg-white/80 backdrop-blur-sm text-foreground text-[10px] font-mono border-none font-black">{p.bag_type}</Badge>
                                        </div>
                                    </div>
                                    <CardContent className="p-4 space-y-3">
                                        <div>
                                            <h4 className="font-bold text-sm text-foreground truncate">{p.name}</h4>
                                            <p className="text-xs text-muted-foreground line-clamp-1 h-4">{p.description || "No description provided."}</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 py-2 border-y border-border/50">
                                            <div>
                                                <div className="text-[9px] uppercase font-black text-muted-foreground/60 mb-0.5">Port Price</div>
                                                <p className="text-xs font-bold text-foreground">₱{(p.price_port ?? p.price_per_bag).toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[9px] uppercase font-black text-primary/60 mb-0.5">Warehouse</div>
                                                <p className="text-xs font-bold text-primary">₱{(p.price_warehouse ?? p.price_per_bag).toLocaleString()}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-1">
                                            <Button 
                                                variant="secondary" 
                                                size="sm" 
                                                className="h-8 text-[11px] font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 flex-1"
                                                onClick={() => { setViewingProduct(p); setIsViewOpen(true); }}
                                            >
                                                <Eye className="w-3.5 h-3.5" /> View
                                            </Button>
                                            <div className="flex gap-1 ml-2">
                                                <Button variant="outline" size="icon" onClick={() => openEdit(p)} className="h-8 w-8 text-primary border-primary/10 hover:bg-primary/10"><Edit className="w-3.5 h-3.5" /></Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                )}
            </CardContent>

            {/* View Details Dialog */}
            <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                <DialogContent showCloseButton={false} className="sm:max-w-2xl p-0 overflow-hidden rounded-xl border-none max-h-[90vh] overflow-y-auto">
                    <div className="bg-primary p-6 text-primary-foreground">
                        <div className="flex justify-between items-start">
                            <div>
                                <Badge className="bg-white/20 hover:bg-white/30 text-white border-none mb-2 text-[10px]">Product Information</Badge>
                                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-white">
                                    {viewingProduct?.name}
                                    <Badge variant="outline" className="border-white/40 text-white font-mono text-[10px] ml-2">{viewingProduct?.bag_type}</Badge>
                                </h2>
                                <p className="text-primary-foreground/70 text-sm mt-1">{viewingProduct?.description || "High-quality industrial cement product."}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setIsViewOpen(false)} className="text-white hover:bg-white/10 rounded-full h-8 w-8">
                                <X className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                        <div className="bg-muted flex items-center justify-center relative min-h-[300px]">
                            {viewingProduct?.image_url ? (
                                <Image 
                                    src={viewingProduct.image_url} 
                                    alt={viewingProduct.name} 
                                    fill 
                                    className="object-cover"
                                    unoptimized
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center text-muted-foreground/40 text-center p-8">
                                    <Package className="w-20 h-20 mb-4" />
                                    <p className="text-xs font-bold uppercase tracking-widest">No Image Available</p>
                                </div>
                            )}
                            <div className="absolute top-4 left-4">
                                <Badge variant={viewingProduct?.is_active ? "default" : "secondary"} className={viewingProduct?.is_active ? "bg-primary text-primary-foreground border-none" : ""}>
                                    {viewingProduct?.is_active ? "ACTIVE CATALOG ITEM" : "INACTIVE"}
                                </Badge>
                            </div>
                        </div>

                        <div className="p-8 space-y-8 md:border-l border-t md:border-t-0">
                            <div className="space-y-4">
                                <p className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">Current Market Pricing</p>
                                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border border-border/50">
                                    <div>
                                        <p className="text-xs font-bold text-muted-foreground mb-1 flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-accent" />
                                            PORT PRICE
                                        </p>
                                        <p className="text-2xl font-black text-foreground">₱{viewingProduct?.price_port?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-primary mb-1 flex items-center justify-end gap-2">
                                            WAREHOUSE
                                            <div className="w-2 h-2 rounded-full bg-primary" />
                                        </p>
                                        <p className="text-2xl font-black text-primary">₱{viewingProduct?.price_warehouse?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <p className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">Specifications</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-white border rounded-lg shadow-sm">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Packaging</p>
                                        <p className="text-sm font-bold">{viewingProduct?.bag_type === "JB" ? "Jumbo Bag" : "Sling Bag"}</p>
                                    </div>
                                    <div className="p-3 bg-white border rounded-lg shadow-sm">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Unit</p>
                                        <p className="text-sm font-bold">Per Bag</p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t flex gap-3">
                                <Button className="flex-1 bg-primary font-bold text-xs uppercase" onClick={() => { setIsViewOpen(false); openEdit(viewingProduct!); }}>
                                    Modify Product Details
                                </Button>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-4 bg-muted/20 border-t flex justify-between items-center px-8">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter italic">Last updated system-wide for all transactions</p>
                        <Button variant="ghost" onClick={() => setIsViewOpen(false)} className="font-bold text-[10px] uppercase tracking-widest">Dismiss</Button>
                    </div>
                </DialogContent>
            </Dialog>

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
                        <Button onClick={handleSave} disabled={isSaving} className="bg-primary gap-2">
                            {isSaving ? (
                                <><Loader2 className="h-4 w-4 animate-spin" />{isUploadingImage ? "Uploading..." : "Saving..."}</>
                            ) : "Save Product"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </Card>
    );
}

