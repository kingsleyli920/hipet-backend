# HiPet Agent Service - 架构设计文档

## 🎯 设计目标

1. **硬件数据接入** - 支持传感器二进制数据实时处理
2. **多模态分析** - 结合体征数据、历史记录、知识库
3. **可扩展性** - 支持未来功能扩展
4. **融资展示** - 技术架构具备说服力

## 🏗️ 整体架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   硬件传感器     │    │   用户交互       │    │   知识库系统     │
│   (二进制数据)   │    │   (文本/语音)    │    │   (历史/个性)    │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Agent Service Layer                          │
├─────────────────┬─────────────────┬─────────────────┬───────────┤
│   Data Ingestion│   Context       │   Agent         │   Output  │
│   & Processing  │   Management    │   Orchestration │   Layer   │
└─────────────────┴─────────────────┴─────────────────┴───────────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   体征分析       │    │   智能决策       │    │   响应生成       │
│   (实时监控)     │    │   (多Agent协作)  │    │   (个性化回复)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📊 数据流设计

### 1. 硬件数据流
```python
# 传感器数据模型
class SensorData(BaseModel):
    device_id: str
    timestamp: datetime
    data_type: Literal["heart_rate", "temperature", "activity", "location"]
    raw_data: bytes  # 二进制数据
    processed_data: Dict[str, Any]  # 解析后的结构化数据
    confidence: float
    battery_level: Optional[int] = None

# 体征分析结果
class VitalSignsAnalysis(BaseModel):
    pet_id: str
    timestamp: datetime
    heart_rate: Optional[float] = None
    temperature: Optional[float] = None
    activity_level: Optional[float] = None
    stress_level: Optional[float] = None
    anomaly_detected: bool = False
    anomaly_type: Optional[str] = None
    risk_level: Literal["low", "medium", "high"] = "low"
    recommendations: List[str] = []
```

### 2. 上下文管理
```python
# 宠物上下文
class PetContext(BaseModel):
    pet_profile: PetProfile
    current_vitals: VitalSignsAnalysis
    historical_data: List[VitalSignsAnalysis]
    chat_history: List[ChatMessage]
    personality_traits: Dict[str, Any]
    health_conditions: List[str]
    preferences: Dict[str, Any]
    last_activity: datetime
```

### 3. Agent 协作流程
```python
# Agent 工作流
class AgentWorkflow:
    def __init__(self):
        self.data_processor = DataProcessorAgent()
        self.context_manager = ContextManagerAgent()
        self.router = RouterAgent()
        self.specialists = {
            "doctor": DoctorAgent(),
            "nutritionist": NutritionistAgent(),
            "trainer": TrainerAgent(),
            "monitor": MonitorAgent()  # 新增：监控Agent
        }
    
    async def process_sensor_data(self, sensor_data: SensorData):
        # 1. 数据预处理
        processed = await self.data_processor.process(sensor_data)
        
        # 2. 更新上下文
        context = await self.context_manager.update_context(processed)
        
        # 3. 异常检测
        if processed.anomaly_detected:
            return await self.specialists["monitor"].handle_anomaly(context)
        
        # 4. 正常流程
        return await self.router.route(context)
```

## 🔧 预留接口设计

### 1. 硬件数据接入接口
```python
# 硬件数据接收器
class HardwareDataReceiver:
    async def receive_sensor_data(self, data: bytes) -> SensorData:
        """接收二进制传感器数据"""
        pass
    
    async def process_batch_data(self, data_list: List[bytes]) -> List[SensorData]:
        """批量处理传感器数据"""
        pass
    
    async def validate_data_integrity(self, data: bytes) -> bool:
        """验证数据完整性"""
        pass

# 数据解析器
class DataParser:
    def __init__(self):
        self.parsers = {
            "heart_rate": HeartRateParser(),
            "temperature": TemperatureParser(),
            "activity": ActivityParser(),
            "location": LocationParser(),
        }
    
    async def parse(self, data_type: str, raw_data: bytes) -> Dict[str, Any]:
        """解析特定类型的传感器数据"""
        pass
```

### 2. 实时监控接口
```python
# 实时监控Agent
class MonitorAgent(BaseAgent):
    async def process(self, request: MonitorRequest) -> MonitorResponse:
        """处理实时监控数据"""
        pass
    
    async def detect_anomaly(self, vitals: VitalSignsAnalysis) -> AnomalyResult:
        """异常检测"""
        pass
    
    async def generate_alert(self, anomaly: AnomalyResult) -> Alert:
        """生成告警"""
        pass

# 监控请求模型
class MonitorRequest(BaseModel):
    pet_context: PetContext
    sensor_data: SensorData
    monitoring_config: MonitoringConfig

class MonitorResponse(BaseModel):
    status: Literal["normal", "warning", "critical"]
    message: str
    recommendations: List[str]
    next_check_time: Optional[datetime] = None
    requires_human_intervention: bool = False
```

### 3. 知识库集成接口
```python
# 知识库管理器
class KnowledgeBaseManager:
    async def get_pet_history(self, pet_id: str, days: int = 30) -> List[ChatMessage]:
        """获取宠物历史对话"""
        pass
    
    async def get_health_records(self, pet_id: str) -> List[HealthRecord]:
        """获取健康记录"""
        pass
    
    async def update_personality_profile(self, pet_id: str, traits: Dict[str, Any]):
        """更新个性档案"""
        pass
    
    async def get_similar_cases(self, symptoms: List[str]) -> List[SimilarCase]:
        """获取相似案例"""
        pass
```

## 🚀 技术栈选择建议

### 推荐：LangGraph + FastAPI + Redis + PostgreSQL

**优势：**
1. **LangGraph** - 专为Agent工作流设计，支持复杂的状态管理
2. **FastAPI** - 高性能异步API框架
3. **Redis** - 实时数据缓存和消息队列
4. **PostgreSQL** - 可靠的数据存储

### 架构实现
```python
# LangGraph 工作流定义
from langgraph import StateGraph, END

def create_pet_health_workflow():
    workflow = StateGraph(PetHealthState)
    
    # 添加节点
    workflow.add_node("data_processor", data_processor_node)
    workflow.add_node("context_manager", context_manager_node)
    workflow.add_node("anomaly_detector", anomaly_detector_node)
    workflow.add_node("router", router_node)
    workflow.add_node("specialist", specialist_node)
    workflow.add_node("monitor", monitor_node)
    
    # 定义流程
    workflow.add_edge("data_processor", "context_manager")
    workflow.add_conditional_edges(
        "context_manager",
        should_check_anomaly,
        {
            "anomaly": "anomaly_detector",
            "normal": "router"
        }
    )
    workflow.add_edge("anomaly_detector", "monitor")
    workflow.add_edge("router", "specialist")
    workflow.add_edge("specialist", END)
    workflow.add_edge("monitor", END)
    
    return workflow.compile()
```

## 📈 融资展示价值

### 1. 技术先进性
- **多模态AI** - 结合文本、传感器数据、历史记录
- **实时处理** - 毫秒级响应，支持实时监控
- **智能决策** - 基于多Agent协作的智能分析

### 2. 商业价值
- **数据驱动** - 基于真实体征数据的精准分析
- **个性化服务** - 基于宠物个性的定制化建议
- **预防性医疗** - 异常检测和早期预警

### 3. 扩展性
- **模块化设计** - 支持新传感器类型快速接入
- **云端部署** - 支持大规模用户并发
- **API开放** - 支持第三方硬件厂商集成

## 🔮 未来扩展计划

### Phase 1: 基础架构 (当前)
- 基础Agent系统
- 简单传感器数据接入
- 基本对话功能

### Phase 2: 硬件集成 (3-6个月)
- 完整传感器数据解析
- 实时监控系统
- 异常检测算法

### Phase 3: 智能化升级 (6-12个月)
- 机器学习模型集成
- 个性化推荐系统
- 预测性分析

### Phase 4: 生态扩展 (12个月+)
- 第三方硬件集成
- 开放API平台
- 数据分析和洞察
