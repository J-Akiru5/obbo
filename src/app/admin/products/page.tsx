"use client";

import { useState, useEffect, Suspense } from "react";
import { fetchProducts, updateProduct } from "@/lib/actions/admin-actions";
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
            // 🌟 IMPLEMENTATION CONTROLLER: Pinalawak para maayos na maipasa ang dual-pricing payload keys (port_selling_price, warehouse_selling_price)
            await updateProduct(id, {
                ...updates,
                port_selling_price: updates.port_selling_price !== undefined ? Number(updates.port_selling_price) : undefined,
                warehouse_selling_price: updates.warehouse_selling_price !== undefined ? Number(updates.warehouse_selling_price) : undefined
            });
            toast.success("Product configurations updated successfully.");
            loadData();
        } catch (e: any) {
            toast.error(e.message || "Failed to update product settings matrix.");
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Product Management</h2>
                <p className="text-muted-foreground mt-1">Manage cement products, dual-pricing schemas, and storage allocation parameters.</p>
            </div>

            <ProductCatalogTab 
                products={products} 
                onUpdate={handleProductUpdate} 
                loading={loading} 
            />
        </div>
    );
}

export default function AdminProductsPage() {
    return (
        <Suspense fallback={<div className="py-8 text-center text-muted-foreground animate-pulse">Loading products data infrastructure...</div>}>
            <ProductsContent />
        </Suspense>
    );
}