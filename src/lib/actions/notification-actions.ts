"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createRoleNotification({
    targetRole,
    title,
    message,
    href = null,
    severity = "info",
}: {
    targetRole: "admin" | "warehouse_manager" | "client";
    title: string;
    message: string;
    href?: string | null;
    severity?: "info" | "warning" | "success";
}) {
    const supabase = await createClient();

    // 1. Find all users with the target role
    const { data: users, error: userError } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", targetRole);

    if (userError) {
        console.error("Error fetching users for notification:", userError);
        return { error: userError.message };
    }

    if (!users || users.length === 0) {
        console.warn(`No users found with role: ${targetRole}`);
        return { success: true, count: 0 };
    }

    // 2. Prepare notifications
    const notifications = users.map((user) => ({
        user_id: user.id,
        title,
        message,
        href,
        severity,
        target_role: targetRole,
    }));

    // 3. Insert notifications in bulk
    const { error: insertError } = await supabase
        .from("notifications")
        .insert(notifications);

    if (insertError) {
        console.error("Error inserting notifications:", insertError);
        return { error: insertError.message };
    }

    revalidatePath("/admin", "layout");
    return { success: true, count: notifications.length };
}

export async function createUserNotification({
    userId,
    title,
    message,
    href = null,
    severity = "info",
}: {
    userId: string;
    title: string;
    message: string;
    href?: string | null;
    severity?: "info" | "warning" | "success";
}) {
    const supabase = await createClient();

    const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        title,
        message,
        href,
        severity,
    });

    if (error) {
        console.error("Error inserting notification:", error);
        return { error: error.message };
    }

    revalidatePath("/admin", "layout");
    return { success: true };
}
