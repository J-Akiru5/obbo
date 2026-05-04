import { fetchClientProfile } from "@/lib/actions/client-actions";
import ProfileClient from "./components/profile-client";

export const metadata = {
    title: "Profile & Settings | OBBO iManage",
};

export default async function ClientProfilePage() {
    const { profile, email } = await fetchClientProfile();

    return <ProfileClient profile={profile} email={email || ""} />;
}
