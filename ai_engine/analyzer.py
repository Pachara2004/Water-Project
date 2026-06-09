"""
ai_engine/analyzer.py
=====================
YOLOv8 + OpenCV Water Sample Analyzer

Pipeline:
  1. YOLO detects bounding boxes (liquid, colorchecker_left)
  2. CLAHE illumination correction
  3. Color correction via ColorChecker matrix
  4. HSV extraction from liquid region
  5. Regression to chemical concentration (placeholder)

Usage (called from Next.js API route):
  python ai_engine/analyzer.py "path/to/image.jpg"
"""

import sys
import json
import os
import cv2
import numpy as np
from ultralytics import YOLO


# ============================================================
# OpenCV Image Processing Functions
# ============================================================

def fix_uneven_illumination(image):
    """
    ปรับสภาพแสงของภาพให้สม่ำเสมอ โดยไม่ทำให้สี (Hue) เพี้ยน
    ใช้ CLAHE บน L-channel ของ LAB color space
    """
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)

    # CLAHE: เกลี่ยแสงสว่างเฉพาะจุด ลดปัญหาเงาดำหรือแสงจ้าไปครึ่งขวด
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    cl = clahe.apply(l_channel)

    merged_lab = cv2.merge((cl, a_channel, b_channel))
    balanced_bgr = cv2.cvtColor(merged_lab, cv2.COLOR_LAB2BGR)
    return balanced_bgr


def calculate_color_correction_matrix(observed_colors, true_colors):
    """
    คำนวณ Matrix ปรับสี (Linear Transformation)
    ใช้ Least Squares เพื่อหา Matrix 3x3 ที่แปลง observed -> true
    """
    observed_matrix = np.array(observed_colors, dtype=np.float32)
    true_matrix = np.array(true_colors, dtype=np.float32)
    transformation_matrix, _, _, _ = np.linalg.lstsq(observed_matrix, true_matrix, rcond=None)
    return transformation_matrix


def apply_color_correction(image, transformation_matrix):
    """
    นำ Matrix ปรับสีมาใช้กับภาพทั้งภาพ
    """
    h, w, c = image.shape
    pixels = image.reshape(-1, 3).astype(np.float32)
    corrected_pixels = np.dot(pixels, transformation_matrix)
    corrected_pixels = np.clip(corrected_pixels, 0, 255).astype(np.uint8)
    return corrected_pixels.reshape(h, w, c)


def extract_liquid_hsv(liquid_image):
    """
    ดึงค่าสีของน้ำในขวด (เอาเฉพาะ 60% ตรงกลางเพื่อหลบเงาขอบขวด)
    คืนค่า (H, S, V) เฉลี่ย
    """
    h, w = liquid_image.shape[:2]

    # Crop: เอาแค่ 60% ตรงกลาง (ตัดขอบออกด้านละ 20%)
    roi = liquid_image[int(h * 0.2):int(h * 0.8), int(w * 0.2):int(w * 0.8)]
    hsv_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

    mean_hsv = cv2.mean(hsv_roi)[:3]
    return mean_hsv


# ============================================================
# Main Analysis Pipeline (called by Next.js)
# ============================================================

def main(image_path):
    try:
        # ตรวจสอบว่าไฟล์ภาพมีอยู่จริง
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"ไม่พบไฟล์ภาพ: {image_path}")

        # 1. โหลดโมเดล YOLO
        model_path = os.path.join(os.path.dirname(__file__), "best.pt")
        model = YOLO(model_path)

        # 2. ทำนายรูปภาพที่รับเข้ามา
        results = model(image_path)
        img = cv2.imread(image_path)

        if img is None:
            raise ValueError("ไม่สามารถอ่านไฟล์ภาพได้")

        liquid_box = None
        checker_box = None

        # 3. วนลูปหากล่องที่ YOLO ตัดให้
        for r in results:
            boxes = r.boxes
            for box in boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                x1, y1, x2, y2 = map(int, box.xyxy[0])

                # ⚠️ ตรวจสอบเลข Class ในไฟล์ data.yaml ของคุณ
                # สมมติว่า Class 0 = liquid, Class 1 = colorchecker_left
                if cls_id == 0:
                    liquid_box = img[y1:y2, x1:x2]
                elif cls_id == 1:
                    checker_box = img[y1:y2, x1:x2]

        if liquid_box is None:
            raise ValueError("หาขวดน้ำไม่เจอ กรุณาถ่ายภาพใหม่")

        # 4. ประมวลผลสีด้วย OpenCV
        liquid_balanced = fix_uneven_illumination(liquid_box)

        # ถ้ามี ColorChecker ให้ทำ Color Correction ด้วย
        if checker_box is not None:
            checker_balanced = fix_uneven_illumination(checker_box)

            # ⚠️ ต้องใส่ค่าสี RGB มาตรฐานของแผ่น ColorChecker ของคุณเอง
            TRUE_COLORS = [
                [200, 50, 50],   # สีแดงมาตรฐาน (R, G, B)
                [50, 200, 50],   # สีเขียวมาตรฐาน (R, G, B)
            ]

            # ดึงค่าสีเฉลี่ยจากแผ่นที่กล้องถ่ายมา
            # ⚠️ ตอนนี้ใช้ค่า Mock — ต้องแทนที่ด้วยการดึงสีจริงจาก checker_balanced
            OBSERVED_COLORS = [
                [180, 60, 55],
                [45, 190, 60],
            ]

            color_matrix = calculate_color_correction_matrix(OBSERVED_COLORS, TRUE_COLORS)
            liquid_corrected = apply_color_correction(liquid_balanced, color_matrix)
        else:
            liquid_corrected = liquid_balanced

        # 5. ดึงค่า HSV จากน้ำ
        hsv_val = extract_liquid_hsv(liquid_corrected)
        hue, saturation, value = hsv_val

        # 6. แปลงค่า HSV เป็นความเข้มข้นสารเคมี
        # ⚠️ ตรงนี้ต้องใส่สมการ Regression ของคุณ
        # ตอนนี้จำลองค่า (Mock) ก่อนเพื่อให้เว็บทำงานได้
        #
        # ตัวอย่าง:
        #   phosphate = a1 * hue + b1 * saturation + c1
        #   ammonia   = a2 * hue + b2 * saturation + c2
        mock_phosphate = round(0.03 + (hue / 180.0) * 0.12, 4)
        mock_ammonia = round(0.05 + (saturation / 255.0) * 0.35, 4)

        # กำหนดสถานะจากค่ามาตรฐานน้ำทะเลไทย
        if mock_phosphate > 0.09 or mock_ammonia > 0.3:
            status = "DANGER"
        elif mock_phosphate > 0.045 or mock_ammonia > 0.1:
            status = "WARNING"
        else:
            status = "SAFE"

        # 7. คืนค่ากลับไปให้ Next.js ในรูปแบบ JSON
        output = {
            "success": True,
            "phosphate": mock_phosphate,
            "ammonia": mock_ammonia,
            "status": status,
            "debug": {
                "hue": round(hue, 2),
                "saturation": round(saturation, 2),
                "value": round(value, 2),
                "has_checker": checker_box is not None,
            }
        }
        print(json.dumps(output))

    except Exception as e:
        error_output = {"success": False, "error": str(e)}
        print(json.dumps(error_output))
        sys.exit(1)


if __name__ == "__main__":
    # รับ path รูปภาพมาจาก Next.js
    if len(sys.argv) > 1:
        main(sys.argv[1])
    else:
        print(json.dumps({"success": False, "error": "No image path provided"}))
        sys.exit(1)