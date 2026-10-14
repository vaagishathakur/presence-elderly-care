import os
from typing import Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from analyzer import analyze_sentiment_and_mood

app = FastAPI(
    title="Presence NLP Mood & Distress Service",
    version="1.0.0",
    description="Microservice providing sentiment classification, continuous mood scoring [-1, 1], and Hinglish distress detection for Presence."
)

class AnalyzeRequest(BaseModel):
    text: str = Field(..., description="Speech transcript or user utterance to analyze")
    elderly_user_id: Optional[int] = Field(None, description="Optional elder user identifier")
    session_id: Optional[str] = Field(None, description="Optional conversational session ID")

class AnalyzeResponse(BaseModel):
    mood_score: float = Field(..., ge=-1.0, le=1.0, description="Continuous mood score between -1.0 and 1.0")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Confidence score between 0.0 and 1.0")
    sentiment_label: str = Field(..., description="Sentiment classification: positive, neutral, negative, or unknown")
    distress_detected: bool = Field(..., description="Whether a distress phrase or critical state was detected")
    distress_phrase: Optional[str] = Field(None, description="The specific trigger distress phrase if detected")
    model_version: str = Field("presence-hybrid-sentiment-v1", description="Model architecture identifier")

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "presence-nlp-service",
        "version": "1.0.0"
    }

@app.post("/analyze", response_model=AnalyzeResponse)
def analyze_text(request: AnalyzeRequest):
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
    
    result = analyze_sentiment_and_mood(request.text)
    return result

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
