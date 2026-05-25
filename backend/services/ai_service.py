from sqlalchemy.orm import Session
from ..models import AIConfig, AILogAnalysis, Device
from ..schemas import AIConfigBase
from typing import Optional
from datetime import datetime
import requests
import logging

logger = logging.getLogger(__name__)


class AIService:

    @staticmethod
    def get_config(db: Session) -> Optional[AIConfig]:
        return db.query(AIConfig).first()

    @staticmethod
    def update_config(db: Session, config: AIConfigBase) -> AIConfig:
        db_config = db.query(AIConfig).first()
        if db_config:
            for key, value in config.dict().items():
                setattr(db_config, key, value)
        else:
            db_config = AIConfig(**config.dict())
            db.add(db_config)
        db.commit()
        db.refresh(db_config)
        return db_config

    @staticmethod
    def test_connection(config: AIConfig) -> dict:
        try:
            headers = {
                "Authorization": f"Bearer {config.api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": config.model,
                "messages": [{"role": "user", "content": "Hello"}],
            }
            response = requests.post(
                f"{config.base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=config.timeout,
            )
            if response.status_code == 200:
                return {"success": True, "message": "AI服务连接成功"}
            else:
                return {
                    "success": False,
                    "message": f"连接失败: {response.text}",
                }
        except Exception as e:
            logger.error(f"AI服务测试失败: {str(e)}")
            return {"success": False, "message": str(e)}

    @staticmethod
    def analyze_log(db: Session, device_id: int, log_content: str) -> dict:
        device = db.query(Device).filter(Device.id == device_id).first()
        if not device:
            return {"success": False, "message": "设备不存在"}

        config = AIService.get_config(db)
        if not config or not config.enabled:
            return {"success": False, "message": "AI服务未启用"}

        try:
            headers = {
                "Authorization": f"Bearer {config.api_key}",
                "Content-Type": "application/json",
            }
            prompt = f"""请分析以下网络设备日志，识别潜在问题并提供建议：

设备信息：
- 设备名称: {device.name}
- 设备IP: {device.ip_address}
- 设备类型: {device.device_type}

日志内容：
{log_content}

请按以下格式输出分析结果：
1. 问题摘要：简要描述识别到的问题
2. 严重程度：critical/high/medium/low/info
3. 详细分析：详细分析问题原因和影响
4. 建议措施：针对问题提供具体的解决建议
"""
            payload = {
                "model": config.model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
            }
            response = requests.post(
                f"{config.base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=config.timeout,
            )

            if response.status_code == 200:
                result = response.json()
                analysis_text = result["choices"][0]["message"]["content"]

                severity = "info"
                lower = analysis_text.lower()
                if "critical" in lower:
                    severity = "critical"
                elif "high" in lower:
                    severity = "high"
                elif "medium" in lower:
                    severity = "medium"
                elif "low" in lower:
                    severity = "low"

                analysis = AILogAnalysis(
                    device_id=device_id,
                    log_content=log_content,
                    analysis_result=analysis_text,
                    severity=severity,
                    created_at=datetime.now(),
                )
                db.add(analysis)
                db.commit()

                return {
                    "success": True,
                    "data": {
                        "analysis": analysis_text,
                        "severity": severity,
                        "id": analysis.id,
                    },
                    "severity": severity,
                }
            else:
                return {
                    "success": False,
                    "message": f"分析失败: {response.text}",
                }

        except Exception as e:
            logger.error(f"日志分析失败: {str(e)}")
            return {"success": False, "message": str(e)}

    @staticmethod
    def get_analysis_records(
        db: Session, device_id: Optional[int] = None
    ) -> list:
        query = db.query(AILogAnalysis)
        if device_id:
            query = query.filter(AILogAnalysis.device_id == device_id)
        records = query.order_by(AILogAnalysis.created_at.desc()).all()

        result = []
        for record in records:
            device = db.query(Device).filter(Device.id == record.device_id).first()
            record_dict = record.__dict__.copy()
            record_dict["device_name"] = device.name if device else None
            record_dict["device_ip"] = device.ip_address if device else None
            result.append(record_dict)

        return result
