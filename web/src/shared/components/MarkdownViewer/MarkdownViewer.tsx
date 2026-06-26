import { useEffect, useRef } from "react";
import Viewer from "@toast-ui/editor/viewer";
import "@toast-ui/editor/toastui-editor-viewer.css";

import "./MarkdownViewer.css";

interface MarkdownViewerProps {
  value: string;
}

export function MarkdownViewer({ value }: MarkdownViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const viewer = new Viewer({ el: containerRef.current });
    viewerRef.current = viewer;
    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    viewerRef.current?.setMarkdown(value);
  }, [value]);

  return <div ref={containerRef} className="markdown-viewer" />;
}
