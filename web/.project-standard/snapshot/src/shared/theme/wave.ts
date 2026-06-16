import type { ConfigProviderProps, GetProp } from "antd";

type WaveConfig = GetProp<ConfigProviderProps, "wave">;

function createHolder(node: HTMLElement) {
  const { borderWidth } = getComputedStyle(node);
  const borderWidthNum = Number.parseInt(borderWidth, 10) || 0;
  const holder = document.createElement("div");

  holder.style.position = "absolute";
  holder.style.inset = `-${borderWidthNum}px`;
  holder.style.borderRadius = "inherit";
  holder.style.background = "transparent";
  holder.style.zIndex = "999";
  holder.style.pointerEvents = "none";
  holder.style.overflow = "hidden";
  node.appendChild(holder);

  return holder;
}

function createDot(holder: HTMLElement, color: string, left: number, top: number) {
  const dot = document.createElement("div");

  dot.style.position = "absolute";
  dot.style.insetInlineStart = `${left}px`;
  dot.style.top = `${top}px`;
  dot.style.width = "0";
  dot.style.height = "0";
  dot.style.borderRadius = "50%";
  dot.style.background = color;
  dot.style.transform = "translate3d(-50%, -50%, 0)";
  dot.style.transition = "all 1s ease-out";
  holder.appendChild(dot);

  return dot;
}

export const antdWave: WaveConfig = {
  showEffect(node, { component, event }) {
    if (component !== "Button") return;

    const holder = createHolder(node);
    const rect = holder.getBoundingClientRect();
    const dot = createDot(
      holder,
      "rgba(255, 255, 255, 0.65)",
      event.clientX - rect.left,
      event.clientY - rect.top
    );

    requestAnimationFrame(() => {
      dot.ontransitionend = () => holder.remove();
      dot.style.width = "200px";
      dot.style.height = "200px";
      dot.style.opacity = "0";
    });
  }
};
