import { Alert } from "@/src/components/ui/alert";

type Feedback = { type: "success" | "error"; message: string };

type StockTakeFeedbackAlertProps = {
  feedback: Feedback | null;
};

export function StockTakeFeedbackAlert({
  feedback,
}: StockTakeFeedbackAlertProps) {
  if (!feedback) {
    return null;
  }

  return <Alert variant={feedback.type}>{feedback.message}</Alert>;
}
