import { fetchActiveProducts } from "@/lib/actions/client-actions";
import CatalogClient from "./components/catalog-client";

export const metadata = {
    title: "Product Catalog | OBBO iManage",
};

export default async function ClientCatalogPage() {
    const products = await fetchActiveProducts();

    return <CatalogClient products={products} />;
}
