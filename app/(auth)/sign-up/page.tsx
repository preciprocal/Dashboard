// app/(auth)/sign-up/page.tsx
import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";
import { buildMetadata, SITE } from "@/lib/seo";
import { OrganizationJsonLd, SoftwareAppJsonLd } from "@/components/seo/JsonLd";

export const metadata: Metadata = buildMetadata({
  title: "Sign up for Preciprocal - Free AI Job Search Platform",
  description:
    "Create your free Preciprocal account. AI mock interviews, ATS resume scoring, and 1-click auto-apply - built to land your next job, faster.",
  path: "/sign-up",
  index: true,
  canonical: `${SITE.app}/sign-up`,
});

const Page = () => {
  return (
    <>
      <OrganizationJsonLd />
      <SoftwareAppJsonLd />
      <AuthForm type="sign-up" />
    </>
  );
};

export default Page;