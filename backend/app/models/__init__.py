"""Model registry. Import every model here so Base.metadata sees them."""
from app.models.api_key import ApiKey  # noqa: F401
from app.models.attack_path import AttackPath  # noqa: F401
from app.models.chat import ChatLog  # noqa: F401
from app.models.custom_vuln import CustomVulnerability  # noqa: F401
from app.models.dependency import ScanDependency  # noqa: F401
from app.models.email_otp import EmailOtp  # noqa: F401
from app.models.github import GitHubConnection, WebhookDelivery  # noqa: F401
from app.models.handoff import HandoffEvent, HandoffToken  # noqa: F401
from app.models.fun_fact import FunFact  # noqa: F401
from app.models.learning import LearningHubClass  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.usage import UsageLog  # noqa: F401
from app.models.optimization_plan import (  # noqa: F401
    OptimizationGoal,
    OptimizationPlan,
)
from app.models.report import Report, ShareToken  # noqa: F401
from app.models.repository import Repository  # noqa: F401
from app.models.scan import Finding, Scan, Segment  # noqa: F401
from app.models.suppression import (  # noqa: F401
    FalsePositiveSuppression,
    IntentionalStubSuppression,
)
from app.models.user import (  # noqa: F401
    LoginHistory,
    Session,
    TrustedDevice,
    User,
)

__all__ = [
    "User", "Session", "LoginHistory", "TrustedDevice", "ApiKey",
    "Scan", "Segment", "Finding", "Report", "ShareToken",
    "FalsePositiveSuppression", "IntentionalStubSuppression",
    "ChatLog", "CustomVulnerability",
    "Repository", "OptimizationPlan", "OptimizationGoal",
    "GitHubConnection", "WebhookDelivery",
    "HandoffToken", "HandoffEvent", "LearningHubClass",
    "Notification", "UsageLog", "FunFact", "EmailOtp",
    "ScanDependency", "AttackPath",
]
