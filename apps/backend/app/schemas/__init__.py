from app.schemas.auth import (
    SignupRequest, LoginRequest, ChangePasswordRequest,
    ForgotPasswordRequest, ResetPasswordRequest, GoogleCompleteSignupRequest
)
from app.schemas.user import UpdateLocaleRequest
from app.schemas.tutoring import (
    ChatRole, TutorMode, ChatHistoryItem, ChatRequest, 
    ChatSavePayload, TTSRequest, CheckpointGradeRequest, PlanItemRequest
)
from app.schemas.progress import (
    ProgressEvent, ProgressRequest, ProgressLogRequest, 
    DailyUpdateRequest, MasteryUpdateRequest
)
from app.schemas.curriculum import (
    TopicSeedItem, ChapterSeedItem, SubjectSeedItem, SubjectSeedRequest
)
from app.schemas.billing import (
    UpgradeSimulateRequest, PaymentVerifyRequest, UpgradeRequest
)
from app.schemas.assessment import StartAssessmentRequest, AnswerQuestionRequest

__all__ = [
    # Auth
    "SignupRequest", "LoginRequest", "ChangePasswordRequest", "ForgotPasswordRequest", "ResetPasswordRequest",
    "GoogleCompleteSignupRequest",
    # User
    "UpdateLocaleRequest",
    # Tutoring
    "ChatRole", "TutorMode", "ChatHistoryItem", "ChatRequest", "ChatSavePayload", 
    "TTSRequest", "CheckpointGradeRequest", "PlanItemRequest",
    # Progress
    "ProgressEvent", "ProgressRequest", "ProgressLogRequest", "DailyUpdateRequest", "MasteryUpdateRequest",
    # Curriculum
    "TopicSeedItem", "ChapterSeedItem", "SubjectSeedItem", "SubjectSeedRequest",
    # Billing
    "UpgradeSimulateRequest", "PaymentVerifyRequest", "UpgradeRequest",
    # Assessment
    "StartAssessmentRequest", "AnswerQuestionRequest",
]