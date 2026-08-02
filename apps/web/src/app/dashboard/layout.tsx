import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/lib/auth";
import DashboardClientLayout from "./client-layout";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css"
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
      />
      <DashboardClientLayout>{children}</DashboardClientLayout>
    </>
  );
}