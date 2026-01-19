from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import os
import json
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

router = APIRouter()

# 从环境变量读取配置
MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4o-2024-08-06")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL")

# 初始化 OpenAI 客户端（全局单例）
_client_instance = None

def get_client():
    """获取或创建 OpenAI 客户端实例"""
    global _client_instance
    if _client_instance is None:
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY environment variable is required")
        
        client_kwargs = {
            "api_key": OPENAI_API_KEY,
        }
        
        # 如果设置了 base_url，添加它
        if OPENAI_BASE_URL:
            # 确保 URL 格式正确
            base_url = OPENAI_BASE_URL.rstrip("/")
            # 如果 URL 不包含 /v1，添加它（OpenAI SDK 需要）
            if not base_url.endswith("/v1"):
                if not base_url.endswith("/v1/"):
                    base_url = f"{base_url}/v1"
            client_kwargs["base_url"] = base_url
        
        try:
            _client_instance = OpenAI(**client_kwargs)
        except Exception as e:
            raise ValueError(f"Failed to initialize OpenAI client: {str(e)}")
    
    return _client_instance


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []  # 对话历史


@router.post("")
async def chat(request: ChatRequest):
    """流式聊天接口，返回 SSE 格式的流式响应"""
    try:
        client = get_client()
    except ValueError as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
    
    async def generate():
        try:
            # 构建消息历史
            messages = []
            
            # 添加系统提示词
            system_prompt = """你是一个专业的供应链智能分析助手。你的任务是帮助用户分析供应链数据，回答关于交易、公司、品类、地理位置等相关问题。

请用友好、专业的方式回答用户的问题。如果问题与供应链数据相关，可以提供详细的分析和建议。"""
            
            messages.append({"role": "system", "content": system_prompt})
            
            # 添加历史消息
            for msg in request.history:
                messages.append({
                    "role": msg.role,
                    "content": msg.content
                })
            
            # 添加当前用户消息
            messages.append({
                "role": "user",
                "content": request.message
            })
            
            # 调用 OpenAI API（流式）
            stream = client.chat.completions.create(
                model=MODEL_NAME,
                messages=messages,
                temperature=0.7,
                stream=True
            )
            
            # 流式返回数据
            for chunk in stream:
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if delta and delta.content is not None:
                        content = delta.content
                        # 使用 SSE 格式返回
                        data = json.dumps({"content": content}, ensure_ascii=False)
                        yield f"data: {data}\n\n"
            
            # 发送结束标记
            yield f"data: {json.dumps({'done': True}, ensure_ascii=False)}\n\n"
            
        except Exception as e:
            error_data = json.dumps({"error": str(e)}, ensure_ascii=False)
            yield f"data: {error_data}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )
