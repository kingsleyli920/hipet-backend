"""
Language Manager
Handles language detection, consistency, and conversation language tracking
"""
import re
from typing import Optional, Dict, Any
from loguru import logger
from app.core.language_detector import language_detector


class LanguageManager:
    """Manages language detection and consistency across conversations"""
    
    def __init__(self):
        self.supported_languages = {
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
        self.default_language = 'en'
    
    def detect_language(self, text: str) -> str:
        """Detect language of input text"""
        return language_detector.detect_language(text)
    
    def extract_language_from_conversation(self, conversation_summary: str) -> Optional[str]:
        """
        Extract the primary language from conversation summary
        
        Args:
            conversation_summary: Previous conversation summary
            
        Returns:
            Detected language code or None if not found
        """
        if not conversation_summary:
            return None
        
        # Try to detect language from conversation summary
        detected_lang = self.detect_language(conversation_summary)
        
        # If conversation is too short or mixed, return None
        if len(conversation_summary.strip()) < 10:
            return None
            
        return detected_lang
    
    def determine_response_language(
        self, 
        current_message: str, 
        conversation_summary: str = "",
        explicit_language: Optional[str] = None
    ) -> str:
        """
        Determine the appropriate response language based on:
        1. Explicit language parameter
        2. Current message language
        3. Conversation history language
        4. Default fallback
        
        Args:
            current_message: Current user message
            conversation_summary: Previous conversation summary
            explicit_language: Explicitly specified language
            
        Returns:
            Language code for response
        """
        # Priority 1: Explicit language parameter
        if explicit_language and explicit_language in self.supported_languages:
            logger.info(f"Using explicit language: {explicit_language}")
            return explicit_language
        
        # Priority 2: Current message language
        current_lang = self.detect_language(current_message)
        logger.info(f"Current message language: {current_lang}")
        
        # Priority 3: Conversation history language
        history_lang = self.extract_language_from_conversation(conversation_summary)
        if history_lang:
            logger.info(f"Conversation history language: {history_lang}")
            
            # If current message is in a different language than history,
            # but current message is clear and substantial, use current
            if (current_lang != history_lang and 
                len(current_message.strip()) > 20 and
                self._is_clear_language_switch(current_message, current_lang)):
                logger.info(f"Language switch detected: {history_lang} -> {current_lang}")
                return current_lang
            else:
                # Maintain conversation language consistency
                return history_lang
        
        # Priority 4: Current message language
        return current_lang
    
    def _is_clear_language_switch(self, message: str, detected_lang: str) -> bool:
        """
        Check if this is a clear language switch (not just a few words)
        
        Args:
            message: User message
            detected_lang: Detected language
            
        Returns:
            True if this appears to be a deliberate language switch
        """
        # Check for language-specific patterns
        if detected_lang == 'en':
            # English patterns
            english_patterns = [
                r'\b(please|thank you|hello|hi|how|what|where|when|why|can you|could you)\b',
                r'\b(dog|cat|pet|help|need|want|like|love)\b',
                r'\b(is|are|was|were|have|has|had|will|would|should|could)\b'
            ]
            return any(re.search(pattern, message, re.IGNORECASE) for pattern in english_patterns)
        
        elif detected_lang == 'zh-cn':
            # Chinese patterns
            chinese_patterns = [
                r'[请谢谢你好怎么什么哪里什么时候为什么]',
                r'[狗狗猫咪宠物帮助需要想要喜欢爱]',
                r'[是不是有没有会不会应该可以]'
            ]
            return any(re.search(pattern, message) for pattern in chinese_patterns)
        
        # For other languages, consider it a switch if message is substantial
        return len(message.strip()) > 15
    
    def get_language_instruction(self, language: str) -> str:
        """Get language instruction for LLM"""
        return language_detector.get_language_instruction(language)
    
    def create_language_aware_prompt(
        self, 
        base_prompt: str, 
        language: str,
        conversation_summary: str = ""
    ) -> str:
        """
        Create a language-aware prompt that considers conversation context
        
        Args:
            base_prompt: Base system prompt
            language: Target response language
            conversation_summary: Previous conversation context
            
        Returns:
            Enhanced prompt with language instructions
        """
        language_instruction = self.get_language_instruction(language)
        
        # Add context about conversation language if available
        context_instruction = ""
        if conversation_summary:
            history_lang = self.extract_language_from_conversation(conversation_summary)
            if history_lang and history_lang != language:
                context_instruction = f"\n\n**CONVERSATION CONTEXT:** The user has been communicating in {self.supported_languages.get(history_lang, history_lang)}, but the current message is in {self.supported_languages.get(language, language)}. Please respond in {self.supported_languages.get(language, language)} to match the current message language."
        
        enhanced_prompt = f"{base_prompt}\n\n**IMPORTANT LANGUAGE REQUIREMENT:** {language_instruction}\n\n**CRITICAL:** All your responses (including JSON content) must be in the same language as the user's current input. Do not mix languages.{context_instruction}"
        
        return enhanced_prompt


# Global language manager instance
language_manager = LanguageManager()
