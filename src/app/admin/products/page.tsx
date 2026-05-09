"use client";

import { useState, useEffect, Suspense } from "react";
import { fetchProducts, updateProduct, createProduct, deleteProduct } from "@/lib/actions/admin-actions";
import { ProductCatalogTab } from "../orders/components/product-catalog-tab";
import { Product } from "@/lib/types/database";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

function ProductsContent() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        try {
            const p = await fetchProducts();
            setProducts(p as Product[]);
        } catch (error) {
            console.error("Error loading products data:", error);
            toast.error("Failed to load products data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();

        const supabase = createClient();
        const channel = supabase
            .channel('admin-products-page')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
                loadData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleProductUpdate = async (id: string, updates: any) => {
        try {
            await updateProduct(id, updates);
            toast.success("Product updated successfully.");
            loadData();
        } catch (e: any) {
            toast.error(e.message || "Failed to update product.");
        }
    };
    const handleProductCreate = async (data: any) => {
        try {
            await createProduct(data);
            toast.success("Product created successfully.");
            loadData();
        } catch (e: any) {
            toast.error(e.message || "Failed to create product.");
            throw e; // rethrow so the component can stop its loading state
        }
    };

    const handleProductDelete = async (id: string) => {
        try {
            await deleteProduct(id);
            toast.success("Product deleted successfully.");
            loadData();
        } catch (e: any) {
            toast.error(e.message || "Failed to delete product.");
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Product Management</h2>
                <p className="text-muted-foreground mt-1">Manage cement products, pricing, and availability.</p>
            </div>

            <ProductCatalogTab 
                products={products} 
                onUpdate={handleProductUpdate} 
                onCreate={handleProductCreate}
                onDelete={handleProductDelete}
                loading={loading} 
            />
        </div>
    );
}

export default function AdminProductsPage() {
    return (
        <Suspense fallback={<div className="py-8 text-center text-muted-foreground animate-pulse">Loading products...</div>}>
            <ProductsContent />
        </Suspense>
    );
}
