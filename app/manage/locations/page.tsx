"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import liff from "@line/liff";
import { useAppStore } from "@/lib/store";
import { confirmDialog } from "@/lib/swal";
import { useToast } from "@/components/useToast";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ShieldAlert } from "lucide-react";
import { type LocationItem } from "@/components/manage/locationsHelpers";
import { useThaiAddressTree, validateAddressParts, type AddressTree } from "@/lib/hooks/useThaiAddressTree";
import LocationsMobile from "./locationsMobile";
import LocationsDesktop from "./locationsDesktop";

// กรอบพิกัดคร่าว ๆ ของประเทศไทย ใช้คัดกรองเบื้องต้นแบบไม่ต้องยิงเน็ต
// กรอบสี่เหลี่ยมย่อมกินพื้นที่ประเทศเพื่อนบ้านบ้าง จึงเป็นแค่ด่านแรก
// ด่านชี้ขาดคือ countryCode จากผล reverse geocode (ดู useEffect ของ pickedPosition)
const TH_BOUNDS = { minLat: 5.5, maxLat: 20.5, minLng: 97.3, maxLng: 105.7 };

function isWithinThaiBounds(lat: number, lng: number): boolean {
    return lat >= TH_BOUNDS.minLat && lat <= TH_BOUNDS.maxLat && lng >= TH_BOUNDS.minLng && lng <= TH_BOUNDS.maxLng;
}

/**
 * แยกจังหวัด/อำเภอ/ตำบล จากรายการเขตการปกครองที่ reverse geocode คืนมา
 *
 * ยึด adminLevel เป็นหลัก (4=จังหวัด, 6=อำเภอ/เขต, 8=ตำบล/แขวง) ควบกับคำนำหน้าราชการ
 * เพราะสองอย่างนี้อย่างเดียวไม่พอ:
 * - adminLevel เดียวกันมีได้หลายรายการ เช่น level 6 มีทั้ง "เทศบาลเมืองชลบุรี" และ "อำเภอเมืองชลบุรี"
 * - การค้นคำแบบ includes ทำให้ชื่อองค์กรปกครองท้องถิ่นถูกเข้าใจผิดเป็นตำบล
 *   เคสจริง: จุดที่บางปู สมุทรปราการ มี "เทศบาลตำบลบางปู" (level 7) ทำให้ได้ตำบล "บางปู"
 *   ทั้งที่จุดนั้นอยู่ตำบล "บางปูใหม่" — ทั้งสองชื่อมีจริงในอำเภอเดียวกัน ตัวตรวจที่อยู่จึงจับไม่ได้
 *
 * ใช้ startsWith ไม่ใช่ includes และเลือกรายการที่เจาะจงที่สุด (order สูงสุด) เมื่อมีหลายตัวในระดับเดียวกัน
 * ชื่อที่ไม่เข้าเกณฑ์ (เช่น ชื่อภาษาอังกฤษ) จะถูกข้าม ปล่อยให้ผู้ใช้เลือกเองดีกว่าเดาผิด
 */
function parseAdministrative(admin: any[]): { province: string; district: string; subdistrict: string } {
    const pick = (level: number, prefixes: string[]): string => {
        const matches = admin.filter((part) => part?.adminLevel === level && typeof part.name === "string" && prefixes.some((p) => part.name.startsWith(p)));
        if (matches.length === 0) return "";
        const best = matches.reduce((a, b) => ((b.order ?? 0) >= (a.order ?? 0) ? b : a));
        const prefix = prefixes.find((p) => best.name.startsWith(p))!;
        return best.name.slice(prefix.length).trim();
    };

    // กรุงเทพฯ ไม่มีคำนำหน้า "จังหวัด" จึงต้องรับเป็นกรณีเฉพาะ
    const bangkok = admin.some((part) => part?.adminLevel === 4 && part.name === "กรุงเทพมหานคร");

    return {
        province: bangkok ? "กรุงเทพมหานคร" : pick(4, ["จังหวัด"]),
        district: pick(6, ["อำเภอ", "เขต"]),
        subdistrict: pick(8, ["ตำบล", "แขวง"]),
    };
}

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
    const [pickedPosition, setPickedPositionRaw] = useState<{
        lat: number;
        lng: number;
    } | null>(null);
    // ตำแหน่งที่ผ่านการยืนยันว่าอยู่ในไทยล่าสุด ใช้ถอยกลับเมื่อผู้ใช้ปักนอกประเทศ
    const lastValidPositionRef = useRef<{ lat: number; lng: number } | null>(null);

    // คำสั่งเลื่อนจอแผนที่กลับเข้ากรอบไทยโดยไม่ปักหมุด (nonce ทำให้สั่งซ้ำได้)
    const [panInside, setPanInside] = useState<{ bounds: [[number, number], [number, number]]; nonce: number } | null>(null);

    // เก็บไว้ใน ref เพื่อให้ effect ของ reverse geocode อ่านค่าล่าสุดได้
    // โดยไม่ต้องใส่ใน dependency ซึ่งจะทำให้ยิง geocode ซ้ำตอนข้อมูลที่อยู่โหลดเสร็จ
    const addressTree = useThaiAddressTree();
    const treeRef = useRef<AddressTree | null>(null);
    useEffect(() => {
        treeRef.current = addressTree;
    }, [addressTree]);
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

    // ตัวตั้งพิกัดที่ทุกทาง (แตะแผนที่ / ค้นหาสถานที่ / พิมพ์พิกัดเอง / เลือกจังหวัด) เรียกผ่าน
    // ด่านแรกกันด้วยกรอบพิกัด ส่วนจุดที่อยู่ในกรอบแต่เป็นประเทศเพื่อนบ้านจะถูกปฏิเสธ
    // อีกทีใน useEffect ด้านล่างเมื่อรู้ countryCode
    const setPickedPosition = useCallback(
        (pos: { lat: number; lng: number } | null) => {
            if (pos && !isWithinThaiBounds(pos.lat, pos.lng)) {
                showToast("จุดนี้อยู่นอกประเทศไทย กรุณาเลือกตำแหน่งภายในประเทศ", "danger");
                // ยังไม่มีหมุดอยู่บนแผนที่ = ไม่มีตำแหน่งให้ถอยกลับ จอจะค้างอยู่นอกประเทศ
                // จึงเลื่อนจอให้พื้นที่ที่มองเห็นกลับเข้ากรอบไทย (ไม่ปักหมุดให้ และไม่เปลี่ยนระดับซูม)
                // ต้องดูจาก pickedPosition ปัจจุบัน ไม่ใช่ lastValidPositionRef ซึ่งค้างค่าเดิมไว้
                // แม้หมุดถูกล้างไปแล้ว (เช่นหลังบันทึกสถานีเสร็จ) จะทำให้เงื่อนไขนี้ไม่มีวันเป็นจริง
                if (!pickedPosition) {
                    setPanInside({
                        bounds: [
                            [TH_BOUNDS.minLat, TH_BOUNDS.minLng],
                            [TH_BOUNDS.maxLat, TH_BOUNDS.maxLng],
                        ],
                        nonce: Date.now(),
                    });
                }
                return;
            }
            setPickedPositionRaw(pos);
        },
        [showToast, pickedPosition],
    );

    // 🌟 3. Sync พิกัดเมื่อผู้ใช้แตะปักหมุดบนแผนที่ ➔ อัปเดตลงช่อง Input และดึงที่อยู่อัตโนมัติ
    useEffect(() => {
        if (pickedPosition) {
            setInputLat(pickedPosition.lat.toFixed(6));
            setInputLng(pickedPosition.lng.toFixed(6));

            // เรียก BigDataCloud Reverse Geocoding (ไม่ต้องใช้ API Key, รองรับภาษาไทย, ไม่ติด Rate Limit หนัก)
            fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pickedPosition.lat}&longitude=${pickedPosition.lng}&localityLanguage=th`)
                .then(res => res.json())
                .then(data => {
                    // ด่านชี้ขาด: จุดที่อยู่ในกรอบพิกัดแต่เป็นประเทศเพื่อนบ้าน จะถูกถอยกลับตรงนี้
                    // ต้องกันไว้ก่อนนำชื่อเขตการปกครองมาใส่ฟอร์ม ไม่งั้นจะได้ชื่อต่างประเทศ
                    // ที่ไม่มีอยู่ใน thai_address.json ปนเข้ามา
                    if (data && data.countryCode && data.countryCode !== "TH") {
                        showToast("จุดนี้อยู่นอกประเทศไทย กรุณาเลือกตำแหน่งภายในประเทศ", "danger");
                        setProvince("");
                        setDistrict("");
                        setSubdistrict("");
                        setZipcode("");
                        setPickedPositionRaw(lastValidPositionRef.current);
                        return;
                    }
                    lastValidPositionRef.current = pickedPosition;

                    if (data && data.localityInfo && data.localityInfo.administrative) {
                        const admin = data.localityInfo.administrative;
                        const { province: pProv, district: pDist, subdistrict: pSub } = parseAdministrative(admin);

                        // ข้อมูลที่อยู่ยังโหลดไม่เสร็จ ตรวจสอบไม่ได้ จึงข้ามการเติมอัตโนมัติรอบนี้
                        // ปล่อยให้ผู้ใช้เลือกเอง ดีกว่าเติมค่าที่ยังไม่ได้ตรวจหรือล้างของเดิมทิ้ง
                        if (!treeRef.current) return;

                        // รับเฉพาะค่าที่มีอยู่จริงในฐานข้อมูลที่อยู่ไทย ส่วนที่ไม่ผ่านจะถูกตัดทิ้ง
                        // ให้ผู้ใช้เลือกเองจากดรอปดาวน์ ดีกว่าโชว์ค่าที่เลือกซ้ำไม่ได้และบันทึกผิด
                        const valid = validateAddressParts(treeRef.current, pProv, pDist, pSub);

                        setProvince(valid.province);
                        setDistrict(valid.district);
                        setSubdistrict(valid.subdistrict);

                        // ไม่ใช้ postcode จาก geocoder — รหัสไปรษณีย์ที่ถูกต้องผูกกับตำบล
                        // ThaiAddressSelector จะเติมให้เองจากฐานข้อมูลเมื่อที่อยู่ครบทั้งสามระดับ
                        if (!valid.subdistrict) setZipcode("");
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
                // ล้างตำแหน่งอ้างอิงด้วย ไม่งั้นการเพิ่มสถานีถัดไปจะถอยหมุดกลับไปที่สถานีก่อนหน้า
                lastValidPositionRef.current = null;
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
        panInside,
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
