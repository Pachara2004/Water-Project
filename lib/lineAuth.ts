/**
 * @file lib/lineAuth.ts
 * @project Water Monitoring Project
 * @module Client / LINE Authentication & Terms Workflow
 * @description
 * [TH] โมดูลจัดการขั้นตอนการยืนยันตัวตนผ่าน LINE LIFF บนฝั่งไคลเอนต์
 * จัดการลำดับขั้นตอนการตรวจสอบสถานะการลงทะเบียนและการยอมรับข้อตกลงการใช้งาน (Terms & PDPA)
 * ก่อนอนุญาตให้บันทึก LINE UID ลงในฐานข้อมูลเซิร์ฟเวอร์ โดยใช้ร่วมกันระหว่าง LiffProvider และ Navbar
 *
 * [EN] Client-side LINE LIFF authentication orchestration and terms gatekeeping module.
 * Manages verification flow for user registration status and terms/privacy policy acceptance
 * prior to persisting LINE UID into the database. Shared between LiffProvider and navigation components.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-09-15
 * @modified 2026-09-15
 * @version 1.0.0
 * @license Proprietary
 *
 * @see {@link /lib/store.ts} Global application Zustand store
 * @see {@link /app/api/auth/route.ts} Backend LINE authentication route
 * @see {@link /app/api/auth/status/route.ts} Backend terms acceptance check endpoint
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-09-15)
 *
 * @lastModified 2026-09-15
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-09-15 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - feat: ต้องยอมรับข้อตกลงก่อนระบบจะเก็บ LINE uid
 */

import liff from "@line/liff";
import { useAppStore, type CurrentUser } from "@/lib/store";

// ขั้นตอนหลัง LIFF ล็อกอินสำเร็จ ใช้ร่วมกันระหว่าง LiffProvider (ตอนเปิดแอป) และ Navbar (กดเข้าสู่ระบบในแอป LINE)
//
// POST /api/auth เป็นจุดที่ LINE uid ถูกเขียนลง DB และฝั่ง server จะไม่สร้างบัญชีใหม่ถ้าไม่แนบ acceptedTerms
// การยอมรับผูกกับบัญชี (users.terms_version) ไม่ใช่เครื่อง — เปลี่ยนเครื่องไม่ต้องอ่านซ้ำ เปลี่ยนฉบับถามใหม่ครั้งเดียว

/**
 * [TH] ประเภทของสถานะการรอการยอมรับข้อตกลง ('new' สำหรับผู้ใช้ใหม่ที่ยังไม่เคยลงทะเบียน, 'existing' สำหรับผู้ใช้เก่าที่ต้องยอมรับเงื่อนไขฉบับปรับปรุง)
 * [EN] Kind of pending terms acceptance ('new' for unregistered users, 'existing' for existing accounts requiring updated terms consent)
 */
export type PendingTermsKind = "new" | "existing";

/**
 * [TH] ข้อมูลสถานะการลงทะเบียนและการยอมรับเงื่อนไขจากเซิร์ฟเวอร์
 * [EN] Registration and terms acceptance status response from server
 */
export interface AuthStatus {
    /** [TH] บัญชีผู้ใช้เคยลงทะเบียนในระบบแล้วหรือไม่ | [EN] Whether user account is registered */
    registered: boolean;
    /** [TH] ผู้ใช้ยอมรับเงื่อนไขเวอร์ชันปัจจุบันแล้วหรือไม่ | [EN] Whether current terms version has been accepted */
    termsAccepted: boolean;
}

/**
 * [TH] สร้าง HTTP Header สำหรับการยืนยันตัวตนด้วย LINE Access Token ปัจจุบัน
 * [EN] Constructs HTTP Authorization header using active LINE Access Token
 *
 * @returns {{ Authorization: string }} Header object ที่บรรจุ Bearer token
 */
function authHeader(): { Authorization: string } {
    return { Authorization: `Bearer ${liff.getAccessToken()}` };
}

/**
 * [TH] ตรวจสอบกับเซิร์ฟเวอร์ว่า LINE UID ของผู้ใช้ปัจจุบันมีบัญชีแล้วหรือยัง และยอมรับข้อตกลงฉบับปัจจุบันหรือยัง
 * [EN] Queries server to check if current LINE user has an account and has accepted active terms version (read-only)
 *
 * @async
 * @function fetchAuthStatus
 * @returns {Promise<AuthStatus>} ออบเจกต์ระบุสถานะ registered และ termsAccepted
 * @throws {Error} เมื่อไม่สามารถเชื่อมต่อหรือตรวจสอบสถานะกับ API ได้
 */
export async function fetchAuthStatus(): Promise<AuthStatus> {
    const res = await fetch("/api/auth/status", { headers: authHeader() });
    if (!res.ok) throw new Error("Failed to check registration status");
    return res.json();
}

/**
 * [TH] ส่งคำขอ POST ไปยัง /api/auth เพื่อเข้าสู่ระบบหรือสร้างบัญชีผู้ใช้ใหม่จาก LINE Profile แล้วคืนข้อมูลผู้ใช้กลับมา
 * เซิร์ฟเวอร์จะปฏิเสธการสร้างบัญชีใหม่หาก `acceptedTerms` ไม่เป็นจริง (true)
 *
 * [EN] Sends POST request to /api/auth to login or register a user account from LINE profile.
 * The server strictly requires `acceptedTerms = true` for new user record creation.
 *
 * @async
 * @function fetchLineUser
 * @param {boolean} [acceptedTerms=false] - ผู้ใช้ได้ยอมรับข้อตกลงและนโยบายความเป็นส่วนตัวแล้วหรือไม่
 * @returns {Promise<CurrentUser>} ข้อมูลผู้ใช้ที่เข้าสู่ระบบสำเร็จ
 * @throws {Error} เมื่อการยืนยันตัวตนกับ Backend ล้มเหลว
 */
export async function fetchLineUser(acceptedTerms = false): Promise<CurrentUser> {
    const profile = await liff.getProfile();
    const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: liff.getAccessToken(), name: profile.displayName, acceptedTerms }),
    });
    if (!res.ok) throw new Error("Failed to authenticate with backend");
    return res.json();
}

/**
 * [TH] บันทึกการยอมรับข้อตกลงฉบับปัจจุบันสำหรับบัญชีที่มีอยู่ในระบบแล้ว (POST /api/auth/accept-terms)
 * ใช้ในกรณีที่ผู้ใช้เก่าล็อกอินเข้ามาและมีข้อตกลงการใช้งานเวอร์ชันใหม่ที่ต้องกดยินยอม
 *
 * [EN] Records acceptance of active terms version for existing accounts via POST /api/auth/accept-terms.
 * Invoked when legacy or existing users need to consent to a bumped terms version.
 *
 * @async
 * @function acceptTermsForExistingUser
 * @returns {Promise<void>}
 * @throws {Error} เมื่อการบันทึกการยอมรับเงื่อนไขล้มเหลว
 */
export async function acceptTermsForExistingUser(): Promise<void> {
    const res = await fetch("/api/auth/accept-terms", { method: "POST", headers: authHeader() });
    if (!res.ok) throw new Error("Failed to record terms acceptance");
}

/**
 * [TH] ควบคุมลำดับการเข้าสู่ระบบหลัง LIFF สำเร็จ:
 * หากบัญชียอมรับข้อตกลงฉบับปัจจุบันแล้ว จะยิง /api/auth เพื่อเข้าสู่ระบบทันที
 * หากยังไม่มีบัญชี หรือเวอร์ชันข้อตกลงไม่ตรง จะเปิดหน้า TermsGate ผ่านการตั้งค่า `pendingTermsLogin` ใน AppStore
 *
 * [EN] Orchestrates authentication sequence after LIFF initialization:
 * If user is already registered and terms are up to date, logs in immediately via /api/auth.
 * Otherwise, opens the TermsGate modal via `pendingTermsLogin` store state for user consent.
 *
 * @async
 * @function loginAfterLiff
 * @returns {Promise<void>}
 */
export async function loginAfterLiff(): Promise<void> {
    const store = useAppStore.getState();
    const status = await fetchAuthStatus();
    if (status.registered && status.termsAccepted) {
        store.setUser(await fetchLineUser());
        return;
    }
    store.setPendingTermsLogin(status.registered ? "existing" : "new");
}

/**
 * [TH] ดำเนินการเมื่อผู้ใช้กดยอมรับข้อตกลงบน TermsGate Modal
 * บันทึกการยอมรับตามประเภทบัญชี (`existing` หรือ `new`) แล้วเข้าสู่ระบบและรีเซ็ตสถานะ `pendingTermsLogin` เป็น null
 *
 * [EN] Handles terms acceptance submission from the TermsGate modal.
 * Persists consent based on account kind (`existing` vs `new`), logs user in, and clears modal pending state.
 *
 * @async
 * @function acceptTermsAndLogin
 * @param {PendingTermsKind} kind - ประเภทของการยอมรับ ('existing' สำหรับบัญชีเก่า, 'new' สำหรับลงทะเบียนใหม่)
 * @returns {Promise<void>}
 */
export async function acceptTermsAndLogin(kind: PendingTermsKind): Promise<void> {
    const store = useAppStore.getState();
    if (kind === "existing") {
        await acceptTermsForExistingUser();
        store.setUser(await fetchLineUser());
    } else {
        store.setUser(await fetchLineUser(true));
    }
    store.setPendingTermsLogin(null);
}
