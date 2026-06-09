import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { existsSync } from 'fs';
import { evaluateSample } from '@/lib/standards';

const execAsync = promisify(exec);

/**
 * POST /api/analyze — AI Image Analysis Endpoint
 *
 * Flow:
 *   1. รับรูปจาก FormData
 *   2. เซฟรูปชั่วคราวที่ public/uploads/
 *   3. เรียก Python script (ai_engine/analyzer.py) ผ่าน child_process
 *   4. อ่านผลลัพธ์ JSON จาก stdout
 *   5. ส่งกลับให้หน้าเว็บ
 *
 * ⚠️ ต้องติดตั้งบนเครื่อง:
 *   pip install ultralytics opencv-python numpy
 *   และวางไฟล์ best.pt ไว้ที่ ai_engine/best.pt
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      return NextResponse.json(
        { error: 'กรุณาอัพโหลดรูปภาพ' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!imageFile.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'ไฟล์ที่อัพโหลดไม่ใช่รูปภาพ' },
        { status: 400 }
      );
    }

    console.log(`📸 Received image: ${imageFile.name}, size: ${imageFile.size} bytes`);

    // 1. เซฟรูปลงในโฟลเดอร์ public/uploads
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filename = `sample_${Date.now()}.jpg`;
    const filepath = path.join(uploadsDir, filename);
    await writeFile(filepath, buffer);

    console.log(`💾 Image saved to: ${filepath}`);

    // 2. ตรวจสอบว่ามีไฟล์ best.pt หรือไม่
    const modelPath = path.join(process.cwd(), 'ai_engine', 'best.pt');
    const pythonScript = path.join(process.cwd(), 'ai_engine', 'analyzer.py');
    const hasPythonModel = existsSync(modelPath);

    let phosphate: number;
    let ammonia: number;
    let status: string;

    if (hasPythonModel) {
      // ════════════════════════════════════════════════════════
      // 🤖 REAL AI MODE: Call Python analyzer.py
      // ════════════════════════════════════════════════════════
      console.log('🤖 Running AI analysis with YOLO + OpenCV...');

      const { stdout, stderr } = await execAsync(
        `python "${pythonScript}" "${filepath}"`,
        { timeout: 30000 } // 30 second timeout
      );

      if (stderr) {
        console.warn('⚠️ Python stderr:', stderr);
      }

      // อ่าน JSON จาก stdout (Python print ออกมา)
      const result = JSON.parse(stdout.trim());

      if (!result.success) {
        throw new Error(result.error || 'AI analysis failed');
      }

      phosphate = result.phosphate;
      ammonia = result.ammonia;
      status = result.status;

      console.log(`🔬 AI Result: PO4=${phosphate}, NH3=${ammonia}, Status=${status}`);
      if (result.debug) {
        console.log(`   HSV Debug: H=${result.debug.hue}, S=${result.debug.saturation}, V=${result.debug.value}`);
      }
    } else {
      // ════════════════════════════════════════════════════════
      // 🧪 MOCK MODE: ยังไม่มี best.pt — ใช้ค่าจำลอง
      // ════════════════════════════════════════════════════════
      console.log('🧪 No best.pt found — using MOCK analysis');
      console.log('   วางไฟล์ best.pt ที่ ai_engine/best.pt เพื่อใช้โมเดลจริง');

      // จำลองเวลาประมวลผล AI
      await new Promise((resolve) =>
        setTimeout(resolve, 1500 + Math.random() * 1500)
      );

      // Mock values
      phosphate = parseFloat((Math.random() * 0.15).toFixed(4));
      ammonia = parseFloat((Math.random() * 0.4).toFixed(4));
      const evalResult = evaluateSample(phosphate, ammonia);
      status = evalResult.overallStatus;
    }

    // 3. ส่งผลลัพธ์กลับไปให้หน้าเว็บ
    return NextResponse.json({
      phosphate,
      ammonia,
      status,
      imageUrl: `/uploads/${filename}`,
    });
  } catch (error) {
    console.error('POST /api/analyze error:', error);

    // ถ้า Python parse ไม่ได้ หรือ exec fail
    const errorMessage =
      error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการวิเคราะห์ภาพ';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
