"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { C } from "@/app/lib/theme";
import { getApiUrl } from "@/app/lib/api";
import { getAuthHeaders, parseJsonResponse } from "@/app/lib/auth-client";
import { Loader2, Check, AlertCircle } from "lucide-react";

export default function UpgradePage() {
  const router                              = useRouter();
  const [loadingPlan, setLoadingPlan]       = useState<string | null>(null);
  const [currentPlan, setCurrentPlan]       = useState<string>("free");
  const [userInfo, setUserInfo]             = useState<{ name: string; email: string } | null>(null);
  const [showConfirmFree, setShowConfirmFree] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(getApiUrl("/api/profile/me"), {
          credentials: "include",
          headers:     getAuthHeaders(),
        });
        if (res.ok) {
          const data = await parseJsonResponse<any>(res);
          setCurrentPlan(data.subscription?.planName?.toLowerCase() || "free");
          setUserInfo({ name: data.user?.name || "Student", email: data.user?.email || "" });
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchStatus();
  }, []);

  const handleUpgrade = async (planName: string) => {
    const target = planName.toLowerCase();

    if (target === currentPlan || target === "premium") return;

    if (target === "free") {
      setShowConfirmFree(true);
      return;
    }

    // Razorpay upgrade
    try {
      setLoadingPlan(planName);

      const orderRes = await fetch(getApiUrl("/api/payments/create-order"), {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json", ...getAuthHeaders() },
        body:        JSON.stringify({ planName }),
      });

      if (!orderRes.ok) throw new Error("Order creation failed");
      const orderData = await orderRes.json();

      const options = {
        // FIX #5: key_id is the publishable key returned by the server (never the secret)
        key:      orderData.key_id,
        amount:   orderData.amount,
        currency: "INR",
        name:     "Viswasimi AI",
        description: `Upgrade to ${planName} Plan`,
        order_id: orderData.order_id,
        handler: async (response: any) => {
          const verifyRes = await fetch(getApiUrl("/api/payments/verify"), {
            method:      "POST",
            credentials: "include",
            headers:     { "Content-Type": "application/json", ...getAuthHeaders() },
            body:        JSON.stringify({
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              planName:            planName.toLowerCase(),
            }),
          });

          if (verifyRes.ok) {
            window.location.href = "/dashboard";
          } else {
            alert("Payment verification failed. Please contact support.");
          }
        },
        prefill: { name: userInfo?.name || "", email: userInfo?.email || "" },
        theme:   { color: C.primary },
        modal:   { ondismiss: () => setLoadingPlan(null) },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Payment Error:", err);
      alert("Could not initiate payment. Please try again.");
      setLoadingPlan(null);
    }
  };

  // FIX #5: Use the correct, existing cancel endpoint instead of the non-existent
  // /api/subscriptions/upgrade-simulate endpoint
  const confirmFreeDowngrade = async () => {
    setShowConfirmFree(false);
    setLoadingPlan("Free");
    try {
      const res = await fetch(getApiUrl("/api/profile/cancel-subscription"), {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json", ...getAuthHeaders() },
      });

      if (res.ok) {
        window.location.href = "/dashboard";
      } else {
        const err = await res.json();
        alert(err.detail || "Could not switch plan. Please try again.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const PLANS = [
    {
      name:     "Free",
      price:    "₹0",
      subtitle: "Best for trying Viswasimi",
      features: ["10 AI messages/day", "Basic progress tracking", "Community support"],
      cta:      "Get Plan",
    },
    {
      name:     "Basic",
      price:    "₹299/mo",
      subtitle: "For consistent daily practice",
      features: ["Unlimited AI chat", "Topic wise Explanation", "Weekly progress insights"],
      cta:      "Upgrade to Basic",
    },
    {
      name:     "Premium",
      price:    "₹699/mo",
      subtitle: "Currently Unavailable",
      features: ["Everything in Basic", "Priority responses", "Advanced analytics & revision planner"],
      cta:      "Unavailable",
    },
  ];

  return (
    <div style={{ padding: "32px 40px", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>Upgrade Plan 🚀</h1>
          <p style={{ fontSize: 14, color: C.muted }}>Choose a plan that matches your learning goals.</p>
        </div>
        <Link
          href="/dashboard"
          style={{
            padding:        "9px 14px",
            borderRadius:   10,
            border:         `1px solid ${C.border}`,
            textDecoration: "none",
            color:          C.text,
            fontSize:       13,
            background:     C.card,
          }}
        >
          ← Back to dashboard
        </Link>
      </div>

      {/* Plans Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        {PLANS.map((plan) => {
          const planKey       = plan.name.toLowerCase();
          const isCurrent     = currentPlan === planKey;
          const isPremium     = planKey === "premium";
          const shouldHighlight = currentPlan === "free" && planKey === "basic";

          return (
            <div
              key={plan.name}
              style={{
                background:    C.card,
                border:        `2px solid ${shouldHighlight ? C.primary : isCurrent ? C.secondary : C.border}`,
                borderRadius:  20,
                padding:       "28px 24px",
                display:       "flex",
                flexDirection: "column",
                gap:           16,
                position:      "relative",
                opacity:       isPremium ? 0.6 : 1,
                filter:        isPremium ? "grayscale(0.5)" : "none",
              }}
            >
              {isCurrent && (
                <div
                  style={{
                    position:  "absolute",
                    top:       -12,
                    left:      "50%",
                    transform: "translateX(-50%)",
                    background: C.secondary,
                    color:     "#fff",
                    padding:   "4px 12px",
                    borderRadius: 20,
                    fontSize:  10,
                    fontWeight: 800,
                  }}
                >
                  ACTIVE PLAN
                </div>
              )}

              {isPremium && (
                <div
                  style={{
                    position:   "absolute",
                    top:        12,
                    right:      12,
                    fontSize:   10,
                    fontWeight: 700,
                    color:      C.muted,
                    background: "var(--card-hover)",
                    padding:    "4px 8px",
                    borderRadius: 6,
                  }}
                >
                  COMING SOON
                </div>
              )}

              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700 }}>{plan.name}</h2>
                <div style={{ fontSize: 32, fontWeight: 800 }}>{plan.price}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{plan.subtitle}</div>
              </div>

              <ul style={{ margin: "10px 0", paddingLeft: 0, listStyle: "none", display: "grid", gap: 10 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
                    <Check size={14} color={isCurrent ? C.secondary : C.primary} /> {f}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={isCurrent || isPremium || !!loadingPlan}
                onClick={() => handleUpgrade(plan.name)}
                style={{
                  marginTop:    "auto",
                  width:        "100%",
                  border:       "none",
                  borderRadius: 12,
                  padding:      "14px",
                  fontWeight:   700,
                  cursor:       isCurrent || isPremium ? "not-allowed" : "pointer",
                  background:   isCurrent
                    ? "var(--card-hover)"
                    : planKey === "free"
                    ? "rgba(79,124,255,0.1)"
                    : C.primary,
                  color:        isCurrent ? C.muted : planKey === "free" ? C.primary : "#fff",
                  transition:   "all 0.2s ease",
                }}
              >
                {loadingPlan === plan.name ? (
                  <Loader2 className="animate-spin mx-auto" size={18} />
                ) : isCurrent ? (
                  "Current Plan"
                ) : isPremium ? (
                  "Unavailable"
                ) : (
                  plan.cta
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Downgrade Confirmation Modal */}
      {showConfirmFree && (
        <div
          style={{
            position:       "fixed",
            top:            0,
            left:           0,
            right:          0,
            bottom:         0,
            background:     "rgba(0,0,0,0.5)",
            backdropFilter: "blur(6px)",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            zIndex:         9999,
            padding:        20,
          }}
        >
          <div
            style={{
              background:     "var(--card)",
              padding:        32,
              borderRadius:   28,
              width:          "100%",
              maxWidth:       420,
              textAlign:      "center",
              boxShadow:      "0 25px 50px -12px rgba(0,0,0,0.25)",
              display:        "flex",
              flexDirection:  "column",
              gap:            24,
            }}
          >
            <div
              style={{
                width:          64,
                height:         64,
                borderRadius:   100,
                background:     "#fff1f1",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                margin:         "0 auto",
              }}
            >
              <AlertCircle size={32} color="#ff4f4f" />
            </div>

            <div>
              <h3 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
                Switch to Free Plan?
              </h3>
              <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>
                You will immediately lose access to <b>Unlimited AI Chat</b> and{" "}
                <b>Topic-wise Explanations</b>. Are you sure?
              </p>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setShowConfirmFree(false)}
                style={{
                  flex:         1,
                  padding:      "14px",
                  borderRadius: 14,
                  border:       `1px solid ${C.border}`,
                  background:   "none",
                  fontWeight:   600,
                  cursor:       "pointer",
                  transition:   "all 0.2s",
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmFreeDowngrade}
                style={{
                  flex:         1,
                  padding:      "14px",
                  borderRadius: 14,
                  border:       "none",
                  background:   "#ff4f4f",
                  color:        "#fff",
                  fontWeight:   600,
                  cursor:       "pointer",
                  boxShadow:    "0 4px 12px rgba(255,79,79,0.2)",
                }}
              >
                Yes, Downgrade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
