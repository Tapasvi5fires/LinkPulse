from typing import Any, List, Dict, Optional, AsyncGenerator
import os
import google.generativeai as genai
from groq import Groq
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class LLMService:
    def __init__(self):
        self.gemini_available = False
        self.groq_available = False
        
        # Initialize Gemini
        if settings.GEMINI_API_KEY:
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                # Use specific stable model
                self.gemini_model = genai.GenerativeModel('models/gemini-2.0-flash')
                self.gemini_available = True
                logger.info("Gemini LLM initialized successfully.")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini: {e}")

        # Initialize Groq
        if settings.GROQ_API_KEY:
            try:
                self.groq_client = Groq(api_key=settings.GROQ_API_KEY)
                self.groq_model = "llama-3.3-70b-versatile" # Latest, high-performance model (Llama 3.3 70B Versatile)
                self.groq_available = True
                logger.info("Groq LLM initialized successfully.")
            except Exception as e:
                logger.error(f"Failed to initialize Groq: {e}")

        if not self.gemini_available and not self.groq_available:
            logger.warning("No LLM providers available (Gemini or Groq). Chat/Summary will fail.")

    async def generate_content(self, prompt: str) -> str:
        """
        Generate content using available LLMs with fallback logic.
        Priority: Groq -> Gemini (Groq is faster and Gemini free tier has quota limits)
        """
        # Try Groq first (faster, more reliable)
        if self.groq_available:
            try:
                return await self._generate_with_groq(prompt)
            except Exception as e:
                logger.warning(f"Groq generation failed (Error: {e}). Attempting Gemini fallback...")
                # Fallback to Gemini if available
                if self.gemini_available:
                    try:
                        response = self.gemini_model.generate_content(prompt)
                        return response.text
                    except Exception as gemini_e:
                        logger.error(f"Gemini fallback also failed: {gemini_e}")
                        raise e
                else:
                    raise e
        
        # If Groq not available, try Gemini directly
        elif self.gemini_available:
            try:
                response = self.gemini_model.generate_content(prompt)
                return response.text
            except Exception as e:
                logger.error(f"Gemini generation failed: {e}")
                raise e
            
        else:
            return "LLM Service not configured. Please check API keys."

    async def generate_content_stream(self, prompt: str) -> AsyncGenerator[str, None]:
        """
        Generate content as a stream with fallback logic.
        """
        if self.groq_available:
            try:
                async for chunk in self._generate_with_groq_stream(prompt):
                    yield chunk
                return
            except Exception as e:
                logger.warning(f"Groq streaming failed: {e}. Falling back to Gemini...")
                if self.gemini_available:
                    try:
                        response = self.gemini_model.generate_content(prompt, stream=True)
                        for chunk in response:
                            if chunk.text:
                                yield chunk.text
                        return
                    except Exception as gemini_e:
                        logger.error(f"Gemini fallback streaming failed: {gemini_e}")
                        raise e
                else:
                    raise e
        elif self.gemini_available:
            try:
                response = self.gemini_model.generate_content(prompt, stream=True)
                for chunk in response:
                    if chunk.text:
                        yield chunk.text
            except Exception as e:
                logger.error(f"Gemini streaming failed: {e}")
                raise e
        else:
            yield "LLM Service not configured."

    async def _generate_with_groq(self, prompt: str) -> str:
        try:
            chat_completion = self.groq_client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                model=self.groq_model,
            )
            return chat_completion.choices[0].message.content
        except Exception as e:
            logger.error(f"Groq generation failed: {e}")
            raise e

    async def _generate_with_groq_stream(self, prompt: str) -> AsyncGenerator[str, None]:
        try:
            # Note: The 'stream' argument exists in the Groq client as well
            # However, the current groq client might require calling a different method or setting stream=True
            # Based on Groq SDK, it's typically:
            chat_completion = self.groq_client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                model=self.groq_model,
                stream=True,
            )
            for chunk in chat_completion:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            logger.error(f"Groq streaming failed: {e}")
            raise e

llm_service = LLMService()
