import { Component, type ReactNode } from "react";

/** Shows what broke (instead of a frozen screen) so it can be reported, with a way back. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="screen">
        <h1 className="t-title2" style={{ margin: 0 }}>Something went wrong · משהו השתבש</h1>
        <div className="card t-foot" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", direction: "ltr" }}>
          {this.state.error.message}
          {"\n"}
          {this.state.error.stack?.split("\n").slice(0, 4).join("\n")}
        </div>
        <button className="btn block press" onClick={() => location.reload()}>Reload · רענון</button>
      </div>
    );
  }
}
