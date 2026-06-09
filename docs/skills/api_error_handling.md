# Skill: Next.js API Error Handling

## เป้าหมาย (Objective)
เพื่อจัดการข้อผิดพลาด (Error Handling) ของ API Routes ใน Next.js และ Database Prisma ให้เป็นมาตรฐานเดียวกัน ป้องกันแอปพลิเคชันล่ม (Crash) และส่งข้อความแจ้งเตือนที่ชัดเจนไปยังฝั่ง Client

## เครื่องมือที่อนุญาต (Tech Stack & Versions)
- Next.js 14+ (App Router)
- Prisma ORM
- TypeScript

## โครงสร้างโค้ดที่ต้องการ (Expected Structure)
- ต้องใช้ `try...catch` block เสมอในระดับบนสุดของทุกๆ API Route Handler (`route.ts`)
- สร้าง Standard JSON Response Format สำหรับ Error เช่น:
  `{ success: false, error: "Friendly Error Message", errorCode: "ERR_XXXX" }`
- ควรแยกการจัดการ Error เฉพาะทางของ Prisma (เช่น ข้อมูลซ้ำ, หาไม่เจอ, DB ตัดการเชื่อมต่อ) ออกมาเป็น Utility function

## ขั้นตอนการทำ (Step-by-step)
1. **Try-Catch Block**: ห่อหุ้ม Logic ใน `GET`, `POST`, `PUT`, `DELETE` ด้วย `try...catch` เสมอ
2. **Prisma Error Classification**: ใน block `catch` ให้ตรวจสอบชนิดของ Error เช่น `if (error instanceof Prisma.PrismaClientKnownRequestError)`
3. **Log Error**: บันทึก Error จริงลง Console ฝั่ง Server เสมอ พร้อมระบุ tag ชัดเจน (เช่น `console.error('[API_LOCATIONS_GET]', error)`)
4. **Return Response**: ใช้ `NextResponse.json()` ส่ง HTTP Status Code ที่ถูกต้อง (เช่น 400 สำหรับ Bad Request, 404 Not Found, 500 สำหรับ Internal Server Error)
5. **Graceful Degradation**: ฝั่ง Frontend เมื่อได้รับ Error Status ให้แสดง Fallback UI หรือ Toast Notification อย่างสุภาพ ไม่เอา Error Code ดิบๆ ไปแสดงให้ User เห็น

## ข้อห้าม (Anti-patterns)
- ❌ **ห้ามส่ง Error Object ดิบ** หรือ Stack Trace กลับไปให้ Frontend ในโหมด Production เป็นอันขาด (เพราะอาจเผยแพร่ข้อมูลโครงสร้าง DB หรือ Credential)
- ❌ **ห้ามละเลย Prisma Connection Errors** (เช่น P1017) ระบบต้องดักจับและแจ้งว่า Database ไม่พร้อมใช้งานแทนที่จะปล่อยให้ Request ค้างจน Timeout
- ❌ **ห้ามใช้ HTTP Status `200 OK` คู่กับ Response ว่ามี Error** (เช่น `res.status(200).json({ error: "Failed" })`) ต้องใช้ HTTP Status ที่สะท้อนผลลัพธ์อย่างถูกต้อง
