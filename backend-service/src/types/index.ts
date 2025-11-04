import { FastifyRequest, FastifyReply } from 'fastify';
import type { 
  User as PrismaUser,
  Pet as PrismaPet,
  Device as PrismaDevice,
  DeviceBinding as PrismaDeviceBinding,
  DeviceEvent as PrismaDeviceEvent,
  HealthData as PrismaHealthData,
  UserSession as PrismaUserSession,
  OAuthAccount as PrismaOAuthAccount,
  SensorDataSession as PrismaSensorDataSession,
  VitalSignsSample as PrismaVitalSignsSample,
  MotionSample as PrismaMotionSample,
  HealthAssessment as PrismaHealthAssessment,
  BehaviorAnalysis as PrismaBehaviorAnalysis,
  MediaAnalysis as PrismaMediaAnalysis,
  AudioEvent as PrismaAudioEvent,
  VideoEvent as PrismaVideoEvent,
  SummaryStatistics as PrismaSummaryStatistics,
  SystemStatus as PrismaSystemStatus,
  HealthAlert as PrismaHealthAlert
} from '@prisma/client';

// Authenticated request type
export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    userId: string;
    type: 'access';
  };
}

// Route handler types
export type RouteHandler<TBody = unknown, TQuerystring = unknown, TParams = unknown> = (
  request: FastifyRequest<{ Body: TBody; Querystring: TQuerystring; Params: TParams }>,
  reply: FastifyReply
) => Promise<any> | any;

export type AuthenticatedRouteHandler<TBody = unknown, TQuerystring = unknown, TParams = unknown> = (
  request: AuthenticatedRequest & FastifyRequest<{ Body: TBody; Querystring: TQuerystring; Params: TParams }>,
  reply: FastifyReply
) => Promise<any> | any;

// Re-export Prisma types
export type User = PrismaUser;
export type Pet = PrismaPet;
export type Device = PrismaDevice;
export type DeviceBinding = PrismaDeviceBinding;
export type DeviceEvent = PrismaDeviceEvent;
export type HealthData = PrismaHealthData;
export type UserSession = PrismaUserSession;
export type OAuthAccount = PrismaOAuthAccount;
export type SensorDataSession = PrismaSensorDataSession;
export type VitalSignsSample = PrismaVitalSignsSample;
export type MotionSample = PrismaMotionSample;
export type HealthAssessment = PrismaHealthAssessment;
export type BehaviorAnalysis = PrismaBehaviorAnalysis;
export type MediaAnalysis = PrismaMediaAnalysis;
export type AudioEvent = PrismaAudioEvent;
export type VideoEvent = PrismaVideoEvent;
export type SummaryStatistics = PrismaSummaryStatistics;
export type SystemStatus = PrismaSystemStatus;
export type HealthAlert = PrismaHealthAlert;

// JWT Payload types
export interface JWTPayload {
  userId: string;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

// Config types
export interface AppConfig {
  port: number;
  host: string;
  nodeEnv: string;
  jwtSecret: string;
  frontendUrl: string;
  apiBaseUrl: string;
  databaseUrl: string;
  agentServiceUrl: string;
  googleClientId?: string;
  googleClientSecret?: string;
}

// API Response types
export interface ApiResponse<T = any> {
  message?: string;
  error?: string;
  data?: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Device types
export type DeviceType = 'collar' | 'camera' | 'feeder' | 'toy' | 'other';
export type DeviceStatus = 'active' | 'inactive' | 'maintenance' | 'retired';
export type BindingStatus = 'active' | 'inactive' | 'pending' | 'suspended';
export type BindingType = 'owner' | 'shared' | 'temporary';
export type EventSeverity = 'info' | 'warning' | 'error' | 'critical';

// Auth request/response types
export interface RegisterBody {
  email: string;
  password: string;
  name?: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface RefreshTokenBody {
  refreshToken: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface GoogleUserInfo {
  user: {
    id: string;
    email: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
    email_verified?: boolean;
  };
  tokens: {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
}

// Pet request/response types
export interface PetBody {
  name: string;
  species?: string;
  breed?: string;
  birthDate?: string;
  weight?: number;
  gender?: string;
  healthNotes?: string;
}

// Health data types
export interface HealthDataBody {
  date: string;
  dataType: string;
  value: string;
  unit?: string;
  source?: string;
  notes?: string;
}

// Chat types
export interface ChatMessage {
  pet_id?: string;
  message: string;
  session_id?: string;
  user_id?: string;
}

// Sensor Data Types
export type UploadReason = 'scheduled_upload' | 'event_triggered' | 'manual';
export type TrendAnalysis = 'stable' | 'improving' | 'deteriorating';
export type AlertType = 'temperature_high' | 'temperature_low' | 'heart_rate_high' | 'heart_rate_low' | 'battery_low' | 'device_offline' | 'unusual_behavior' | 'health_anomaly';

// Sensor Data Request Types
export interface SensorDataMetadata {
  device_id: string;
  session_id: string;
  timestamp: number; // Unix timestamp in milliseconds
  firmware_version?: string;
  data_interval_seconds?: number;
  upload_reason?: UploadReason;
}

export interface VitalSignsSampleData {
  timestamp_offset: number; // Offset in milliseconds from main timestamp
  temperature_c?: number;
  heart_rate_bpm?: number;
}

export interface MotionSampleData {
  timestamp_offset: number; // Offset in milliseconds from main timestamp
  acceleration: {
    x: number;
    y: number;
    z: number;
  };
  movement_intensity: number; // 0-1 scale
}

export interface HealthAssessmentData {
  overall_health_score: number; // 1-10
  vital_signs_stability: number; // 1-10
  abnormalities_detected: string[];
  trend_analysis: TrendAnalysis;
}

export interface BehaviorAnalysisData {
  activity_level: number; // 1-10
  mood_state: number; // 1-10
  behavior_pattern: string;
  unusual_behavior_detected: boolean;
}

export interface AudioEventData {
  timestamp_offset: number;
  event_type: string; // 'barking', 'whining', etc.
  duration_ms: number;
  emotional_tone: string; // 'excited', 'anxious', etc.
}

export interface VideoEventData {
  timestamp_offset: number;
  movement_type: string; // 'walking', 'still', etc.
  environment_changes: string; // 'none', 'human_entered', etc.
}

export interface MediaAnalysisData {
  audio_events: AudioEventData[];
  video_analysis: VideoEventData[];
}

export interface SummaryStatisticsData {
  temperature_stats: {
    mean: number;
    min: number;
    max: number;
  };
  heart_rate_stats: {
    mean: number;
    min: number;
    max: number;
  };
}

export interface SystemStatusData {
  battery_level: number; // 0-100
  memory_usage_percent: number; // 0-100
  storage_available_mb: number;
}

export interface SensorDataRequest {
  metadata: SensorDataMetadata;
  raw_sensor_data: {
    vital_signs_samples: VitalSignsSampleData[];
    motion_samples: MotionSampleData[];
  };
  offline_inference: {
    health_assessment: HealthAssessmentData;
    behavior_analysis: BehaviorAnalysisData;
    media_analysis: MediaAnalysisData;
  };
  summary_statistics: SummaryStatisticsData;
  system_status: SystemStatusData;
}

// Sensor Data Response Types
export interface SensorDataResponse {
  success: boolean;
  message: string;
  sessionId: string;
  ts: string; // ISO timestamp
}

export interface MonitoringStatusResponse {
  success: boolean;
  active_devices: Array<{
    deviceId: string;
    deviceType: string;
    status: DeviceStatus;
    batteryLevel?: number;
    lastOnlineAt?: string;
    boundPets: Array<{
      petId: string;
      petName: string;
    }>;
  }>;
  monitoring_count: number;
  ts: string;
}

// Query Parameters Types
export interface SensorDataQueryParams {
  petId?: string;
  deviceId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface HealthAlertsQueryParams {
  petId?: string;
  deviceId?: string;
  alertType?: AlertType;
  severity?: EventSeverity;
  isRead?: boolean;
  isResolved?: boolean;
  limit?: number;
  offset?: number;
}

