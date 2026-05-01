import { useState } from "react";
import { Product } from "@/lib/types/database";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Edit, Package, UploadCloud } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function ProductCatalogTab({ products, onUpdate, loading }: { products: Product[], onUpdate: (id: string, updates: any) => Promise<void>, loading: boolean }) {
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [editPrices, setEditPrices] = useState({ port: 0, warehouse: 0 });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    const openEdit = (product: Product) => {
        setEditingProduct(product);
        setEditPrices({ port: product.price_port ?? product.price_per_bag, warehouse: product.price_warehouse ?? product.price_per_bag });
        setImageFile(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setImageFile(e.target.files[0]);
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
                const fileExt = imageFile.name.split('.').pop();
                const fileName = `product_${editingProduct.id}_${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('product-images')
                    .upload(fileName, imageFile);

                if (uploadError) throw new Error("Failed to upload image.");
                const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName);
                newImageUrl = publicUrl;
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
        } catch (err: any) {
            toast.error(err.message || "Failed to update product.");
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
            <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">Product Catalog</CardTitle>
                        <CardDescription>Manage available cement products and pricing.</CardDescription>
                    </div>
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
                        {products.map((p) => (
                            <TableRow key={p.id} className="group">
                                <TableCell>
                                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                                        {p.image_url ? (
                                            <img src={p.image_url} alt={p.name} className="w-full h-full object-cover rounded-lg" />
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
                        ))}
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
                            <div className="rounded-lg border border-dashed border-border p-3">
                                <label htmlFor="productImage" className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                                    <UploadCloud className="h-4 w-4" />
                                    {imageFile ? imageFile.name : (editingProduct?.image_url ? "Replace existing image" : "Upload new image")}
                                </label>
                                <Input
                                    id="productImage"
                                    type="file"
                                    accept="image/*"
                                    className="mt-2"
                                    onChange={handleFileChange}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingProduct(null)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving} className="bg-[var(--color-industrial-blue)]">
                            {isSaving ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
