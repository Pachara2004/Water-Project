// ค่าคงที่ที่ใช้ร่วมกันทั้งฝั่ง client (ฟอร์ม + counter) และ server (validate)
// แยกจาก lib/review.ts เพราะไฟล์นั้น import prisma (server-only) — ไฟล์นี้ต้อง client-safe

// จำกัดความยาวเหตุผลปฏิเสธคำร้อง — เหตุผลควรสั้นกระชับ อ่านง่ายสำหรับผู้เก็บตัวอย่าง
export const REVIEW_NOTE_MAX_LENGTH = 200;
