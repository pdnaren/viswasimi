from pydantic import BaseModel

class UpgradeSimulateRequest(BaseModel):
    planName: str

class PaymentVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    planName: str

class UpgradeRequest(BaseModel):
    planName: str