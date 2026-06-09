# Skill: Data Validation and Pipeline

## เป้าหมาย (Objective)
เพื่อทำความสะอาดและตรวจสอบข้อมูล (Data Validation & Sanitization) ที่ได้รับจากผู้ใช้ก่อนที่จะนำไปประมวลผลหรือบันทึกลงฐานข้อมูล เพื่อป้องกัน Bug และรักษา Data Integrity ของระบบ

## เครื่องมือที่อนุญาต (Tech Stack & Versions)
- TypeScript / JavaScript
- Zod (สำหรับการตรวจสอบและกำหนดโครงสร้างข้อมูล)

## โครงสร้างโค้ดที่ต้องการ (Expected Structure)
- แยกไฟล์ Zod Schema ออกจาก API Route อย่างชัดเจน (เช่นเก็บไว้ในโฟลเดอร์ `lib/validations/` หรือ `schema/`)
- ใช้ Validation Logic ก่อนที่จะเรียกใช้งาน Database (Prisma) ทุกครั้ง

## ขั้นตอนการทำ (Step-by-step)
1. **Schema Definition**: นิยามโครงสร้างข้อมูลด้วย Zod เช่น `latitude` ต้องอยู่ระหว่าง -90 ถึง 90, ส่วน `waterQualityScore` ต้องอยู่ระหว่าง 0-100
2. **Data Parsing**: รับ Request Body และนำไปตรวจสอบโครงสร้างด้วยคำสั่ง `schema.safeParse(body)`
3. **Sanitization**: หากมีการใช้ String ให้ออกแบบ Schema เพื่อตัดช่องว่างหน้า-หลัง (Trim) หรือแปลงตัวพิมพ์อัตโนมัติหากจำเป็น
4. **Validation Handling**: ถ้าผล `safeParse()` ไม่ผ่าน (`success === false`) ให้ส่ง HTTP 400 กลับไปทันที พร้อมรายละเอียด `error.issues` เพื่อบอก Frontend ว่าฟิลด์ไหนส่งมาผิด
5. **Database Operation**: เมื่อข้อมูลผ่าน Validation ถือว่าข้อมูลปลอดภัย (Typed and Validated) ค่อยส่งไปบันทึกลงฐานข้อมูลอย่างปลอดภัย

## ข้อห้าม (Anti-patterns)
- ❌ **ห้ามรับข้อมูลจาก Client แล้วบันทึกลง Database โดยตรง** เด็ดขาดโดยไม่ผ่านการตรวจสอบ (Never trust client input)
- ❌ **ห้ามใช้ Type Assertion แบบบังคับ** (เช่น `const data = body as LocationData`) เพราะจะทำให้ TypeScript เสียประโยชน์และเสี่ยงต่อ Runtime Error
- ❌ **ห้ามเขียน Validation ซับซ้อนด้วย `if-else` ยาวๆ** ให้ใช้พลังของ Schema Validation Library (Zod) เข้ามาจัดการแทน
