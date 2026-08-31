"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import liff from "@line/liff";
import { useAppStore } from "@/lib/store";
import { confirmDialog } from "@/lib/swal";
import { useToast } from "@/components/useToast";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ShieldAlert } from "lucide-react";
import { type LocationItem } from "@/components/manage/locationsHelpers";
import LocationsMobile from "./locationsMobile";
import LocationsDesktop from "./locationsDesktop";

const MapView = dynamic(() => import("@/components/map/MapView"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full bg-surface-subtle flex items-center justify-center border border-border rounded-2xl">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
    ),
});

export default function AdminLocationsPage() {
    const { currentUser } = useAppStore();
    const router = useRouter();
    const { showToast, toastElement } = useToast();
    const isMobile = useMediaQuery("(max-width: 767px)");

    // Create form
    const [name, setName] = useState("");
    const [organization, setOrganization] = useState("");
    const [customOrg, setCustomOrg] = useState("");
    const [pickedPosition, setPickedPosition] = useState<{
        lat: number;
        lng: number;
    } | null>(null);
    const [province, setProvince] = useState("");
    const [district, setDistrict] = useState("");
    const [subdistrict, setSubdistrict] = useState("");
    const [zipcode, setZipcode] = useState("");
    const [saving, setSaving] = useState(false);

    // Organization combobox
    const [orgSearch, setOrgSearch] = useState("");
    const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);

    // 🌟 1. State สำหรับ Lat/Lng Input แบบพิมพ์เอง
    const [inputLat, setInputLat] = useState("");
    const [inputLng, setInputLng] = useState("");

    // 🌟 2. State สำหรับค้นหาชื่อสถานที่ผ่าน OpenStreetMap Nominatim
    const [placeSearch, setPlaceSearch] = useState("");
    const [placeResults, setPlaceResults] = useState<any[]>([]);
    const [isSearchingPlace, setIsSearchingPlace] = useState(false);
    const [showPlaceDropdown, setShowPlaceDropdown] = useState(false);

    // 🌟 3. Sync พิกัดเมื่อผู้ใช้แตะปักหมุดบนแผนที่ ➔ อัปเดตลงช่อง Input และดึงที่อยู่อัตโนมัติ
    useEffect(() => {
        if (pickedPosition) {
            setInputLat(pickedPosition.lat.toFixed(6));
            setInputLng(pickedPosition.lng.toFixed(6));

            // เรียก BigDataCloud Reverse Geocoding (ไม่ต้องใช้ API Key, รองรับภาษาไทย, ไม่ติด Rate Limit หนัก)
            fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pickedPosition.lat}&longitude=${pickedPosition.lng}&localityLanguage=th`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.localityInfo && data.localityInfo.administrative) {
                        let pProv = "", pDist = "", pSub = "";
                        const admin = data.localityInfo.administrative;
                        
                        // หาชิ้นส่วนที่มีคำระบุระดับการปกครอง
                        for (const part of admin) {
                            const name = part.name;
                            if (name.includes("จังหวัด")) pProv = name.replace(/.*จังหวัด/, "").trim();
                            else if (name === "กรุงเทพมหานคร") pProv = "กรุงเทพมหานคร";

                            if (name.includes("อำเภอ")) pDist = name.replace(/.*อำเภอ/, "").trim();
                            else if (name.includes("เขต")) pDist = name.replace(/.*เขต/, "").trim();

                            if (name.includes("ตำบล")) pSub = name.replace(/.*ตำบล/, "").trim();
                            else if (name.includes("แขวง")) pSub = name.replace(/.*แขวง/, "").trim();
                        }
                        
                        if (pProv) setProvince(pProv);
                        if (pDist) setDistrict(pDist);
                        if (pSub) setSubdistrict(pSub);
                        
                        if (data.postcode) {
                            setZipcode(data.postcode);
                        }
                    }
                })
                .catch(err => console.error("Reverse geocoding failed:", err));
        }
    }, [pickedPosition]);

    const handleSearchPlace = async (query: string) => {
        setPlaceSearch(query);
        if (!query.trim() || query.length < 3) {
            setPlaceResults([]);
            setShowPlaceDropdown(false);
            return;
        }

        setIsSearchingPlace(true);
        setShowPlaceDropdown(true);

        try {
            const res = await fetch(`/api/nominatim?type=search&q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (Array.isArray(data)) setPlaceResults(data);
        } catch (err) {
            console.error("Nominatim search failed:", err);
        } finally {
            setIsSearchingPlace(false);
        }
    };

    // 🌟 4. ดักจับการคลิกนอกพื้นที่ Dropdown เพื่อปิด Dropdown อัตโนมัติ
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // หากจุดที่คลิกไม่ได้อยู่ใน Element ที่มีคลาส .place-dropdown-container ให้ปิด Dropdown สถานที่
            if (!target.closest(".place-dropdown-container")) {
                setShowPlaceDropdown(false);
            }
            // หากจุดที่คลิกไม่ได้อยู่ใน Element ที่มีคลาส .org-dropdown-container ให้ปิด Dropdown หน่วยงาน
            if (!target.closest(".org-dropdown-container")) {
                setOrgDropdownOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // 🌟 เมื่อคลิกเลือกสถานที่จากรายการค้นหา
    const handleSelectPlace = (place: any) => {
        const lat = parseFloat(place.lat);
        const lng = parseFloat(place.lon);
        if (!isNaN(lat) && !isNaN(lng)) {
            setPickedPosition({ lat, lng });
            setShowPlaceDropdown(false);
            setPlaceSearch(place.display_name.split(",")[0]);
        }
    };

    // 🌟 เมื่อพิมพ์ Lat/Lng ในช่อง Input เอง
    const handleManualCoordsChange = (latStr: string, lngStr: string) => {
        setInputLat(latStr);
        setInputLng(lngStr);
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            setPickedPosition({ lat, lng });
        }
    };

    // List
    const [locations, setLocations] = useState<LocationItem[]>([]);
    const [stationSearch, setStationSearch] = useState("");

    // Edit modal
    const [editingLoc, setEditingLoc] = useState<LocationItem | null>(null);
    const [editName, setEditName] = useState("");
    const [editOrg, setEditOrg] = useState("");
    const [editProvince, setEditProvince] = useState("");
    const [editDistrict, setEditDistrict] = useState("");
    const [editSubdistrict, setEditSubdistrict] = useState("");
    const [editZipcode, setEditZipcode] = useState("");
    const [editSaving, setEditSaving] = useState(false);

    // Delete loading state
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const fetchLocations = useCallback(async (silent = false) => {
        try {
            const res = await fetch("/api/locations");
            const data = await res.json();

            if (Array.isArray(data)) {
                const mapped = data.map((l: any) => ({
                    id: l.id,
                    name: l.name,
                    organization: l.organization,
                    lat: l.lat,
                    lng: l.lng,
                    province: l.province,
                    district: l.district,
                    subdistrict: l.subdistrict,
                    zipcode: l.zipcode,
                }));
                setLocations(mapped);
            } else {
                setLocations([]);
            }
        } catch (err) {
            console.error("Failed to fetch locations:", err);
        }
    }, []);

    useEffect(() => {
        if (currentUser?.role === "admin") {
            fetchLocations();
        }
    }, [currentUser?.role, fetchLocations]);

    const getOrgValue = () => {
        return organization === "CUSTOM" ? customOrg.trim() : organization;
    };

    const handleSubmit = async () => {
        const orgVal = getOrgValue();
        const stationName = name.trim();
        if (!stationName || !pickedPosition || !orgVal || !currentUser) return;

        const confirmed = await confirmDialog({
            title: "ยืนยันเพิ่มสถานี?",
            text: `เพิ่มสถานี "${stationName}" ลงในระบบ`,
            confirmText: "เพิ่มสถานี",
            tone: "primary",
        });
        if (!confirmed) return;

        setSaving(true);
        try {
            const res = await fetch("/api/locations", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${liff.getAccessToken()}`,
                },
                body: JSON.stringify({
                    name: stationName,
                    organization: orgVal,
                    lat: pickedPosition.lat,
                    lng: pickedPosition.lng,
                    province: province.trim(),
                    district: district.trim(),
                    subdistrict: subdistrict.trim(),
                    zipcode: zipcode.trim(),
                }),
            });

            if (res.ok) {
                setName("");
                setPickedPosition(null);
                setOrganization("");
                setCustomOrg("");
                setOrgSearch("");
                setProvince("");
                setDistrict("");
                setSubdistrict("");
                setZipcode("");
                fetchLocations(true);
                showToast(`เพิ่มสถานี "${stationName}" เรียบร้อยแล้ว`, "success");
            }
        } catch (err) {
            console.error("Failed to create location:", err);
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = async () => {
        const editedName = editName.trim();
        if (!editingLoc || !editedName || !editOrg.trim() || !currentUser) return;

        const confirmed = await confirmDialog({
            title: "ยืนยันแก้ไขสถานี?",
            text: `บันทึกการแก้ไขข้อมูลสถานี "${editedName}"`,
            confirmText: "บันทึก",
            tone: "warning",
        });
        if (!confirmed) return;

        setEditSaving(true);
        try {
            const res = await fetch("/api/locations", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${liff.getAccessToken()}`,
                },
                body: JSON.stringify({
                    id: editingLoc.id,
                    name: editedName,
                    organization: editOrg.trim(),
                    province: editProvince.trim(),
                    district: editDistrict.trim(),
                    subdistrict: editSubdistrict.trim(),
                    zipcode: editZipcode.trim(),
                }),
            });
            if (res.ok) {
                setEditingLoc(null);
                fetchLocations(true);
                showToast(`อัปเดตข้อมูลสถานี "${editedName}" แล้ว`, "success");
            }
        } catch (err) {
            console.error("Failed to update location:", err);
        } finally {
            setEditSaving(false);
        }
    };

    const handleDelete = async (loc: LocationItem) => {
        if (!currentUser) return;

        const confirmed = await confirmDialog({
            title: "ยืนยันลบสถานี?",
            text: `ลบสถานี "${loc.name}" พร้อมผลข้อมูลประวัติทิ้งถาวร — ไม่สามารถย้อนกลับได้`,
            confirmText: "ลบสถานี",
            tone: "danger",
        });
        if (!confirmed) return;

        setDeletingId(loc.id);
        try {
            const res = await fetch(`/api/locations?id=${loc.id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${liff.getAccessToken()}`,
                },
            });
            if (res.ok) {
                fetchLocations(true);
                showToast(`ลบสถานี "${loc.name}" ออกจากระบบแล้ว`, "danger");
            }
        } catch (err) {
            console.error("Failed to delete location:", err);
        } finally {
            setDeletingId(null);
        }
    };

    const openEdit = (loc: LocationItem) => {
        setEditingLoc(loc);
        setEditName(loc.name);
        setEditOrg(loc.organization);
        setEditProvince(loc.province || "");
        setEditDistrict(loc.district || "");
        setEditSubdistrict(loc.subdistrict || "");
        setEditZipcode(loc.zipcode || "");
    };

    if (!currentUser || currentUser.role !== "admin") {
        return (
            <div className="flex flex-col items-center justify-center min-h-dvh px-6 text-center w-full max-w-lg mx-auto bg-surface-muted border-x border-border">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center mb-4 border border-red-500/20">
                    <ShieldAlert size={28} className="animate-pulse" />
                </div>
                <h1 className="font-display text-base font-normal text-text-primary mb-1">สิทธิ์การเข้าถึงถูกจำกัด</h1>
                <p className="text-xs text-text-secondary mb-6 max-w-[80%] mx-auto leading-relaxed">หน้าการกำหนดค่าพิกัดพ้นกรอบการจัดการทั่วไป สำหรับผู้ดูแลระบบสูงสุด (System Admin) เท่านั้น</p>
                <button
                    onClick={() => router.push("/map")}
                    className="w-full max-w-50 py-3.5 bg-primary hover:bg-navy-dark text-white font-semibold rounded-2xl text-xs uppercase tracking-wider shadow-sm transition-colors cursor-pointer"
                >
                    กลับไปหน้าแผนที่
                </button>
            </div>
        );
    }

    const uniqueOrgs = Array.from(new Set(locations.map((l) => l.organization).filter(Boolean)));
    const stationKeyword = stationSearch.trim().toLowerCase();
    const filteredLocations = stationKeyword ? locations.filter((loc) => loc.name.toLowerCase().includes(stationKeyword) || loc.organization.toLowerCase().includes(stationKeyword)) : locations;

    const orgKeyword = orgSearch.trim().toLowerCase();
    const orgOptions = orgKeyword ? uniqueOrgs.filter((org) => org.toLowerCase().includes(orgKeyword)) : uniqueOrgs;

    const props = {
        router,
        MapView,
        toastElement,
        name,
        setName,
        organization,
        setOrganization,
        customOrg,
        setCustomOrg,
        pickedPosition,
        setPickedPosition,
        province, setProvince,
        district, setDistrict,
        subdistrict, setSubdistrict,
        zipcode, setZipcode,
        saving,
        orgSearch,
        setOrgSearch,
        orgDropdownOpen,
        setOrgDropdownOpen,
        inputLat,
        inputLng,
        placeSearch,
        placeResults,
        isSearchingPlace,
        showPlaceDropdown,
        handleSearchPlace,
        handleSelectPlace,
        handleManualCoordsChange,
        getOrgValue,
        handleSubmit,
        locations,
        stationSearch,
        setStationSearch,
        filteredLocations,
        uniqueOrgs,
        orgOptions,
        deletingId,
        openEdit,
        handleDelete,
        editingLoc,
        setEditingLoc,
        editName,
        setEditName,
        editOrg,
        setEditOrg,
        editProvince, setEditProvince,
        editDistrict, setEditDistrict,
        editSubdistrict, setEditSubdistrict,
        editZipcode, setEditZipcode,
        editSaving,
        handleEdit,
    };

    return isMobile ? <LocationsMobile {...props} /> : <LocationsDesktop {...props} />;
}
