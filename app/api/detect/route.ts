import { NextRequest, NextResponse } from "next/server";
import * as ort from "onnxruntime-node";
import sharp from "sharp";
import path from "path";
import fs from "fs";

export const maxDuration = 60;

// Initialize ONNX Session once in memory
let session: ort.InferenceSession | null = null;
const MODEL_PATH = path.join(process.cwd(), "public", "models", "yolov8n.onnx");

// Target Custom Class (from Roboflow)
const TARGET_CLASSES = [0];
const TARGET_NAMES: Record<number, string> = {
    0: "tube (หลอดทดลอง)"
};
const CONFIDENCE_THRESHOLD = 0.45;

async function getSession() {
    if (!session) {
        if (!fs.existsSync(MODEL_PATH)) {
            throw new Error(`ไม่พบไฟล์โมเดลที่ ${MODEL_PATH}`);
        }
        session = await ort.InferenceSession.create(MODEL_PATH);
    }
    return session;
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        
        if (!file) {
            return NextResponse.json({ passed: false, message: "ไม่มีไฟล์รูปภาพ", detected_count: 0, detected_items: [] }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // Preprocess Image: Resize to 640x640, convert to RGB Float32 tensor [1, 3, 640, 640]
        const { data } = await sharp(buffer)
            .resize(640, 640, { fit: 'fill' }) 
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        // Normalize to [0, 1] and transpose from HWC (640x640x3) to CHW (3x640x640)
        const float32Data = new Float32Array(3 * 640 * 640);
        for (let c = 0; c < 3; c++) {
            for (let i = 0; i < 640 * 640; i++) {
                float32Data[c * 640 * 640 + i] = data[i * 3 + c] / 255.0;
            }
        }

        const tensor = new ort.Tensor("float32", float32Data, [1, 3, 640, 640]);

        const session = await getSession();
        const feeds = { [session.inputNames[0]]: tensor };
        
        const results = await session.run(feeds);
        const output = results[session.outputNames[0]]; 
        
        // Output shape for YOLOv8 is [1, 84, 8400]
        const outputData = output.data as Float32Array;

        const detected_items: { object: string; confidence: number }[] = [];

        const numClasses = 80;
        const numAnchors = 8400;

        for (let anchorIdx = 0; anchorIdx < numAnchors; anchorIdx++) {
            let maxScore = 0;
            let classId = -1;
            
            for (let c = 0; c < numClasses; c++) {
                const rowIdx = 4 + c;
                const score = outputData[rowIdx * numAnchors + anchorIdx];
                if (score > maxScore) {
                    maxScore = score;
                    classId = c;
                }
            }

            if (maxScore >= CONFIDENCE_THRESHOLD && TARGET_CLASSES.includes(classId)) {
                detected_items.push({
                    object: TARGET_NAMES[classId],
                    confidence: maxScore
                });
            }
        }

        // Simple deduplication (keep highest confidence per object type)
        const uniqueItems = new Map<string, number>();
        detected_items.forEach(item => {
            const currentConf = uniqueItems.get(item.object) || 0;
            if (item.confidence > currentConf) {
                uniqueItems.set(item.object, item.confidence);
            }
        });

        const finalItems = Array.from(uniqueItems.entries()).map(([object, confidence]) => ({ object, confidence }));
        
        const passed = finalItems.length > 0;
        const message = passed 
            ? "ตรวจพบภาชนะที่เข้าเกณฑ์ (ขวด/หลอดทดลอง/แก้ว)" 
            : "ไม่พบวัตถุที่เป็น ขวด แก้ว หรือหลอดทดลอง ในภาพ กรุณาถ่ายภาพใหม่ที่เห็นภาชนะชัดเจน";

        return NextResponse.json({
            passed,
            message,
            detected_count: finalItems.length,
            detected_items: finalItems
        });

    } catch (error: any) {
        console.error("Object Detection Error:", error);
        return NextResponse.json({ 
            passed: false, 
            message: "เกิดข้อผิดพลาดในการตรวจสอบรูปภาพ: " + error.message, 
            detected_count: 0, 
            detected_items: [] 
        }, { status: 500 });
    }
}
