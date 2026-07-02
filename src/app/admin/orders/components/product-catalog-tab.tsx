'use client';

import { useState } from 'react';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { Product } from '@/lib/types/database';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Edit, Package, UploadCloud, Loader2, Eye, LayoutGrid, List, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface ProductCatalogTabProps {
  products: Product[];
  onUpdate: (id: string, updates: Partial<Product>) => Promise<void>;
  onCreate?: (product: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  loading: boolean;
}

export function ProductCatalogTab({
  products,
  onUpdate,
  onCreate: _onCreate,
  onDelete: _onDelete,
  loading,
}: ProductCatalogTabProps) {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form state (🌟 DUAL-PRICING STATE DATA OBJECTS INITIALIZATION MATRIX)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    bag_type: 'JB',
    price_port: 0,
    price_warehouse: 0,
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const filteredProducts = products.filter(
    (p) =>
      (p.name.toLowerCase().includes('portland cement type 1') ||
        p.name.toLowerCase().includes('portland cement type i')) &&
      (p.bag_type === 'SB' || p.bag_type === 'JB'),
  );

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      bag_type: product.bag_type,
      // 🌟 BACKEND ASSIGNMENT ALIGNMENT LOOKUPS
      price_port: (product as any).price_port ?? (product as any).price_per_bag ?? 0,
      price_warehouse: (product as any).price_warehouse ?? (product as any).price_per_bag ?? 0,
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

    const {
      data: { publicUrl },
    } = supabase.storage.from('product-images').getPublicUrl(fileName);

    setIsUploadingImage(false);
    return publicUrl;
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (editingProduct) {
        let newImageUrl = editingProduct.image_url;

        if (imageFile) {
          newImageUrl = await uploadImage(editingProduct.id, imageFile);
        }

        await onUpdate(editingProduct.id, {
          name: formData.name,
          description: formData.description,
          bag_type: formData.bag_type as 'JB' | 'SB',
          // 🌟 SUBMIT PAYLOAD CONFIGURATION KEYS RE-MAPPING
          price_port: formData.price_port,
          price_warehouse: formData.price_warehouse,
          image_url: newImageUrl,
        } as any);
        setEditingProduct(null);
      }
      setImagePreview(null);
      setImageFile(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save product.';
      if (err instanceof Error && err.message.includes('upload')) toast.error(message);
    } finally {
      setIsSaving(false);
      setIsUploadingImage(false);
    }
  };

  const toggleActive = async (product: Product) => {
    await onUpdate(product.id, { is_active: !product.is_active });
  };

  if (loading)
    return (
      <div className="text-muted-foreground animate-pulse py-8 text-center text-sm">
        Loading products data grid...
      </div>
    );

  const modalOpen = !!editingProduct;
  const modalTitle = `Edit Product: ${editingProduct?.name}`;

  return (
    <Card>
      <CardHeader className="border-border/50 border-b pb-3">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <CardTitle className="text-lg">Product Catalog</CardTitle>
            <CardDescription>
              Manage Portland Cement Type 1 dual pricing schedules (SB &amp; JB).
            </CardDescription>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="bg-muted/30 flex items-center rounded-md border p-1">
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setViewMode('list')}
                title="List View"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setViewMode('grid')}
                title="Grid View"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="bg-primary/5 border-primary/10 text-primary mt-3 rounded-lg border p-3 text-xs">
          Product catalog configuration node is restricted to{' '}
          <span className="font-semibold">Portland Cement Type 1</span> (SB &amp; JB variants).
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {viewMode === 'list' ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[80px]">Product</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-right text-emerald-500">Port Price</TableHead>
                  <TableHead className="text-right text-blue-500">Warehouse Price</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                      No products match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((p) => {
                    const pPort = (p as any).price_port ?? (p as any).price_per_bag ?? 0;
                    const pWh = (p as any).price_warehouse ?? (p as any).price_per_bag ?? 0;
                    return (
                      <TableRow key={p.id} className="group">
                        <TableCell>
                          <div className="bg-muted flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border">
                            {p.image_url ? (
                              <OptimizedImage
                                src={p.image_url}
                                alt={p.name}
                                width={48}
                                height={48}
                                className="h-full w-full object-cover"
                                unoptimized
                              />
                            ) : (
                              <Package className="text-muted-foreground h-6 w-6" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-semibold">{p.name}</p>
                          <p className="text-muted-foreground mt-0.5 flex gap-2 text-xs">
                            <Badge
                              variant="outline"
                              className="h-4 px-1 font-mono text-[10px] tracking-wider uppercase"
                            >
                              {p.bag_type}
                            </Badge>
                            <span className="max-w-[200px] truncate">{p.description}</span>
                          </p>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-500">
                          ₱{Number(pPort).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-blue-500">
                          ₱{Number(pWh).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={p.is_active ? 'default' : 'secondary'}
                            className={
                              p.is_active
                                ? 'bg-primary/10 text-primary hover:bg-primary/20 h-5 border-none text-[10px]'
                                : 'h-5 text-[10px]'
                            }
                          >
                            {p.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setViewingProduct(p);
                                setIsViewOpen(true);
                              }}
                              className="text-primary hover:text-primary hover:bg-primary/10 h-8 w-8"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleActive(p)}
                              className="h-8 w-8"
                            >
                              {p.is_active ? (
                                <Package className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Package className="text-muted-foreground h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(p)}
                              className="text-primary hover:text-primary hover:bg-primary/10 h-8 w-8"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.length === 0 ? (
              <div className="text-muted-foreground col-span-full rounded-xl border-2 border-dashed py-12 text-center">
                No products found matching criteria.
              </div>
            ) : (
              filteredProducts.map((p) => {
                const pPort = (p as any).price_port ?? (p as any).price_per_bag ?? 0;
                const pWh = (p as any).price_warehouse ?? (p as any).price_per_bag ?? 0;
                return (
                  <Card
                    key={p.id}
                    className="group border-border/50 overflow-hidden transition-shadow hover:shadow-md"
                  >
                    <div className="bg-muted relative aspect-square overflow-hidden border-b">
                      {p.image_url ? (
                        <OptimizedImage
                          src={p.image_url}
                          alt={p.name}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          unoptimized
                          containerClassName="h-full w-full"
                        />
                      ) : (
                        <div className="text-muted-foreground/30 absolute inset-0 flex flex-col items-center justify-center">
                          <Package className="mb-2 h-16 w-16" />
                          <span className="text-[10px] font-bold tracking-widest uppercase">
                            No Product Photo
                          </span>
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        <Badge
                          variant={p.is_active ? 'default' : 'secondary'}
                          className={
                            p.is_active
                              ? 'bg-primary text-primary-foreground border-none shadow-sm backdrop-blur-sm'
                              : 'backdrop-blur-sm'
                          }
                        >
                          {p.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="absolute top-2 right-2">
                        <Badge
                          variant="outline"
                          className="text-foreground border-none bg-white/80 font-mono text-[10px] font-black backdrop-blur-sm"
                        >
                          {p.bag_type}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="space-y-3 p-4">
                      <div>
                        <h4 className="text-foreground truncate text-sm font-bold">{p.name}</h4>
                        <p className="text-muted-foreground line-clamp-1 h-4 text-xs">
                          {p.description || 'No description provided.'}
                        </p>
                      </div>

                      <div className="border-border/50 grid grid-cols-2 gap-2 border-y py-2">
                        <div>
                          <div className="mb-0.5 text-[9px] font-black text-emerald-500/80 uppercase">
                            Port Price
                          </div>
                          <p className="text-xs font-bold text-emerald-500">
                            ₱{Number(pPort).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="mb-0.5 text-[9px] font-black text-blue-500/80 uppercase">
                            Warehouse
                          </div>
                          <p className="text-xs font-bold text-blue-500">
                            ₱{Number(pWh).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 flex-1 gap-1.5 text-[11px] font-bold"
                          onClick={() => {
                            setViewingProduct(p);
                            setIsViewOpen(true);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </Button>
                        <div className="ml-2 flex gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openEdit(p)}
                            className="text-primary border-primary/10 hover:bg-primary/10 h-8 w-8"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </CardContent>

      {/* View Details Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent
          className="max-h-[90vh] overflow-hidden overflow-y-auto rounded-xl border-none p-0 sm:max-w-2xl"
          showCloseButton={false}
        >
          <div className="bg-primary text-primary-foreground p-6">
            <div className="flex items-start justify-between">
              <div>
                <Badge className="mb-2 border-none bg-white/20 text-[10px] text-white hover:bg-white/30">
                  Product Information Matrix
                </Badge>
                <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
                  {viewingProduct?.name}
                  <Badge
                    variant="outline"
                    className="ml-2 border-white/40 font-mono text-[10px] text-white"
                  >
                    {viewingProduct?.bag_type}
                  </Badge>
                </h2>
                <p className="mt-1 text-sm text-white/80">
                  {viewingProduct?.description ||
                    'High-quality wholesale construction infrastructure cement.'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsViewOpen(false)}
                className="h-8 w-8 rounded-full text-white hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
            <div className="bg-muted relative flex min-h-[300px] items-center justify-center">
              {viewingProduct?.image_url ? (
                <OptimizedImage
                  src={viewingProduct.image_url}
                  alt={viewingProduct.name}
                  fill
                  className="object-cover"
                  unoptimized
                  containerClassName="h-full w-full"
                />
              ) : (
                <div className="text-muted-foreground/40 flex flex-col items-center justify-center p-8 text-center">
                  <Package className="mb-4 h-20 w-20" />
                  <p className="text-xs font-bold tracking-widest uppercase">No Image Available</p>
                </div>
              )}
              <div className="absolute top-4 left-4">
                <Badge
                  variant={viewingProduct?.is_active ? 'default' : 'secondary'}
                  className={
                    viewingProduct?.is_active
                      ? 'bg-primary text-primary-foreground border-none'
                      : ''
                  }
                >
                  {viewingProduct?.is_active ? 'ACTIVE CATALOG ITEM' : 'INACTIVE'}
                </Badge>
              </div>
            </div>

            <div className="space-y-8 border-t p-8 md:border-t-0 md:border-l">
              <div className="space-y-4">
                <p className="text-muted-foreground/60 text-[10px] font-black tracking-widest uppercase">
                  Dual-Pricing Schedules
                </p>
                <div className="bg-muted/50 border-border/50 flex items-center justify-between rounded-xl border p-4">
                  <div>
                    <p className="mb-1 flex items-center gap-2 text-xs font-bold text-emerald-500">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      PORT VALUE
                    </p>
                    <p className="text-xl font-black text-emerald-600">
                      Requirements: ₱
                      {Number((viewingProduct as any)?.price_port ?? 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="mb-1 flex items-center justify-end gap-2 text-xs font-bold text-blue-500">
                      WAREHOUSE
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                    </p>
                    <p className="text-xl font-black text-blue-600">
                      ₱
                      {Number((viewingProduct as any)?.price_warehouse ?? 0).toLocaleString(
                        undefined,
                        { minimumFractionDigits: 2 },
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-muted-foreground/60 text-[10px] font-black tracking-widest uppercase">
                  Specifications
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/30 rounded-lg border p-3 shadow-sm">
                    <p className="text-muted-foreground mb-1 text-[9px] font-black uppercase">
                      Packaging
                    </p>
                    <p className="text-foreground text-sm font-bold">
                      {viewingProduct?.bag_type === 'JB' ? 'Jumbo Bag (JB)' : 'Sling Bag (SB)'}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg border p-3 shadow-sm">
                    <p className="text-muted-foreground mb-1 text-[9px] font-black uppercase">
                      Unit
                    </p>
                    <p className="text-foreground text-sm font-bold">Per 40kg Bag</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 border-t pt-4">
                <Button
                  className="bg-primary flex-1 text-xs font-bold uppercase"
                  onClick={() => {
                    setIsViewOpen(false);
                    openEdit(viewingProduct!);
                  }}
                >
                  Modify Pricing Tier Parameters
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-muted/20 flex items-center justify-between border-t p-4 px-8">
            <p className="text-muted-foreground text-[9px] font-bold tracking-tighter uppercase italic">
              Dual procurement rules active
            </p>
            <Button
              variant="ghost"
              onClick={() => setIsViewOpen(false)}
              className="text-[10px] font-bold tracking-widest uppercase"
            >
              Dismiss
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit / Modify Catalog Parameters Form */}
      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) setEditingProduct(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="product-name">Product Variant Designation</Label>
              <Input
                id="product-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Portland Cement Type 1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-description">Description</Label>
              <Input
                id="product-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Core variant details..."
              />
            </div>
            <div className="space-y-2">
              <Label>Bag Type Variant</Label>
              <select
                className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                value={formData.bag_type}
                onChange={(e) => setFormData({ ...formData, bag_type: e.target.value })}
              >
                <option value="JB">Jumbo Bag (JB)</option>
                <option value="SB">Sling Bag (SB)</option>
              </select>
            </div>

            {/* 🌟 RE-FACTORED DUAL PRICE CONTROL FIELDS CONTAINER */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="port-selling-price" className="font-bold text-emerald-500">
                  Port Price Rate (₱)
                </Label>
                <Input
                  id="port-selling-price"
                  type="number"
                  step="0.01"
                  value={formData.price_port || ''}
                  placeholder="0.00"
                  onChange={(e) =>
                    setFormData({ ...formData, price_port: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="warehouse-selling-price" className="font-bold text-blue-500">
                  Warehouse Price Rate (₱)
                </Label>
                <Input
                  id="warehouse-selling-price"
                  type="number"
                  step="0.01"
                  value={formData.price_warehouse || ''}
                  placeholder="0.00"
                  onChange={(e) =>
                    setFormData({ ...formData, price_warehouse: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-image">Product Documentation Image</Label>

              {(imagePreview || editingProduct?.image_url) && (
                <div className="border-border bg-muted relative h-36 w-full overflow-hidden rounded-lg border">
                  <OptimizedImage
                    src={imagePreview ?? editingProduct!.image_url!}
                    alt="Product preview"
                    fill
                    className="object-contain"
                    unoptimized
                    containerClassName="h-full w-full"
                  />
                </div>
              )}

              <div className="border-border rounded-lg border border-dashed p-3">
                <label
                  htmlFor="product-image"
                  className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-2 text-sm transition-colors"
                >
                  <UploadCloud className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">
                    {imageFile
                      ? imageFile.name
                      : editingProduct?.image_url
                        ? 'Replace existing asset image'
                        : 'Upload catalog sheet asset (JPG, PNG, WebP)'}
                  </span>
                </label>
                <Input
                  id="product-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProduct(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-primary gap-2">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isUploadingImage ? 'Uploading Asset...' : 'Syncing Price tiers...'}
                </>
              ) : (
                '✓ Save Product Details'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
