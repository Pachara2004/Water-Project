import os
import shutil
try:
    from ultralytics import YOLO
except ImportError:
    print("Error: ultralytics library not found. Please run 'pip install ultralytics'")
    exit(1)

def main():
    print("==================================================")
    print("🚀 Starting AI Model Training...")
    print("==================================================")
    
    # Paths
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_yaml = os.path.join(base_dir, 'public', 'models', 'water-tube', 'data.yaml')
    onnx_dest = os.path.join(base_dir, 'public', 'models', 'yolov8n.onnx')
    
    if not os.path.exists(data_yaml):
        print(f"❌ Error: data.yaml not found at {data_yaml}")
        print("Please ensure you extracted the Roboflow dataset to 'public/models/water-tube'")
        return

    # Load base model
    print("\n📦 Loading base YOLOv8n model...")
    model = YOLO('yolov8n.pt')

    # Train
    print("\n🧠 Training on new dataset... (This may take a few minutes)")
    model.train(
        data=data_yaml, 
        epochs=15, 
        imgsz=640, 
        project='custom_train', 
        name='latest_run', 
        plots=False,
        exist_ok=True # Overwrite previous run folder
    )

    # Export to ONNX
    print("\n⚙️ Exporting trained model to ONNX format...")
    best_model_path = os.path.join(base_dir, 'custom_train', 'latest_run', 'weights', 'best.pt')
    if not os.path.exists(best_model_path):
        print(f"❌ Error: best.pt not found at {best_model_path}")
        return
        
    best_model = YOLO(best_model_path)
    onnx_path = best_model.export(format='onnx', imgsz=640, simplify=True)

    # Replace original model
    print(f"\n🚚 Moving new model to {onnx_dest}...")
    if os.path.exists(onnx_dest):
        os.remove(onnx_dest)
    shutil.copy(onnx_path, onnx_dest)
    
    print("\n✅ All done! Your new AI model is ready to use. Please restart your Next.js server.")
    print("==================================================")

if __name__ == "__main__":
    main()
