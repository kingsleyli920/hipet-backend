import { FastifyInstance } from 'fastify';
/**
 * Avatar Service - AI Agent Integration
 * 
 * This service provides avatar generation functionality by calling the AI Agent service
 */

class AvatarService {
  agentServiceUrl: string;
  isConfigured: boolean;

  constructor() {
    this.agentServiceUrl = process.env.AGENT_SERVICE_URL || 'http://localhost:8001';
    this.isConfigured = this._checkConfiguration();
  }

  _checkConfiguration(): boolean {
    return !!(this.agentServiceUrl && this.agentServiceUrl.startsWith('http'));
  }

  /**
   * Generate avatar parameters from user request
   * @param {string} message - User's avatar generation request
   * @param {boolean} petPhotoUploaded - Whether pet photo is uploaded
   * @param {Object} styleCatalog - Available styles (optional)
   * @param {string} language - Target language (optional)
   * @returns {Promise<Object>} Avatar generation parameters
   */
  async generateAvatar(message, petPhotoUploaded = true, styleCatalog = null, language = null) {
    if (!this.isConfigured) {
      console.log(`[AVATAR PLACEHOLDER] Generating avatar for message: ${message}`);
      return {
        success: true,
        avatar: {
          style: 'cartoon_neo',
          quality: 'standard',
          notes: 'Placeholder avatar generation',
          ok_to_generate: true,
          handoff: null,
          language: language || 'en',
          timestamp: new Date().toISOString()
        }
      };
    }

    try {
      const response = await fetch(`${this.agentServiceUrl}/avatar/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          pet_photo_uploaded: petPhotoUploaded,
          style_catalog: styleCatalog,
          language
        })
      });

      if (!response.ok) {
        throw new Error(`Avatar service responded with status: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        avatar: result
      };
    } catch (error) {
      console.error('Avatar generation error:', error);
      return {
        success: false,
        error: error.message,
        avatar: null
      };
    }
  }

  /**
   * Get available avatar styles
   * @returns {Promise<Object>} Available styles
   */
  async getAvailableStyles() {
    if (!this.isConfigured) {
      console.log('[AVATAR PLACEHOLDER] Getting available styles');
      return {
        success: true,
        styles: {
          cartoon_neo: {
            name: 'Cyber Cartoon',
            description: 'Modern cartoon style, bright colors, clean lines'
          },
          watercolor: {
            name: 'Watercolor',
            description: 'Soft watercolor effect, strong artistic feel'
          },
          pixel_pet: {
            name: 'Pixel Style',
            description: 'Retro pixel art, 8-bit game style'
          }
        }
      };
    }

    try {
      const response = await fetch(`${this.agentServiceUrl}/avatar/styles`);
      
      if (!response.ok) {
        throw new Error(`Avatar service responded with status: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        styles: result.styles
      };
    } catch (error) {
      console.error('Get styles error:', error);
      return {
        success: false,
        error: error.message,
        styles: null
      };
    }
  }

  /**
   * Validate avatar generation request
   * @param {string} message - User's request message
   * @param {boolean} petPhotoUploaded - Whether pet photo is uploaded
   * @param {string} language - Target language (optional)
   * @returns {Promise<Object>} Validation result
   */
  async validateAvatarRequest(message, petPhotoUploaded = true, language = null) {
    if (!this.isConfigured) {
      console.log(`[AVATAR PLACEHOLDER] Validating request: ${message}`);
      return {
        success: true,
        valid: true,
        language: language || 'en',
        message: 'Request is valid (placeholder)'
      };
    }

    try {
      const response = await fetch(`${this.agentServiceUrl}/avatar/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          pet_photo_uploaded: petPhotoUploaded,
          language
        })
      });

      if (!response.ok) {
        throw new Error(`Avatar service responded with status: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        valid: result.valid,
        language: result.language,
        message: result.message,
        error: result.error
      };
    } catch (error) {
      console.error('Avatar validation error:', error);
      return {
        success: false,
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Generate avatar with style preference
   * @param {string} message - User's avatar request
   * @param {string} preferredStyle - Preferred style (e.g., 'cartoon_neo', 'watercolor')
   * @param {boolean} petPhotoUploaded - Whether pet photo is uploaded
   * @param {string} language - Target language (optional)
   * @returns {Promise<Object>} Avatar generation result
   */
  async generateAvatarWithStyle(message, preferredStyle = null, petPhotoUploaded = true, language = null) {
    // If preferred style is provided, modify the message to include style preference
    let enhancedMessage = message;
    if (preferredStyle) {
      enhancedMessage = `Generate a ${preferredStyle} style avatar: ${message}`;
    }

    return await this.generateAvatar(enhancedMessage, petPhotoUploaded, null, language);
  }

  /**
   * Get service status
   * @returns {Object} Service status
   */
  getStatus() {
    return {
      configured: this.isConfigured,
      agentServiceUrl: this.agentServiceUrl,
      service: this.isConfigured ? 'AI Agent Service' : 'Placeholder'
    };
  }
}

export default new AvatarService();
