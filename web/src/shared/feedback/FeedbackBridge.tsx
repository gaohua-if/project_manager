import { App } from "antd";
import { useEffect } from "react";

import { bindFeedback } from "./feedback";

export function FeedbackBridge() {
  const apis = App.useApp();

  useEffect(() => {
    bindFeedback(apis);
  }, [apis]);

  return null;
}
