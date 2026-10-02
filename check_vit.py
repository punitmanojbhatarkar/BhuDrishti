from transformers import ViTForImageClassification
model = ViTForImageClassification.from_pretrained('google/vit-base-patch16-224-in21k')
print("--- Linear Layers in ViT ---")
for n, m in model.named_modules():
    if "Linear" in str(type(m)):
        print(n)
