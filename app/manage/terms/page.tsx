"use client";

import { useAppStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import TermsMobile from "./termsMobile";
import TermsDesktop from "./termsDesktop";

export default function TermsPage() {
    const { currentUser } = useAppStore();
    const router = useRouter();
    const isMobile = useMediaQuery("(max-width: 767px)");

    const props = {
        currentUser,
        router,
    };

    return isMobile ? <TermsMobile {...props} /> : <TermsDesktop {...props} />;
}
