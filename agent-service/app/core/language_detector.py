"""
Language Detection and Response Management
"""
from typing import Optional, Dict, Any
from langdetect import detect, DetectorFactory, LangDetectException
from loguru import logger

# Set seed for consistent results
DetectorFactory.seed = 0

class LanguageDetector:
    """Language detection and response management"""
    
    # Supported languages mapping
    SUPPORTED_LANGUAGES = {
        'en': 'English',
        'zh-cn': 'Chinese (Simplified)',
        'zh-tw': 'Chinese (Traditional)',
        'ja': 'Japanese',
        'ko': 'Korean',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'ru': 'Russian',
        'ar': 'Arabic',
        'hi': 'Hindi',
        'th': 'Thai',
        'vi': 'Vietnamese'
    }
    
    # Default language
    DEFAULT_LANGUAGE = 'en'
    
    def __init__(self):
        logger.info("LanguageDetector initialized")
    
    def detect_language(self, text: str) -> str:
        """
        Detect language from input text
        
        Args:
            text: Input text to detect language from
            
        Returns:
            Language code (e.g., 'en', 'zh-cn')
        """
        if not text or not text.strip():
            return self.DEFAULT_LANGUAGE
        
        try:
            # Clean text for better detection
            clean_text = text.strip()
            if len(clean_text) < 3:
                return self.DEFAULT_LANGUAGE
            
            # First, check for obvious Chinese characters
            if self._has_chinese_characters(clean_text):
                logger.info(f"Detected Chinese characters in text, using zh-cn")
                return 'zh-cn'
            
            # Detect language using langdetect
            detected_lang = detect(clean_text)
            
            # Map similar languages
            if detected_lang in ['zh', 'zh-cn']:
                detected_lang = 'zh-cn'
            elif detected_lang == 'zh-tw':
                detected_lang = 'zh-tw'
            
            # Double-check for Chinese if langdetect failed
            if detected_lang == 'en' and self._has_chinese_characters(clean_text):
                logger.warning(f"langdetect failed to detect Chinese, but Chinese characters found")
                return 'zh-cn'
            
            # Check if language is supported
            if detected_lang in self.SUPPORTED_LANGUAGES:
                logger.info(f"Detected language: {detected_lang} ({self.SUPPORTED_LANGUAGES[detected_lang]})")
                return detected_lang
            else:
                logger.warning(f"Unsupported language detected: {detected_lang}, using default: {self.DEFAULT_LANGUAGE}")
                return self.DEFAULT_LANGUAGE
                
        except LangDetectException as e:
            logger.warning(f"Language detection failed: {e}, using default: {self.DEFAULT_LANGUAGE}")
            return self.DEFAULT_LANGUAGE
        except Exception as e:
            logger.error(f"Unexpected error in language detection: {e}")
            return self.DEFAULT_LANGUAGE
    
    def _has_chinese_characters(self, text: str) -> bool:
        """
        Check if text contains Chinese characters
        
        Args:
            text: Text to check
            
        Returns:
            True if Chinese characters are found
        """
        import re
        # Check for Chinese characters (CJK Unified Ideographs)
        chinese_pattern = r'[\u4e00-\u9fff]'
        return bool(re.search(chinese_pattern, text))
    
    def get_language_instruction(self, language: str) -> str:
        """
        Get language instruction for LLM prompts
        
        Args:
            language: Language code
            
        Returns:
            Language instruction string
        """
        try:
            from app.config.prompt_loader import prompt_loader
            return prompt_loader.get_language_instruction(language)
        except Exception as e:
            logger.warning(f"Failed to load language instruction from config: {e}, using fallback")
            # Fallback to hardcoded instructions
            language_instructions = {
                'en': "Please respond in English.",
                'zh-cn': "请用中文简体回复。",
                'zh-tw': "請用繁體中文回覆。",
                'ja': "日本語で回答してください。",
                'ko': "한국어로 답변해 주세요.",
                'es': "Por favor responde en español.",
                'fr': "Veuillez répondre en français.",
                'de': "Bitte antworten Sie auf Deutsch.",
                'it': "Si prega di rispondere in italiano.",
                'pt': "Por favor, responda em português.",
                'ru': "Пожалуйста, ответьте на русском языке.",
                'ar': "يرجى الرد باللغة العربية.",
                'hi': "कृपया हिंदी में उत्तर दें।",
                'th': "กรุณาตอบเป็นภาษาไทย",
                'vi': "Vui lòng trả lời bằng tiếng Việt."
            }
            return language_instructions.get(language, language_instructions[self.DEFAULT_LANGUAGE])
    
    def get_language_name(self, language: str) -> str:
        """
        Get human-readable language name
        
        Args:
            language: Language code
            
        Returns:
            Human-readable language name
        """
        return self.SUPPORTED_LANGUAGES.get(language, self.SUPPORTED_LANGUAGES[self.DEFAULT_LANGUAGE])
    
    def is_supported_language(self, language: str) -> bool:
        """
        Check if language is supported
        
        Args:
            language: Language code
            
        Returns:
            True if supported, False otherwise
        """
        return language in self.SUPPORTED_LANGUAGES

# Global language detector instance
language_detector = LanguageDetector()
