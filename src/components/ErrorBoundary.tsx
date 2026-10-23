import { Component, type ErrorInfo, type ReactNode } from "react";

export const BUILD = typeof __BUILD__ === "string" ? __BUILD__ : "dev";

/** Shows what broke (instead of a frozen screen) so it can be reported, with a way back. */
export class ErrorBoundary extends Component<
  { children: ReactNode; resetKey?: string },
  { error: Error | null; where: string; copied: boolean }
> {
  state = { error: null as Error | null, where: "", copied: false };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
    // The first few component names say which screen/part failed.
    const where = (info.componentStack ?? "")
      .split("\n").map((l) => l.trim().replace(/^at /, "").split(" ")[0]).filter(Boolean).slice(0, 6).join(" ‹ ");
    this.setState({ where });
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null, where: "", copied: false });
  }

  render() {
    const { error, where, copied } = this.state;
    if (!error) return this.props.children;
    const report = [`${error.name}: ${error.message}`, where && `in ${where}`, `build ${BUILD}`, navigator.userAgent].filter(Boolean).join("\n");
    return (
      <div className="screen">
        <h1 className="t-title2" style={{ margin: 0 }}>Something went wrong · משהו השתבש</h1>
        <div className="card t-foot" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", direction: "ltr", userSelect: "text" }}>{report}</div>
        <button className="btn soft block press" onClick={() => {
          navigator.clipboard?.writeText(report).then(() => this.setState({ copied: true })).catch(() => {});
        }}>{copied ? "Copied ✓" : "Copy error · העתקה"}</button>
        <button className="btn block press" onClick={() => location.reload()}>Reload · רענון</button>
      </div>
    );
  }
}
