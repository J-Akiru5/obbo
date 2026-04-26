import { getContactInfo } from "@/lib/actions/client-actions";
import ContactClient from "./components/contact-client";

export const metadata = {
    title: "Contact Admin | OBBO iManage",
};

export default async function ClientContactPage() {
    const contactInfo = await getContactInfo();

    return <ContactClient contactInfo={contactInfo} />;
}
