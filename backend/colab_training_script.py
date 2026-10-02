# ==============================================================================
# BhuDrishti AI - Remote Sensing Vision Model Fine-Tuning Script
# Run this exactly as-is in Google Colab (Free T4 GPU)
# ==============================================================================

import os

# 1. Install required libraries (only runs if they aren't installed)
os.system("pip install -q transformers datasets peft torch torchvision accelerate")

import torch
import torch.nn as nn
from datasets import load_dataset
from transformers import ViTForImageClassification, ViTImageProcessor, TrainingArguments, Trainer
from peft import LoraConfig, get_peft_model
import numpy as np
import shutil

print("🚀 Starting BhuDrishti Remote Sensing Fine-Tuning...")

# 2. Load a 10% subset of BigEarthNet to save time
print("📦 Downloading BigEarthNet dataset...")
dataset = load_dataset("timm/bigearthnet-v2-rgb-nir-swir", split="train[:10%]")

# Split into train/test
dataset = dataset.train_test_split(test_size=0.1)

# 3. Load Base Model and Processor
model_id = "google/vit-base-patch16-224-in21k"
processor = ViTImageProcessor.from_pretrained(model_id)

# 4. Preprocess images and format MULTI-LABEL targets
def transform(example_batch):
    # Process images (Ensure RGB format for ViT)
    inputs = processor([x.convert("RGB") for x in example_batch['image']], return_tensors='pt')
    
    # CRITICAL FIX: Convert variable-length label lists to multi-hot tensors (batch_size, 43)
    batch_size = len(example_batch['image'])
    labels = torch.zeros(batch_size, 43)
    for i, labels_list in enumerate(example_batch['labels']):
        labels[i, labels_list] = 1.0
        
    inputs['labels'] = labels
    return inputs

print("⚙️ Formatting dataset for Multi-Label Classification...")
prepared_ds = dataset.with_transform(transform)

# 5. Setup LoRA (Low-Rank Adaptation)
print("🧠 Configuring LoRA Adapters...")
model = ViTForImageClassification.from_pretrained(
    model_id,
    num_labels=43,
    problem_type="multi_label_classification", # CRITICAL FIX: Forces BCEWithLogitsLoss
    ignore_mismatched_sizes=True
)

# BULLETPROOF FIX: Programmatically find all linear layers to adapt
# This prevents PEFT from crashing if layer names change in different Transformers versions.
linear_layers = [
    name for name, module in model.named_modules() 
    if isinstance(module, nn.Linear) and "classifier" not in name
]

config = LoraConfig(
    r=16,
    lora_alpha=16,
    target_modules=linear_layers, # Automatically targets all attention projections
    lora_dropout=0.1,
    bias="none",
    modules_to_save=["classifier"],
)
lora_model = get_peft_model(model, config)
lora_model.print_trainable_parameters()

# 6. Train the model
print("🔥 Starting Training Phase...")
training_args = TrainingArguments(
    output_dir="./bhudrishti_rs_model",
    per_device_train_batch_size=32,
    evaluation_strategy="epoch",
    num_train_epochs=3,
    fp16=True, # Use Mixed Precision for faster GPU training
    save_strategy="epoch",
    logging_steps=10,
    learning_rate=2e-4,
    remove_unused_columns=False,
)

trainer = Trainer(
    model=lora_model,
    args=training_args,
    train_dataset=prepared_ds["train"],
    eval_dataset=prepared_ds["test"],
)

trainer.train()

# 7. Save the adapter weights
print("✅ Training Complete! Saving adapter weights...")
lora_model.save_pretrained("bhudrishti_rs_adapter")

# Zip the folder so it can be easily downloaded from Colab
shutil.make_archive("bhudrishti_rs_adapter", 'zip', "bhudrishti_rs_adapter")
print("🎉 Done! Please download 'bhudrishti_rs_adapter.zip' from the Colab files tab.")
