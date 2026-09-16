import { CheckCircle2, AlertCircle } from "lucide-react";

export function CheckpointBanner({ correct }: { correct: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "12px 18px", borderRadius: 12, margin: "8px 0",
      background: correct ? "#ecfdf5" : "#fef2f2",
      border: `1px solid ${correct ? "#a7f3d0" : "#fecaca"}`,
      color: correct ? "#065f46" : "#991b1b",
      fontSize: 14, fontWeight: 600, alignSelf: "flex-start",
    }}>
      {correct ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}
      {correct ? "Correct! Well done 🎉" : "Not quite — keep going, you'll get it! 💪"}
    </div>
  );
}
