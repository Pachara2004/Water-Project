"use client";

import { useMediaQuery } from "@/hooks/useMediaQuery";
import MapMobile from "./mapMobile";
import MapDesktop from "./mapDesktop";

export default function MapPage() {
    const isMobile = useMediaQuery("(max-width: 1023px)");

    return isMobile ? <MapMobile /> : <MapDesktop />;
}
