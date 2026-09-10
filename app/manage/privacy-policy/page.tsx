"use client";

import { useAppStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import PrivacyPolicyMobile from "./privacyPolicyMobile";
import PrivacyPolicyDesktop from "./privacyPolicyDesktop";

export default function PrivacyPolicyPage() {
    const { currentUser } = useAppStore();
    const router = useRouter();
    const isMobile = useMediaQuery("(max-width: 767px)");

    const props = {
        currentUser,
        router,
    };

    return isMobile ? <PrivacyPolicyMobile {...props} /> : <PrivacyPolicyDesktop {...props} />;
}
