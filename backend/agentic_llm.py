import os
import google.generativeai as genai
from pydantic import BaseModel

# Configure Gemini API
genai.configure(api_key=os.getenv("GEMINI_API_KEY", "DUMMY_KEY"))

# Use Gemini 1.5 Pro for complex reasoning and multilingual output
generation_config = {
  "temperature": 0.2,
  "top_p": 0.95,
  "top_k": 64,
  "max_output_tokens": 4096,
  "response_mime_type": "text/plain",
}

model = genai.GenerativeModel(
  model_name="gemini-1.5-pro",
  generation_config=generation_config,
)

class ReportContext(BaseModel):
    watershed_name: str
    ndvi_drop_percentage: float
    damaged_structure: str
    location_lat: float
    location_lon: float
    region_language: str

def generate_priority_action_report(context: ReportContext) -> dict:
    """
    Autonomously generates a multi-lingual Priority Action Report 
    based on identified watershed damage and NDVI drops.
    """
    prompt = f"""
    You are an expert Geospatial Intelligence Agent monitoring watershed health for the Indian Government.
    A critical anomaly has been detected:
    - Watershed: {context.watershed_name}
    - Issue: NDVI (Vegetation Index) has dropped by {context.ndvi_drop_percentage}% in the last 30 days.
    - Structural Damage Detected: {context.damaged_structure}
    - Coordinates: {context.location_lat}, {context.location_lon}
    
    Write a formal "Priority Action Report" for the District Magistrate.
    It MUST contain:
    1. Executive Summary (The crisis)
    2. Geo-Spatial Evidence (Mention the NDVI drop and coordinates)
    3. Recommended Interventions (E.g., repair the structure, dispatch water tankers)
    4. Estimated Budget impact if ignored.
    
    Output the entire report FIRST in English, and then output the EXACT translation in {context.region_language}.
    Format nicely using Markdown.
    """
    
    try:
        if os.getenv("GEMINI_API_KEY"):
            response = model.generate_content(prompt)
            report_text = response.text
        else:
            report_text = f"**[MOCK REPORT]**\n\n**English:**\nPriority Action Report for {context.watershed_name}. Immediate repair of {context.damaged_structure} is required at {context.location_lat}, {context.location_lon} due to {context.ndvi_drop_percentage}% NDVI drop.\n\n**{context.region_language}:**\n[Translation would appear here in production]"
            
        return {
            "status": "success",
            "report": report_text,
            "metadata": {
                "watershed": context.watershed_name,
                "triggered_by": "Agentic_LLM_Monitor"
            }
        }
    except Exception as e:
        print(f"Agentic LLM Error: {e}")
        return {"status": "error", "message": str(e)}
