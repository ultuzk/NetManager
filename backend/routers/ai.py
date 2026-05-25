from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from ..database import get_db
from ..schemas import (
    AIConfig, AIConfigBase,
    AILogAnalysis, AILogAnalysisRequest, ResponseModel,
)
from ..services.ai_service import AIService

router = APIRouter(prefix="/api/ai", tags=["AI管理"])


class AIChatRequest(BaseModel):
    message: str


class AIPromptItem(BaseModel):
    key: str
    name: str
    description: str
    prompt: str


class AIPromptsRequest(BaseModel):
    prompts: list


@router.get("/config/", response_model=AIConfig)
def get_ai_config(db: Session = Depends(get_db)):
    config = AIService.get_config(db)
    if not config:
        now = __import__("datetime").datetime.now()
        return AIConfig(
            id=0,
            provider="openai",
            api_key="",
            model="gpt-4",
            base_url="https://api.openai.com/v1",
            timeout=30,
            enabled=False,
            created_at=now,
            updated_at=now,
        )
    return config


@router.post("/config/", response_model=AIConfig)
def update_ai_config(config: AIConfigBase, db: Session = Depends(get_db)):
    return AIService.update_config(db, config)


@router.post("/config/test/", response_model=ResponseModel)
def test_ai_connection(db: Session = Depends(get_db)):
    config = AIService.get_config(db)
    if not config:
        return ResponseModel(success=False, message="请先配置AI服务")
    result = AIService.test_connection(config)
    return ResponseModel(success=result["success"], message=result["message"])


@router.post("/analyze/", response_model=ResponseModel)
def analyze_log(request: AILogAnalysisRequest, db: Session = Depends(get_db)):
    result = AIService.analyze_log(
        db, request.device_id, request.log_content
    )
    return ResponseModel(
        success=result["success"],
        message=result.get("message", "分析完成"),
        data=result.get("data"),
    )


@router.get("/analysis-records/", response_model=List[AILogAnalysis])
def get_analysis_records(
    device_id: Optional[int] = None, db: Session = Depends(get_db)
):
    return AIService.get_analysis_records(db, device_id)


@router.post("/chat/", response_model=ResponseModel)
def ai_chat(request: AIChatRequest, db: Session = Depends(get_db)):
    config = AIService.get_config(db)
    if not config or not config.enabled:
        return ResponseModel(success=False, message="AI服务未启用，请先在配置管理中启用")
    if not config.api_key:
        return ResponseModel(success=False, message="请先配置AI服务API密钥")
    try:
        import requests
        headers = {
            "Authorization": f"Bearer {config.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": config.model,
            "messages": [{"role": "user", "content": request.message}],
            "temperature": 0.7,
        }
        response = requests.post(
            f"{config.base_url}/chat/completions",
            headers=headers,
            json=payload,
            timeout=config.timeout,
        )
        if response.status_code == 200:
            result = response.json()
            reply = result["choices"][0]["message"]["content"]
            return ResponseModel(success=True, data={"reply": reply})
        else:
            return ResponseModel(success=False, message=f"AI服务返回错误: {response.text}")
    except Exception as e:
        return ResponseModel(success=False, message=f"AI对话失败: {str(e)}")


@router.get("/prompts/", response_model=ResponseModel)
def get_prompts():
    import json, os
    prompts_file = os.path.join(os.path.dirname(__file__), "..", "data", "ai_prompts.json")
    if os.path.exists(prompts_file):
        with open(prompts_file, "r", encoding="utf-8") as f:
            prompts = json.load(f)
    else:
        prompts = _get_default_prompts()
    return ResponseModel(success=True, data=prompts)


@router.post("/prompts/", response_model=ResponseModel)
def update_prompts(req: AIPromptsRequest, db: Session = Depends(get_db)):
    import json, os
    os.makedirs(os.path.join(os.path.dirname(__file__), "..", "data"), exist_ok=True)
    prompts_file = os.path.join(os.path.dirname(__file__), "..", "data", "ai_prompts.json")
    with open(prompts_file, "w", encoding="utf-8") as f:
        json.dump(req.prompts, f, ensure_ascii=False, indent=2)
    return ResponseModel(success=True, message="提示词保存成功")


def _get_default_prompts():
    return [
        {
            "key": "log_analysis",
            "name": "日志分析",
            "description": "分析设备日志，识别异常和潜在问题",
            "prompt": "请分析以下网络设备日志，识别异常、错误和警告信息，分析根本原因，评估严重程度（critical/high/medium/low/info），并提供解决建议。",
        },
        {
            "key": "config_review",
            "name": "配置审查",
            "description": "审查设备配置，发现潜在问题和优化建议",
            "prompt": "请审查以下设备配置，检查安全隐患、配置错误，提供优化建议和最佳实践。",
        },
        {
            "key": "troubleshooting",
            "name": "故障排查",
            "description": "根据故障现象提供排查思路和解决方案",
            "prompt": "请根据以下故障信息，分析可能原因，提供排查步骤、解决方案和预防措施。",
        },
        {
            "key": "security_audit",
            "name": "安全审计",
            "description": "审计设备安全配置，发现安全风险",
            "prompt": "请审计以下设备配置的安全性，识别漏洞和风险点，评估风险等级，提供加固建议。",
        },
    ]
