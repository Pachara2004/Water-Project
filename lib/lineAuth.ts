import liff from "@line/liff";
import { useAppStore, type CurrentUser } from "@/lib/store";

// ขั้นตอนหลัง LIFF ล็อกอินสำเร็จ ใช้ร่วมกันระหว่าง LiffProvider (ตอนเปิดแอป) และ Navbar (กดเข้าสู่ระบบในแอป LINE)
//
// POST /api/auth เป็นจุดที่ LINE uid ถูกเขียนลง DB และฝั่ง server จะไม่สร้างบัญชีใหม่ถ้าไม่แนบ acceptedTerms
// การยอมรับผูกกับบัญชี (users.terms_version) ไม่ใช่เครื่อง — เปลี่ยนเครื่องไม่ต้องอ่านซ้ำ เปลี่ยนฉบับถามใหม่ครั้งเดียว

export type PendingTermsKind = "new" | "existing";

interface AuthStatus {
    registered: boolean;
    termsAccepted: boolean;
}

function authHeader() {
    return { Authorization: `Bearer ${liff.getAccessToken()}` };
}

/** ถาม server ว่า uid ของ token ปัจจุบันมีบัญชีแล้วหรือยัง และยอมรับข้อตกลงฉบับปัจจุบันหรือยัง (ไม่เขียน DB) */
export async function fetchAuthStatus(): Promise<AuthStatus> {
    const res = await fetch("/api/auth/status", { headers: authHeader() });
    if (!res.ok) throw new Error("Failed to check registration status");
    return res.json();
}

/** POST /api/auth — ล็อกอิน/สร้างผู้ใช้จาก LINE แล้วคืนข้อมูลผู้ใช้ (สร้างใหม่ได้เฉพาะเมื่อ acceptedTerms) */
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

/** บันทึกการยอมรับข้อตกลงฉบับปัจจุบันให้บัญชีที่มีอยู่แล้ว */
export async function acceptTermsForExistingUser(): Promise<void> {
    const res = await fetch("/api/auth/accept-terms", { method: "POST", headers: authHeader() });
    if (!res.ok) throw new Error("Failed to record terms acceptance");
}

/**
 * เข้าสู่ระบบต่อจาก LIFF: ถ้าบัญชียอมรับข้อตกลงฉบับปัจจุบันแล้ว → ยิง /api/auth ทันที
 * ไม่งั้น (ยังไม่มีบัญชี หรือฉบับไม่ตรง) เปิดหน้าข้อตกลงผ่าน pendingTermsLogin แล้วให้ผู้ใช้ตัดสินใจก่อน
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

/** ผู้ใช้กดยอมรับบน TermsGate → บันทึกให้ถูกที่ตามว่ามีบัญชีหรือยัง แล้วล็อกอิน */
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
