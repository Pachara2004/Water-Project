"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronDown } from "lucide-react";

// Structure: { [province]: { [district]: { [subdistrict]: "zipcode" } } }
type AddressTree = Record<string, Record<string, Record<string, string>>>;

interface ThaiAddressSelectorProps {
    province: string;
    setProvince: (v: string) => void;
    district: string;
    setDistrict: (v: string) => void;
    subdistrict: string;
    setSubdistrict: (v: string) => void;
    zipcode: string;
    setZipcode: (v: string) => void;
    onGeocode?: (lat: number, lng: number) => void;
}

export function ThaiAddressSelector({
    province, setProvince,
    district, setDistrict,
    subdistrict, setSubdistrict,
    zipcode, setZipcode,
    onGeocode,
}: ThaiAddressSelectorProps) {
    const [tree, setTree] = useState<AddressTree | null>(null);

    useEffect(() => {
        fetch("/data/thai_address.json")
            .then(res => res.json())
            .then(data => setTree(data))
            .catch(err => console.error("Failed to load thai address data", err));
    }, []);

    const provinces = useMemo(() => {
        if (!tree) return [];
        return Object.keys(tree).sort();
    }, [tree]);

    const districts = useMemo(() => {
        if (!tree || !province || !tree[province]) return [];
        return Object.keys(tree[province]).sort();
    }, [tree, province]);

    const subdistricts = useMemo(() => {
        if (!tree || !province || !district || !tree[province][district]) return [];
        return Object.keys(tree[province][district]).sort();
    }, [tree, province, district]);

    const handleProvinceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const p = e.target.value;
        setProvince(p);
        setDistrict("");
        setSubdistrict("");
        setZipcode("");
        
        if (p && onGeocode) {
            try {
                const res = await fetch(`/api/nominatim?type=search&q=${encodeURIComponent(p + " จังหวัด")}`);
                const data = await res.json();
                if (data && data[0]) onGeocode(parseFloat(data[0].lat), parseFloat(data[0].lon));
            } catch(e){}
        }
    };

    const handleDistrictChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const d = e.target.value;
        setDistrict(d);
        setSubdistrict("");
        setZipcode("");
        
        if (d && province && onGeocode) {
            try {
                const res = await fetch(`/api/nominatim?type=search&q=${encodeURIComponent(d + " " + province)}`);
                const data = await res.json();
                if (data && data[0]) onGeocode(parseFloat(data[0].lat), parseFloat(data[0].lon));
            } catch(e){}
        }
    };

    const handleSubdistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const s = e.target.value;
        setSubdistrict(s);
    };

    // Auto-fill zipcode if province, district, subdistrict change
    useEffect(() => {
        if (tree && province && district && subdistrict && tree[province]?.[district]?.[subdistrict]) {
            setZipcode(tree[province][district][subdistrict]);
        } else if (!subdistrict) {
            setZipcode("");
        }
    }, [tree, province, district, subdistrict, setZipcode]);

    return (
        <>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-text-primary block uppercase tracking-wide">จังหวัด</label>
                    <div className="relative">
                        <select
                            value={province}
                            onChange={handleProvinceChange}
                            className="w-full px-4 py-3 bg-surface-subtle border border-border text-text-primary rounded-xl text-xs  outline-none min-h-11 font-semibold appearance-none cursor-pointer"
                            disabled={!tree}
                        >
                            <option value="">-- เลือกจังหวัด --</option>
                            {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-text-primary block uppercase tracking-wide">อำเภอ/เขต</label>
                    <div className="relative">
                        <select
                            value={district}
                            onChange={handleDistrictChange}
                            className="w-full px-4 py-3 bg-surface-subtle border border-border text-text-primary rounded-xl text-xs outline-none min-h-11 font-semibold appearance-none cursor-pointer disabled:opacity-50"
                            disabled={!province || districts.length === 0}
                        >
                            <option value="">-- เลือกอำเภอ --</option>
                            {districts.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-text-primary block uppercase tracking-wide">ตำบล/แขวง</label>
                    <div className="relative">
                        <select
                            value={subdistrict}
                            onChange={handleSubdistrictChange}
                            className="w-full px-4 py-3 bg-surface-subtle border border-border text-text-primary rounded-xl text-xs outline-none min-h-11 font-semibold appearance-none cursor-pointer disabled:opacity-50"
                            disabled={!district || subdistricts.length === 0}
                        >
                            <option value="">-- เลือกตำบล --</option>
                            {subdistricts.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-text-primary block uppercase tracking-wide">รหัสไปรษณีย์</label>
                    <input 
                        type="text" 
                        value={zipcode} 
                        onChange={(e) => setZipcode(e.target.value)} 
                        className="w-full px-4 py-3 bg-surface-subtle border border-border text-text-primary rounded-xl text-xs outline-none min-h-11 font-semibold" 
                        placeholder="กรอกอัตโนมัติ" 
                    />
                </div>
            </div>
        </>
    );
}
