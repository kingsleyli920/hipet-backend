"""
Agent Workflow based on LangGraph
Supports hardware data integration and real-time monitoring
"""
from typing import Dict, Any, List, Optional, Literal
from datetime import datetime
from pydantic import BaseModel
try:
    from langgraph import StateGraph, END
    from langgraph.checkpoint.memory import MemorySaver
except ImportError:
    # Mock implementation if LangGraph is not installed
    class StateGraph:
        def __init__(self, state_class):
            self.state_class = state_class
            self.nodes = {}
            self.edges = []
            self.conditional_edges = []
            self.entry_point = None
        
        def add_node(self, name, func):
            self.nodes[name] = func
        
        def add_edge(self, from_node, to_node):
            self.edges.append((from_node, to_node))
        
        def add_conditional_edges(self, from_node, condition_func, mapping):
            self.conditional_edges.append((from_node, condition_func, mapping))
        
        def set_entry_point(self, node):
            self.entry_point = node
        
        def compile(self, checkpointer=None):
            return MockWorkflow(self)
    
    class MockWorkflow:
        def __init__(self, graph):
            self.graph = graph
        
        async def ainvoke(self, initial_state, config=None):
            # Mock workflow execution
            return initial_state
        
        async def astream(self, initial_state, config=None):
            # Mock streaming execution - return multiple state updates
            yield {"router_response": initial_state.get("router_response")}
            yield {"transfer": {"message": "Transferring to specialist..."}}
            yield {"specialist_response": initial_state.get("specialist_response")}
            yield {"final_response": {"status": "completed"}}
    
    END = "END"
    MemorySaver = None

from app.models.agents import PetProfile, WindowStats
from app.agents import RouterAgent, DoctorAgent, NutritionistAgent, TrainerAgent
from loguru import logger


# Workflow state definition
class PetHealthState(BaseModel):
    """Pet health workflow state"""
    # Input data
    user_message: Optional[str] = None
    sensor_data: Optional[Dict[str, Any]] = None
    pet_profile: Optional[PetProfile] = None
    
    # Processing results
    data_processed: bool = False
    context_updated: bool = False
    anomaly_detected: bool = False
    
    # Agent responses
    router_response: Optional[Dict[str, Any]] = None
    specialist_response: Optional[Dict[str, Any]] = None
    monitor_response: Optional[Dict[str, Any]] = None
    
    # Final output
    final_response: Optional[Dict[str, Any]] = None
    status: Literal["processing", "completed", "error"] = "processing"
    error_message: Optional[str] = None


# Hardware data model
class SensorData(BaseModel):
    """Sensor data model"""
    device_id: str
    timestamp: datetime
    data_type: Literal["heart_rate", "temperature", "activity", "location", "battery"]
    raw_data: bytes
    processed_data: Dict[str, Any]
    confidence: float
    battery_level: Optional[int] = None


class VitalSignsAnalysis(BaseModel):
    """Vital signs analysis result"""
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


class PetContext(BaseModel):
    """Pet context"""
    pet_profile: PetProfile
    current_vitals: Optional[VitalSignsAnalysis] = None
    historical_data: List[VitalSignsAnalysis] = []
    chat_history: List[Dict[str, Any]] = []
    personality_traits: Dict[str, Any] = {}
    health_conditions: List[str] = []
    preferences: Dict[str, Any] = {}
    last_activity: Optional[datetime] = None


# 工作流节点函数
async def data_processor_node(state: PetHealthState) -> PetHealthState:
    """数据预处理节点"""
    try:
        # 处理Sensor data
        if state.sensor_data:
            # 这里预留硬件数据解析逻辑
            processed_data = await process_sensor_data(state.sensor_data)
            state.sensor_data = processed_data
        
        state.data_processed = True
        state.status = "processing"
        
    except Exception as e:
        state.status = "error"
        state.error_message = f"数据预处理失败: {str(e)}"
    
    return state


async def context_manager_node(state: PetHealthState) -> PetHealthState:
    """上下文管理节点"""
    try:
        # 更新Pet context
        if state.pet_profile:
            context = await update_pet_context(state.pet_profile, state.sensor_data)
            state.pet_profile = context.pet_profile
        
        state.context_updated = True
        state.status = "processing"
        
    except Exception as e:
        state.status = "error"
        state.error_message = f"上下文更新失败: {str(e)}"
    
    return state


async def anomaly_detector_node(state: PetHealthState) -> PetHealthState:
    """Anomaly detection节点"""
    try:
        # 检测异常
        if state.sensor_data:
            anomaly_result = await detect_anomaly(state.sensor_data)
            state.anomaly_detected = anomaly_result.get("anomaly_detected", False)
            
            if state.anomaly_detected:
                state.monitor_response = anomaly_result
        
        state.status = "processing"
        
    except Exception as e:
        state.status = "error"
        state.error_message = f"Anomaly detection失败: {str(e)}"
    
    return state


async def router_node(state: PetHealthState) -> PetHealthState:
    """路由节点"""
    try:
        if state.user_message and state.pet_profile:
            router = RouterAgent()
            from app.models.agents import RouterRequest
            
            request = RouterRequest(
                conversation_summary="",
                last_user_msg=state.user_message,
                pet_profile=state.pet_profile
            )
            
            response = await router.process(request)
            state.router_response = response.model_dump()
        
        state.status = "processing"
        
    except Exception as e:
        state.status = "error"
        state.error_message = f"路由失败: {str(e)}"
    
    return state


async def specialist_node(state: PetHealthState) -> PetHealthState:
    """专科Agent节点"""
    try:
        if state.router_response:
            target_agent = state.router_response.get("next")
            
            if target_agent == "doctor":
                doctor = DoctorAgent()
                from app.models.agents import DoctorRequest
                
                request = DoctorRequest(
                    conversation_summary="",
                    last_user_msg=state.user_message,
                    window_stats=None,  # 可以从sensor_data构建
                    pet_profile=state.pet_profile
                )
                
                response = await doctor.process(request)
                state.specialist_response = response.model_dump()
            
            elif target_agent == "nutritionist":
                nutritionist = NutritionistAgent()
                from app.models.agents import NutritionistRequest
                
                request = NutritionistRequest(
                    conversation_summary="",
                    last_user_msg=state.user_message,
                    pet_profile=state.pet_profile,
                    diet_history={}
                )
                
                response = await nutritionist.process(request)
                state.specialist_response = response.model_dump()
        
        state.status = "processing"
        
    except Exception as e:
        state.status = "error"
        state.error_message = f"专科处理失败: {str(e)}"
    
    return state


async def monitor_node(state: PetHealthState) -> PetHealthState:
    """监控节点"""
    try:
        # 处理异常情况
        if state.anomaly_detected:
            monitor_response = {
                "status": "critical",
                "message": "检测到异常体征，建议立即就医",
                "recommendations": ["立即联系兽医", "记录异常症状", "准备就医"],
                "requires_human_intervention": True
            }
            state.monitor_response = monitor_response
        
        state.status = "processing"
        
    except Exception as e:
        state.status = "error"
        state.error_message = f"监控处理失败: {str(e)}"
    
    return state


async def finalize_node(state: PetHealthState) -> PetHealthState:
    """最终化节点"""
    try:
        # 整合所有响应
        final_response = {
            "timestamp": datetime.now().isoformat(),
            "status": "completed"
        }
        
        if state.specialist_response:
            final_response["specialist"] = state.specialist_response
        elif state.monitor_response:
            final_response["monitor"] = state.monitor_response
        
        state.final_response = final_response
        state.status = "completed"
        
    except Exception as e:
        state.status = "error"
        state.error_message = f"最终化失败: {str(e)}"
    
    return state


# 条件判断函数
def should_check_anomaly(state: PetHealthState) -> str:
    """判断是否需要检查异常"""
    if state.sensor_data and state.data_processed:
        return "anomaly"
    return "normal"


def should_route_to_specialist(state: PetHealthState) -> str:
    """判断是否路由到专科"""
    if state.router_response and not state.anomaly_detected:
        return "specialist"
    return "monitor"


# 预留的硬件数据处理函数
async def process_sensor_data(sensor_data: Dict[str, Any]) -> Dict[str, Any]:
    """处理Sensor data - 预留接口"""
    # 这里将来会实现具体的硬件数据解析逻辑
    # 例如：解析二进制数据、数据验证、格式转换等
    return sensor_data


async def update_pet_context(pet_profile: PetProfile, sensor_data: Optional[Dict[str, Any]]) -> PetContext:
    """更新Pet context - 预留接口"""
    # 这里将来会实现上下文更新逻辑
    # 例如：更新历史记录、个性分析、健康档案等
    return PetContext(pet_profile=pet_profile)


async def detect_anomaly(sensor_data: Dict[str, Any]) -> Dict[str, Any]:
    """Anomaly detection - 预留接口"""
    # 这里将来会实现Anomaly detection算法
    # 例如：心率异常、体温异常、活动量异常等
    return {"anomaly_detected": False}


# 创建工作流
def create_pet_health_workflow():
    """创建宠物健康工作流"""
    workflow = StateGraph(PetHealthState)
    
    # 添加节点
    workflow.add_node("data_processor", data_processor_node)
    workflow.add_node("context_manager", context_manager_node)
    workflow.add_node("anomaly_detector", anomaly_detector_node)
    workflow.add_node("router", router_node)
    workflow.add_node("specialist", specialist_node)
    workflow.add_node("monitor", monitor_node)
    workflow.add_node("finalize", finalize_node)
    
    # 设置入口点
    workflow.set_entry_point("data_processor")
    
    # 添加边
    workflow.add_edge("data_processor", "context_manager")
    workflow.add_edge("context_manager", "anomaly_detector")
    
    # 条件边
    workflow.add_conditional_edges(
        "anomaly_detector",
        should_check_anomaly,
        {
            "anomaly": "monitor",
            "normal": "router"
        }
    )
    
    workflow.add_conditional_edges(
        "router",
        should_route_to_specialist,
        {
            "specialist": "specialist",
            "monitor": "monitor"
        }
    )
    
    workflow.add_edge("specialist", "finalize")
    workflow.add_edge("monitor", "finalize")
    workflow.add_edge("finalize", END)
    
    # 编译工作流
    if MemorySaver:
        memory = MemorySaver()
        return workflow.compile(checkpointer=memory)
    else:
        return workflow.compile()


# Workflow executor
class PetHealthWorkflowExecutor:
    """Pet health workflow executor"""
    
    def __init__(self):
        self.workflow = create_pet_health_workflow()
        # Agent factory mapping
        self._agent_factory = {
            "doctor": self._create_doctor_agent,
            "nutritionist": self._create_nutritionist_agent,
            "trainer": self._create_trainer_agent,
            "faq": self._create_faq_agent,
            "avatar": self._create_avatar_agent,
        }
    
    async def execute(
        self,
        user_message: Optional[str] = None,
        sensor_data: Optional[Dict[str, Any]] = None,
        pet_profile: Optional[PetProfile] = None,
        config: Optional[Dict[str, Any]] = None,
        language: Optional[str] = None,
        conversation_summary: Optional[str] = None
    ) -> Dict[str, Any]:
        """Execute workflow"""
        
        try:
            # Collect all streaming responses
            responses = []
            async for state in self.stream_execute(user_message, sensor_data, pet_profile, config, language, conversation_summary):
                responses.append(state)
            
            # Return the last valid response
            for response in reversed(responses):
                if "specialist_response" in response:
                    return response["specialist_response"]
                elif "router_response" in response:
                    return response["router_response"]
            
            return {"error": "Workflow execution failed"}
            
        except Exception as e:
            return {
                "error": f"Workflow execution error: {str(e)}",
                "status": "error"
            }
    
    async def stream_execute(
        self,
        user_message: Optional[str] = None,
        sensor_data: Optional[Dict[str, Any]] = None,
        pet_profile: Optional[PetProfile] = None,
        config: Optional[Dict[str, Any]] = None,
        language: Optional[str] = None,
        conversation_summary: Optional[str] = None
    ):
        """Stream execute workflow"""
        
        try:
            # Step 1: Router Agent processing
            router_agent = RouterAgent()
            from app.models.agents import RouterRequest
            router_request = RouterRequest(
                conversation_summary=conversation_summary or "",
                last_user_msg=user_message,
                pet_profile=pet_profile
            )
            router_response = await router_agent.process(router_request, language=language)
            
            # Output Router result
            yield {
                "router_response": router_response.model_dump(),
                "type": "router"
            }
            
            # If routing to router, handle as FAQ question
            if router_response.next == "router":
                # Process the question using FAQ agent
                specialist_response = await self._process_specialist_agent(
                    agent_type="faq",
                    user_message=user_message,
                    sensor_data=sensor_data,
                    pet_profile=pet_profile,
                    language=language
                )
                
                # Output FAQ result
                if specialist_response:
                    yield {
                        "specialist_response": specialist_response.model_dump(),
                        "type": "specialist",
                        "agent": "faq"
                    }
                return
            
            # If not routing to specialist, end directly
            if router_response.next not in ["doctor", "nutritionist", "trainer", "faq", "avatar"]:
                return
            
            # Check if we're already in the target specialist (avoid duplicate transfer messages)
            current_specialist = self._extract_current_specialist_from_summary(conversation_summary)
            should_show_transfer = current_specialist != router_response.next
            
            # Step 2: Transfer notification (only if not already in the specialist)
            if should_show_transfer:
                transfer_message = getattr(router_response, "transfer_message", None) or f"Transferring you to {router_response.next.upper()} specialist..."
                yield {
                    "transfer": {
                        "message": transfer_message,
                        "target_agent": router_response.next
                    },
                    "type": "transfer"
                }
            
            # Brief delay
            import asyncio
            await asyncio.sleep(0.5)
            
            # Step 3: Specialist Agent processing
            specialist_response = await self._process_specialist_agent(
                agent_type=router_response.next,
                user_message=user_message,
                sensor_data=sensor_data,
                pet_profile=pet_profile,
                language=language
            )
            
            # Output specialist result
            if specialist_response:
                yield {
                    "specialist_response": specialist_response.model_dump(),
                    "type": "specialist",
                    "agent": router_response.next
                }
                
        except Exception as e:
            logger.error(f"Workflow execution error: {e}")
            yield {
                "error": str(e),
                "type": "error"
            }
    
    async def _process_specialist_agent(
        self,
        agent_type: str,
        user_message: str,
        sensor_data: Optional[Dict[str, Any]] = None,
        pet_profile: Optional[PetProfile] = None,
        language: Optional[str] = None
    ):
        """Process specialist agent"""
        if agent_type not in self._agent_factory:
            logger.warning(f"Unknown agent type: {agent_type}")
            return None
        
        try:
            agent, request = self._agent_factory[agent_type](
                user_message=user_message,
                sensor_data=sensor_data,
                pet_profile=pet_profile,
                language=language
            )
            return await agent.process(request)
        except Exception as e:
            logger.error(f"Error processing {agent_type} agent: {e}")
            return None
    
    def _create_doctor_agent(self, user_message: str, sensor_data: Optional[Dict[str, Any]] = None, pet_profile: Optional[PetProfile] = None, language: Optional[str] = None):
        """Create doctor agent"""
        from app.models.agents import DoctorRequest
        return DoctorAgent(), DoctorRequest(
            conversation_summary="",
            last_user_msg=user_message,
            window_stats=sensor_data,
            pet_profile=pet_profile
        )
    
    def _create_nutritionist_agent(self, user_message: str, sensor_data: Optional[Dict[str, Any]] = None, pet_profile: Optional[PetProfile] = None, language: Optional[str] = None):
        """Create nutritionist agent"""
        from app.models.agents import NutritionistRequest
        return NutritionistAgent(), NutritionistRequest(
            conversation_summary="",
            last_user_msg=user_message,
            pet_profile=pet_profile
        )
    
    def _create_trainer_agent(self, user_message: str, sensor_data: Optional[Dict[str, Any]] = None, pet_profile: Optional[PetProfile] = None, language: Optional[str] = None):
        """Create trainer agent"""
        from app.models.agents import TrainerRequest
        return TrainerAgent(), TrainerRequest(
            conversation_summary="",
            last_user_msg=user_message,
            pet_profile=pet_profile
        )
    
    def _create_faq_agent(self, user_message: str, sensor_data: Optional[Dict[str, Any]] = None, pet_profile: Optional[PetProfile] = None, language: Optional[str] = None):
        """Create FAQ agent"""
        from app.agents import SimpleFAQAgent
        from app.models.agents import SimpleFAQRequest
        return SimpleFAQAgent(), SimpleFAQRequest(last_user_msg=user_message)
    
    def _create_avatar_agent(self, user_message: str, sensor_data: Optional[Dict[str, Any]] = None, pet_profile: Optional[PetProfile] = None, language: Optional[str] = None):
        """Create Avatar agent"""
        from app.agents import AvatarAgent
        from app.models.agents import AvatarRequest
        return AvatarAgent(), AvatarRequest(
            last_user_msg=user_message,
            pet_photo_uploaded=True
        )


    def _extract_current_specialist_from_summary(self, conversation_summary: str) -> Optional[str]:
        """
        Extract current specialist from conversation summary
        
        Args:
            conversation_summary: Previous conversation summary
            
        Returns:
            Current specialist name or None if not found
        """
        if not conversation_summary:
            return None
        
        # Look for specialist indicators in the conversation summary
        specialist_indicators = {
            "doctor": ["医生", "兽医", "health", "medical", "doctor"],
            "nutritionist": ["营养师", "营养", "nutrition", "diet", "food"],
            "trainer": ["训犬师", "训练师", "训练", "trainer", "training", "behavior"],
            "faq": ["FAQ", "常见问题", "faq", "help"],
            "avatar": ["头像", "avatar", "image", "generate"]
        }
        
        summary_lower = conversation_summary.lower()
        
        # Check for specialist indicators
        for specialist, indicators in specialist_indicators.items():
            for indicator in indicators:
                if indicator.lower() in summary_lower:
                    return specialist
        
        return None


# Global workflow executor instance
workflow_executor = PetHealthWorkflowExecutor()
