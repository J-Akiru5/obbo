import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
    const path = request.nextUrl.searchParams.get("path");
    if (!path) {
        return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (profile?.role !== "admin" && profile?.role !== "warehouse_manager") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase.storage
        .from("kyc-documents")
        .download(path);

    if (error || !data) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const headers = new Headers();
    headers.set("Content-Type", data.type || "application/octet-stream");
    headers.set("Cache-Control", "private, max-age=3600");

    return new NextResponse(data, { headers });
}
