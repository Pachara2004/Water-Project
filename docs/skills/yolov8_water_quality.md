# Skill: YOLOv8 Water Quality Detection

## เป้าหมาย (Objective)
เพื่อใช้ YOLOv8 และ OpenCV ในการตรวจจับและวิเคราะห์แถบสีของแผ่นทดสอบคุณภาพน้ำ (Water Testkit) เช่น ค่าฟอสเฟต (Phosphate) และแอมโมเนีย (Ammonia) จากภาพถ่ายได้อย่างแม่นยำ

## เครื่องมือที่อนุญาต (Tech Stack & Versions)
- Python 3.10+
- ultralytics (YOLOv8)
- OpenCV (cv2)
- numpy

## โครงสร้างโค้ดที่ต้องการ (Expected Structure)
- สร้างเป็น Class เช่น `WaterQualityDetector` เพื่อให้สามารถนำไปใช้ซ้ำได้ง่าย
- มีเมธอดแยกความรับผิดชอบชัดเจน: `load_model()`, `preprocess_image()`, `detect_color_bands()`, `analyze_results()`
- ไม่ Hardcode path ของโมเดล ให้รับค่าผ่าน Environment Variables หรือ Config argument เสมอ

## ขั้นตอนการทำ (Step-by-step)
1. **Load Model**: โหลดโมเดล YOLOv8 (`.pt`) ที่ถูกเทรนมาสำหรับการตรวจจับแถบสีโดยเฉพาะ
2. **Preprocess**: เตรียมภาพก่อนเข้าโมเดล เช่น การครอป (Crop) และปรับ Perspective ของภาพแผ่นทดสอบให้อยู่ในระนาบตรงด้วย OpenCV (Unwarping)
3. **Inference**: รันโมเดล YOLOv8 เพื่อหา Bounding Box ของตำแหน่งแถบสีต่างๆ บนแผ่นทดสอบ
4. **Color Analysis**: เทียบค่าสี (HSV) ของบริเวณที่ YOLO หาเจอ กับตารางสีอ้างอิง (Reference Color Chart) เพื่อประเมินค่าสารเคมี
5. **Return Format**: ส่งผลลัพธ์การประมวลผลกลับเป็น JSON ที่ระบุระดับค่าสารเคมีและค่าความน่าจะเป็น (Confidence Score)

## ข้อห้าม (Anti-patterns)
- ❌ **ห้ามใช้ `time.sleep()`** ในกระบวนการ Inference เพื่อรอจังหวะเด็ดขาด ให้ใช้ Async/Await หรือ Event Loop แทน
- ❌ **ห้ามรันโมเดล YOLOv8 บน Main Thread** หากทำเป็น Web API เพราะจะทำให้ Request อื่นถูก Block (ควรใช้ Background Task หรือ Message Queue)
- ❌ **ห้ามข้ามขั้นตอน Image Unwarping** เพราะมุมกล้องที่เอียงจะทำให้การตัดบริเวณแผ่นสีและการอ่านค่าสีผิดเพี้ยนไปจากความจริง
