// app/(auth)/sign-in/page.tsx
import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";
import { buildMetadata, SITE } from "@/lib/seo";
import { OrganizationJsonLd, SoftwareAppJsonLd } from "@/components/seo/JsonLd";

export const metadata: Metadata = buildMetadata({
  title: "Sign in to Preciprocal - AI Interview Prep & Resume Optimizer",
  description:
    "Sign in to Preciprocal to access AI mock interviews, ATS resume scoring, 1-click auto-apply, and your personalized career planner.",
  path: "/sign-in",
  index: true,
  canonical: `${SITE.app}/sign-in`,
});

const Page = () => {
  return (
    <>
      <OrganizationJsonLd />
      <SoftwareAppJsonLd />
      <AuthForm type="sign-in" />
    </>
  );
};

export default Page;