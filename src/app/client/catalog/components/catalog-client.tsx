'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PackageSearch, ShoppingCart, Building2, Anchor, Boxes, ArrowRight } from 'lucide-react';
import type { Product } from '@/lib/types/database';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { useClientKyc } from '@/lib/context/client-kyc-context';

export default function CatalogClient({ products }: { products: Product[] }) {
  const router = useRouter();
  const { kycStatus } = useClientKyc();
  const isVerified = kycStatus === 'verified';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-foreground text-2xl font-bold tracking-tight">Product Catalog</h2>
        <p className="text-muted-foreground text-sm">
          Browse our available Portland Cement configurations and place your orders.
        </p>
      </div>

      {/* Global Place Order CTA — additive, sits alongside the per-product
          buttons below rather than replacing them. Navigates to the wizard
          with no bag_type param, which reaches StepProducts' existing
          "combined" branch (both JB and SB inputs on one order). */}
      <Card className="border-accent/40 bg-accent/10 flex flex-col items-start gap-3 border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="bg-accent/20 text-accent-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <p className="text-foreground text-sm font-semibold">Need both Jumbo and Sling bags?</p>
            <p className="text-muted-foreground text-sm">
              Place one combined order instead of two.
            </p>
          </div>
        </div>
        {isVerified ? (
          <Button
            onClick={() => router.push('/client/orders/new')}
            className="bg-accent text-accent-foreground hover:bg-accent/90 w-full shadow-sm sm:w-auto"
          >
            Place Combined Order
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button className="bg-accent text-accent-foreground w-full shadow-sm sm:w-auto" disabled>
            Verification Required
          </Button>
        )}
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {products.map((product) => (
          <Card
            key={product.id}
            className="bg-card border-border flex flex-col overflow-hidden shadow-sm"
          >
            <div className="bg-muted relative flex h-48 w-full shrink-0 items-center justify-center overflow-hidden border-b sm:h-64">
              {product.image_url ? (
                <OptimizedImage
                  src={product.image_url}
                  alt={product.name}
                  fill
                  className="object-cover"
                  containerClassName="h-full w-full"
                />
              ) : (
                <PackageSearch className="text-muted-foreground/50 z-10 h-16 w-16" />
              )}
            </div>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {product.bag_type === 'JB' ? 'Jumbo Bag' : 'Sling Bag'}
                  </CardDescription>
                </div>
                <div className="bg-primary text-primary-foreground rounded px-2 py-1 text-xs font-semibold tracking-wider">
                  {product.bag_type}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-muted-foreground mb-4 text-sm">{product.description}</p>

              <div className="space-y-3">
                <div className="bg-muted/50 border-border flex items-center justify-between rounded-lg border p-3">
                  <div className="text-foreground/80 flex items-center gap-2 text-sm font-medium">
                    <Anchor className="text-muted-foreground h-4 w-4" />
                    PORT Price
                  </div>
                  <div className="text-foreground font-bold">
                    ₱{(product.price_port || product.price_per_bag).toLocaleString()}
                    <span className="text-muted-foreground text-xs font-normal"> / indiv. bag</span>
                  </div>
                </div>

                <div className="bg-muted/50 border-border flex items-center justify-between rounded-lg border p-3">
                  <div className="text-foreground/80 flex items-center gap-2 text-sm font-medium">
                    <Building2 className="text-muted-foreground h-4 w-4" />
                    WAREHOUSE Price
                  </div>
                  <div className="text-foreground font-bold">
                    ₱{(product.price_warehouse || product.price_per_bag).toLocaleString()}
                    <span className="text-muted-foreground text-xs font-normal"> / indiv. bag</span>
                  </div>
                </div>
              </div>
              {product.bag_type === 'JB' && (
                <p className="text-muted-foreground mt-3 text-center text-xs">
                  * 1 JB contains 25 individual bags
                </p>
              )}
              {product.bag_type === 'SB' && (
                <p className="text-muted-foreground mt-3 text-center text-xs">
                  * 1 SB contains 50 individual bags
                </p>
              )}
            </CardContent>
            <div className="mt-auto p-6 pt-0">
              {isVerified ? (
                <Button
                  onClick={() => router.push(`/client/orders/new?bag_type=${product.bag_type}`)}
                  className="bg-primary hover:bg-primary/90 w-full"
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Place Order
                </Button>
              ) : (
                <Button className="bg-primary hover:bg-primary/90 w-full" disabled>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Verification Required
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
